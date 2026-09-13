package com.vaiyu.service;

import com.vaiyu.domain.Basin;
import com.vaiyu.domain.IntensityScale;
import com.vaiyu.dto.CycloneDetailDto;
import com.vaiyu.dto.CycloneSummaryDto;
import com.vaiyu.dto.DataQualityDto;
import com.vaiyu.dto.ObservationDto;
import com.vaiyu.dto.PageResponse;
import com.vaiyu.dto.SeasonActivityDto;
import com.vaiyu.entity.Cyclone;
import com.vaiyu.entity.CycloneObservation;
import com.vaiyu.exception.ResourceNotFoundException;
import com.vaiyu.ingestion.IbtracsImporter;
import com.vaiyu.repository.CycloneObservationRepository;
import com.vaiyu.repository.CycloneRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Read side for storms and their tracks.
 *
 * <p>Aggregates are computed in the database for lists and in memory for a
 * single storm, where the whole track is already loaded. Nothing here calls the
 * AI service: forecasting lives in {@link PredictionService}, so browsing the
 * archive stays fast and works whether or not the model is running.
 */
@Service
@Transactional(readOnly = true)
public class CycloneQueryService {

    /** Enough for the longest track in the archive (129 fixes). */
    private static final int MAX_PAGE_SIZE = 200;

    private final CycloneRepository cyclones;
    private final CycloneObservationRepository observations;

    public CycloneQueryService(CycloneRepository cyclones,
                               CycloneObservationRepository observations) {
        this.cyclones = cyclones;
        this.observations = observations;
    }

    public PageResponse<CycloneSummaryDto> search(
            String query, String basin, String subBasin, Integer season, String sort,
            int page, int size) {

        String like = (query == null || query.isBlank())
                ? null
                : "%" + query.trim().toLowerCase() + "%";
        String basinCode = (basin == null || basin.isBlank()) ? null : basin.trim().toUpperCase();
        String subBasinCode =
                (subBasin == null || subBasin.isBlank()) ? null : subBasin.trim().toUpperCase();

        Page<CycloneRepository.CycloneListRow> rows = cyclones.search(
                like, basinCode, subBasinCode, season,
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE), sortOf(sort)));

        return PageResponse.of(rows, CycloneSummaryDto::from);
    }

    /**
     * Sorting happens on aggregates, so the property names are the aliases from
     * the projection query rather than entity fields.
     */
    private Sort sortOf(String sort) {
        String key = sort == null ? "" : sort.trim().toLowerCase();
        return switch (key) {
            case "intensity", "peak_wind" -> Sort.by(Sort.Direction.DESC, "peakWindKph");
            case "pressure" -> Sort.by(Sort.Direction.ASC, "minPressureHpa");
            case "name" -> Sort.by(Sort.Direction.ASC, "name");
            case "observations" -> Sort.by(Sort.Direction.DESC, "observationCount");
            case "oldest" -> Sort.by(Sort.Direction.ASC, "lastObservedAt");
            // Most recent storm first: the useful default for an archive that
            // runs to the present day.
            default -> Sort.by(Sort.Direction.DESC, "lastObservedAt");
        };
    }

    public List<Integer> seasons() {
        return cyclones.findSeasons();
    }

    public List<String> basins() {
        return cyclones.findBasins();
    }

    /**
     * The sub-basins present in the archive, each with its basin and a display
     * name. Codes IBTrACS leaves unnamed are dropped rather than shown raw.
     */
    public List<SubBasinDto> subBasins() {
        return cyclones.findSubBasins().stream()
                .map(row -> new SubBasinDto(
                        row.getBasin(), row.getCode(), Basin.subBasinNameOf(row.getCode())))
                .filter(dto -> dto.name() != null)
                .toList();
    }

    /** One selectable sub-basin: which basin it is in, its code and its name. */
    public record SubBasinDto(String basin, String code, String name) {
    }

    /**
     * Season-by-season activity for a basin, one row per sea.
     *
     * <p>Rounded here rather than in the query so the numbers a reader sees and
     * the numbers the API returns are the same.
     */
    public List<SeasonActivityDto> seasonActivity(String basin) {
        String basinCode = (basin == null || basin.isBlank()) ? null : basin.trim().toUpperCase();
        return cyclones.findSeasonActivity(basinCode).stream()
                .map(row -> new SeasonActivityDto(
                        row.getSeason(),
                        row.getSubBasin(),
                        Basin.subBasinNameOf(row.getSubBasin()),
                        row.getStorms(),
                        Math.round(row.getAce() * 10.0) / 10.0,
                        row.getPeakWindKph() == null
                                ? null
                                : Math.round(row.getPeakWindKph() * 10.0) / 10.0,
                        row.getStrongestStorm(),
                        row.getStrongestStormId()))
                .toList();
    }

    public Cyclone require(UUID id) {
        return cyclones.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("No cyclone with id " + id));
    }

    public List<ObservationDto> track(UUID cycloneId) {
        require(cycloneId);
        return observations.findByCycloneIdOrderByObservedAtAsc(cycloneId).stream()
                .map(ObservationDto::from)
                .toList();
    }

    public CycloneDetailDto detail(UUID cycloneId) {
        Cyclone cyclone = require(cycloneId);
        List<CycloneObservation> track =
                observations.findByCycloneIdOrderByObservedAtAsc(cycloneId);

        CycloneObservation latest = track.isEmpty() ? null : track.get(track.size() - 1);
        CycloneObservation peak = track.stream()
                .filter(o -> o.getWindSpeedKph() != null)
                .max(Comparator.comparing(CycloneObservation::getWindSpeedKph))
                .orElse(null);

        Double peakWind = peak == null ? null : peak.getWindSpeedKph();
        Double minPressure = track.stream()
                .map(CycloneObservation::getPressureHpa)
                .filter(java.util.Objects::nonNull)
                .min(Double::compareTo)
                .orElse(null);

        return new CycloneDetailDto(
                cyclone.getId(),
                cyclone.getExternalId(),
                cyclone.getName(),
                cyclone.getBasin(),
                Basin.nameOf(cyclone.getBasin()),
                cyclone.getSubBasin(),
                Basin.subBasinNameOf(cyclone.getSubBasin()),
                cyclone.getSeasonYear(),
                cyclone.getStatus(),
                track.isEmpty() ? null : track.get(0).getObservedAt(),
                latest == null ? null : latest.getObservedAt(),
                peakWind,
                minPressure,
                IntensityScale.labelOf(peakWind),
                IntensityScale.rankOf(peakWind),
                latest == null ? null : ObservationDto.from(latest),
                peak == null ? null : ObservationDto.from(peak),
                quality(track));
    }

    /** Counted from the stored track; never estimated. */
    public DataQualityDto quality(List<CycloneObservation> track) {
        long withWind = track.stream().filter(o -> o.getWindSpeedKph() != null).count();
        long withPressure = track.stream().filter(o -> o.getPressureHpa() != null).count();

        Double largestGap = null;
        for (int i = 1; i < track.size(); i++) {
            double hours = Duration.between(
                    track.get(i - 1).getObservedAt(), track.get(i).getObservedAt()).toMinutes() / 60.0;
            if (largestGap == null || hours > largestGap) {
                largestGap = hours;
            }
        }

        Instant first = track.isEmpty() ? null : track.get(0).getObservedAt();
        Instant last = track.isEmpty() ? null : track.get(track.size() - 1).getObservedAt();
        Double durationHours = (first == null || last == null)
                ? null
                : Duration.between(first, last).toMinutes() / 60.0;

        List<String> limitations = new ArrayList<>();
        boolean forecastReady = withWind >= com.vaiyu.ai.AiRequestFactory.MINIMUM_OBSERVATIONS;
        if (!forecastReady) {
            limitations.add("Fewer than " + com.vaiyu.ai.AiRequestFactory.MINIMUM_OBSERVATIONS
                    + " fixes with a wind speed, so no forecast can be produced.");
        }
        if (withPressure == 0 && !track.isEmpty()) {
            limitations.add("No fix carries a pressure reading, so the intensity model "
                    + "cannot forecast pressure or a trend for this storm.");
        } else if (withPressure < track.size()) {
            limitations.add((track.size() - withPressure) + " of " + track.size()
                    + " fixes have no pressure reading.");
        }
        if (largestGap != null && largestGap > 12.0) {
            limitations.add("Largest gap between fixes is "
                    + Math.round(largestGap) + " hours, so parts of this track are uncovered.");
        }

        return new DataQualityDto(
                track.size(), withWind, withPressure, first, last,
                largestGap, durationHours, forecastReady, limitations,
                IbtracsImporter.OBSERVATION_SOURCE,
                IntensityScale.SCALE_NAME);
    }
}

package com.cyclovision.service;

import com.cyclovision.domain.Basin;
import com.cyclovision.domain.IntensityScale;
import com.cyclovision.dto.CycloneDetailDto;
import com.cyclovision.dto.CycloneSummaryDto;
import com.cyclovision.dto.DataQualityDto;
import com.cyclovision.dto.ObservationDto;
import com.cyclovision.dto.PageResponse;
import com.cyclovision.entity.Cyclone;
import com.cyclovision.entity.CycloneObservation;
import com.cyclovision.exception.ResourceNotFoundException;
import com.cyclovision.ingestion.IbtracsImporter;
import com.cyclovision.repository.CycloneObservationRepository;
import com.cyclovision.repository.CycloneRepository;
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
            String query, String basin, Integer season, String sort, int page, int size) {

        String like = (query == null || query.isBlank())
                ? null
                : "%" + query.trim().toLowerCase() + "%";
        String basinCode = (basin == null || basin.isBlank()) ? null : basin.trim().toUpperCase();

        Page<CycloneRepository.CycloneListRow> rows = cyclones.search(
                like, basinCode, season,
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
        boolean forecastReady = withWind >= com.cyclovision.ai.AiRequestFactory.MINIMUM_OBSERVATIONS;
        if (!forecastReady) {
            limitations.add("Fewer than " + com.cyclovision.ai.AiRequestFactory.MINIMUM_OBSERVATIONS
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

package com.cyclovision.service;

import com.cyclovision.ai.AiAnalysisOutcome;
import com.cyclovision.ai.AiRequestFactory;
import com.cyclovision.ai.AiServiceClient;
import com.cyclovision.ai.dto.AiAnalysisRequest;
import com.cyclovision.ai.dto.AiAnalysisResponse;
import com.cyclovision.dto.PredictionRunDto;
import com.cyclovision.entity.*;
import com.cyclovision.exception.AiRequestRejectedException;
import com.cyclovision.exception.AiServiceUnavailableException;
import com.cyclovision.exception.ResourceNotFoundException;
import com.cyclovision.ingestion.IbtracsImporter;
import com.cyclovision.repository.CycloneObservationRepository;
import com.cyclovision.repository.CycloneRepository;
import com.cyclovision.repository.PredictionRunRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Runs the trained models against stored observations and records the result.
 *
 * <p>This is the orchestration the whole product turns on:
 * <pre>
 *   stored observations -> synoptic filter -> AI service -> trained models
 *       -> forecast -> PostgreSQL -> API -> map and charts
 * </pre>
 *
 * <p>Three rules it enforces, each for a reason:
 * <ul>
 *   <li><strong>Nothing is invented.</strong> Every stored number came from the
 *       model's response. Where a model declined, the reason is stored instead
 *       of a placeholder, and the run is still saved.</li>
 *   <li><strong>Forecasts are never recomputed silently.</strong> A run for the
 *       same storm and base fix is reused unless the caller forces a new one,
 *       so clicking through the UI does not hammer the model — and two views of
 *       the same forecast agree.</li>
 *   <li><strong>The base fix bounds the input.</strong> Forecasting from a past
 *       time uses only fixes at or before it, which is what makes the replay
 *       honest rather than a lookup of what happened.</li>
 * </ul>
 */
@Service
public class PredictionService {

    private static final Logger log = LoggerFactory.getLogger(PredictionService.class);

    private static final List<String> DEFAULT_ANALYSES = List.of(
            AiAnalysisRequest.TRAJECTORY,
            AiAnalysisRequest.INTENSITY,
            AiAnalysisRequest.SIMILARITY);

    private final AiServiceClient ai;
    private final AiRequestFactory requestFactory;
    private final CycloneRepository cyclones;
    private final CycloneObservationRepository observations;
    private final PredictionRunRepository runs;

    public PredictionService(AiServiceClient ai,
                             AiRequestFactory requestFactory,
                             CycloneRepository cyclones,
                             CycloneObservationRepository observations,
                             PredictionRunRepository runs) {
        this.ai = ai;
        this.requestFactory = requestFactory;
        this.cyclones = cyclones;
        this.observations = observations;
        this.runs = runs;
    }

    /**
     * Forecasts one storm from one of its fixes.
     *
     * @param baseTime  forecast from the latest synoptic fix at or before this
     *                  moment; null means the storm's most recent fix
     * @param requested analyses to run; null or empty means trajectory,
     *                  intensity and historical similarity
     * @param force     run the model even when a stored run for this base fix
     *                  exists
     */
    @Transactional
    public PredictionRunDto forecast(
            UUID cycloneId, Instant baseTime, List<String> requested, boolean force) {

        Cyclone cyclone = cyclones.findById(cycloneId)
                .orElseThrow(() -> new ResourceNotFoundException("No cyclone with id " + cycloneId));

        List<String> analyses = (requested == null || requested.isEmpty())
                ? DEFAULT_ANALYSES
                : requested;

        List<CycloneObservation> track =
                observations.findByCycloneIdOrderByObservedAtAsc(cycloneId);

        // Build the request first: it resolves the base fix, and reuse has to
        // be keyed on the resolved fix rather than on the caller's timestamp.
        AiRequestFactory.Plan plan = requestFactory.build(
                cycloneId, track, baseTime, analyses, null);

        if (!force) {
            Optional<PredictionRun> existing = runs
                    .findFirstByCycloneIdAndBaseObservationAtOrderByCreatedAtDesc(
                            cycloneId, plan.baseTime());
            if (existing.isPresent()) {
                log.debug("Reusing stored run {} for cyclone {} at {}",
                        existing.get().getId(), cycloneId, plan.baseTime());
                return PredictionRunDto.from(existing.get());
            }
        }

        AiAnalysisOutcome outcome = ai.analyse(plan.request(), false);

        if (outcome instanceof AiAnalysisOutcome.Rejected rejected) {
            // The AI service validated the request and refused it. That is a
            // client-visible condition with a usable message, not a 500.
            throw new AiRequestRejectedException(rejected.errorCode(), rejected.detail());
        }
        if (outcome instanceof AiAnalysisOutcome.Unreachable unreachable) {
            throw new AiServiceUnavailableException(unreachable.detail());
        }

        AiAnalysisResponse response = outcome.responseOrNull();
        if (response == null) {
            throw new AiServiceUnavailableException(
                    "The AI service returned no analysis for this request.");
        }

        PredictionRun run = persist(cyclone, plan, analyses, response);
        log.info("Forecast for {} from {}: overall {} ({} track points, {} analogues)",
                cyclone.getExternalId(), plan.baseTime(), run.getOverallStatus(),
                run.getTrackPoints().size(), run.getAnalogueMatches().size());
        return PredictionRunDto.from(run);
    }

    private PredictionRun persist(
            Cyclone cyclone,
            AiRequestFactory.Plan plan,
            List<String> analyses,
            AiAnalysisResponse response) {

        AiAnalysisResponse.TrajectoryPrediction trajectory = response.trajectoryPrediction();
        AiAnalysisResponse.IntensityPrediction intensity = response.intensityPrediction();
        AiAnalysisResponse.HistoricalSimilarity similarity = response.historicalSimilarity();

        PredictionRun run = PredictionRun.builder()
                .cyclone(cyclone)
                .baseObservationAt(plan.baseTime())
                .observationsUsed(plan.observations().size())
                .requestedAnalyses(String.join(",", analyses))
                .aiRequestId(response.requestId())
                .overallStatus(response.status())
                .inputObservationIds(plan.observations().stream()
                        .map(o -> o.getId().toString())
                        .collect(Collectors.joining(",")))
                .inputNotes(String.join("\n", plan.notes()))
                .inferenceMs(inferenceMs(trajectory, intensity, similarity))
                .build();

        if (trajectory != null) {
            run.setTrajectoryStatus(trajectory.status());
            run.setTrajectoryReason(trajectory.reason());
            run.setTrajectoryConfidence(trajectory.confidence());
            if (trajectory.model() != null) {
                run.setTrajectoryModelName(trajectory.model().name());
                run.setTrajectoryModelVersion(trajectory.model().version());
                run.setTrajectoryFeatureSet(trajectory.model().featureSetVersion());
            }
            if (trajectory.predictedPositions() != null) {
                for (var position : trajectory.predictedPositions()) {
                    if (position.latitude() == null || position.longitude() == null
                            || position.forecastHours() == null) {
                        continue;
                    }
                    run.addTrackPoint(PredictionTrackPoint.builder()
                            .forecastHours(position.forecastHours())
                            .forecastAt(forecastAt(position.timestamp(), plan.baseTime(),
                                    position.forecastHours()))
                            .latitude(position.latitude())
                            .longitude(position.longitude())
                            .uncertaintyRadiusKm(position.uncertaintyRadiusKm())
                            .build());
                }
            }
        }

        if (intensity != null) {
            run.setIntensityStatus(intensity.status());
            run.setIntensityReason(intensity.reason());
            run.setIntensityConfidence(intensity.confidence());
            run.setIntensityTrend(intensity.trend());
            if (intensity.model() != null) {
                run.setIntensityModelName(intensity.model().name());
                run.setIntensityModelVersion(intensity.model().version());
            }
            if (intensity.forecast() != null) {
                for (var point : intensity.forecast()) {
                    if (point.forecastHours() == null) {
                        continue;
                    }
                    run.addIntensityPoint(PredictionIntensityPoint.builder()
                            .forecastHours(point.forecastHours())
                            .forecastAt(forecastAt(null, plan.baseTime(), point.forecastHours()))
                            .windSpeedKph(point.windSpeedKph())
                            .pressureHpa(point.pressureHpa())
                            .build());
                }
            }
        }

        if (similarity != null) {
            run.setSimilarityStatus(similarity.status());
            run.setSimilarityReason(similarity.reason());
            run.setSimilarityConfidence(similarity.confidence());
            if (similarity.model() != null) {
                run.setSimilarityModelName(similarity.model().name());
            }
            if (similarity.similarCyclones() != null && !similarity.similarCyclones().isEmpty()) {
                Map<String, UUID> local = resolveLocally(similarity.similarCyclones());
                for (var match : similarity.similarCyclones()) {
                    if (match.historicalCycloneId() == null || match.rank() == null
                            || match.similarityScore() == null) {
                        continue;
                    }
                    run.addAnalogueMatch(AnalogueMatch.builder()
                            .rankOrder(match.rank())
                            .historicalExternalId(match.historicalCycloneId())
                            .historicalName(match.historicalCycloneName())
                            .seasonYear(match.season())
                            .similarityScore(match.similarityScore())
                            .similarityBasis(match.similarityBasis() == null
                                    ? null : String.join(",", match.similarityBasis()))
                            .matchedCycloneId(local.get(match.historicalCycloneId()))
                            .build());
                }
            }
            if (similarity.analogueForecast() != null) {
                for (var point : similarity.analogueForecast()) {
                    if (point.forecastHours() == null || point.latitude() == null
                            || point.longitude() == null) {
                        continue;
                    }
                    run.addAnalogueForecastPoint(AnalogueForecastPoint.builder()
                            .forecastHours(point.forecastHours())
                            .forecastAt(forecastAt(point.timestamp(), plan.baseTime(),
                                    point.forecastHours()))
                            .latitude(point.latitude())
                            .longitude(point.longitude())
                            .windSpeedKph(point.windSpeedKph())
                            .spreadKm(point.spreadKm())
                            .memberCount(point.memberCount())
                            .build());
                }
            }
        }

        return runs.save(run);
    }

    /**
     * Links analogue storms to their local rows. The AI service returns IBTrACS
     * identifiers and this database is loaded from the same archive, so the
     * match usually resolves — which is what lets the UI open the historical
     * storm's own profile rather than showing a bare id.
     */
    private Map<String, UUID> resolveLocally(
            List<AiAnalysisResponse.SimilarCyclone> matches) {
        List<String> ids = matches.stream()
                .map(AiAnalysisResponse.SimilarCyclone::historicalCycloneId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return cyclones.findByExternalSourceAndExternalIdIn(IbtracsImporter.SOURCE, ids)
                .stream()
                .collect(Collectors.toMap(Cyclone::getExternalId, Cyclone::getId, (a, b) -> a));
    }

    /** Prefer the model's own timestamp; derive it only when absent. */
    private Instant forecastAt(Instant fromModel, Instant baseTime, int forecastHours) {
        return fromModel != null ? fromModel : baseTime.plusSeconds(forecastHours * 3600L);
    }

    private Integer inferenceMs(AiAnalysisResponse.Block... blocks) {
        int total = 0;
        boolean any = false;
        for (AiAnalysisResponse.Block block : blocks) {
            if (block != null && block.model() != null && block.model().inferenceTimeMs() != null) {
                total += block.model().inferenceTimeMs();
                any = true;
            }
        }
        return any ? total : null;
    }

    @Transactional(readOnly = true)
    public Optional<PredictionRunDto> latest(UUID cycloneId) {
        return runs.findFirstByCycloneIdOrderByCreatedAtDesc(cycloneId)
                .map(PredictionRunDto::from);
    }

    @Transactional(readOnly = true)
    public List<PredictionRunDto> history(UUID cycloneId, int limit) {
        return runs.findByCycloneIdOrderByCreatedAtDesc(
                        cycloneId, PageRequest.of(0, Math.min(Math.max(1, limit), 50)))
                .stream()
                .map(PredictionRunDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PredictionRunDto get(UUID runId) {
        return runs.findWithDetailById(runId)
                .map(PredictionRunDto::from)
                .orElseThrow(() -> new ResourceNotFoundException("No prediction run with id " + runId));
    }
}

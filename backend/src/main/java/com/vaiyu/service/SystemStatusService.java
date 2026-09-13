package com.vaiyu.service;

import com.vaiyu.ai.AiServiceClient;
import com.vaiyu.ai.dto.AiHealth;
import com.vaiyu.domain.IntensityScale;
import com.vaiyu.dto.SystemStatusDto;
import com.vaiyu.ingestion.IbtracsImporter;
import com.vaiyu.repository.CycloneObservationRepository;
import com.vaiyu.repository.CycloneRepository;
import com.vaiyu.repository.PredictionRunRepository;
import com.vaiyu.repository.SatelliteAnalysisRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Reports what the system can do right now: which models the AI service has
 * loaded, and how much real data is in the database.
 *
 * <p>This is the backing for the interface telling the truth about itself. A
 * panel that cannot work says why, and a model that is not loaded is named as
 * not loaded rather than quietly producing nothing.
 */
@Service
@Transactional(readOnly = true)
public class SystemStatusService {

    private final AiServiceClient ai;
    private final CycloneRepository cyclones;
    private final CycloneObservationRepository observations;
    private final PredictionRunRepository runs;
    private final SatelliteAnalysisRepository satelliteAnalyses;
    private final IbtracsImporter importer;

    public SystemStatusService(AiServiceClient ai,
                               CycloneRepository cyclones,
                               CycloneObservationRepository observations,
                               PredictionRunRepository runs,
                               SatelliteAnalysisRepository satelliteAnalyses,
                               IbtracsImporter importer) {
        this.ai = ai;
        this.cyclones = cyclones;
        this.observations = observations;
        this.runs = runs;
        this.satelliteAnalyses = satelliteAnalyses;
        this.importer = importer;
    }

    public SystemStatusDto status() {
        Optional<AiHealth> health = ai.health();

        SystemStatusDto.Ai aiStatus = health
                .map(h -> new SystemStatusDto.Ai(
                        true, ai.baseUrl(), h.version(), null, models(h)))
                .orElseGet(() -> new SystemStatusDto.Ai(
                        false, ai.baseUrl(), null,
                        "The AI service did not respond. Forecasting is unavailable until "
                                + "it is running; the archive remains browsable.",
                        Map.of()));

        return new SystemStatusDto(aiStatus, data());
    }

    private Map<String, SystemStatusDto.Model> models(AiHealth health) {
        Map<String, SystemStatusDto.Model> out = new LinkedHashMap<>();
        if (health.models() == null) {
            return out;
        }
        health.models().forEach((key, status) -> out.put(key, new SystemStatusDto.Model(
                Boolean.TRUE.equals(status.available()),
                status.state(),
                status.model(),
                status.version(),
                status.horizons(),
                status.trainedAt(),
                status.reason(),
                status.sources(),
                status.analogueStorms(),
                status.evaluation())));
        return out;
    }

    private SystemStatusDto.Data data() {
        return new SystemStatusDto.Data(
                cyclones.count(),
                observations.count(),
                runs.count(),
                satelliteAnalyses.count(),
                observations.findFirstByOrderByObservedAtDesc()
                        .map(o -> o.getObservedAt())
                        .orElse(null),
                IbtracsImporter.OBSERVATION_SOURCE,
                IntensityScale.SCALE_NAME,
                importer.sourceAvailable(),
                importer.defaultPath());
    }
}

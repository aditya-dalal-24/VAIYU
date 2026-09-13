package com.vaiyu.service;

import com.vaiyu.ai.AiAnalysisOutcome;
import com.vaiyu.ai.AiServiceClient;
import com.vaiyu.ai.dto.AiAnalysisRequest;
import com.vaiyu.ai.dto.AiAnalysisResponse;
import com.vaiyu.dto.SatelliteAnalysisDto;
import com.vaiyu.entity.Cyclone;
import com.vaiyu.entity.CycloneObservation;
import com.vaiyu.entity.SatelliteAnalysis;
import com.vaiyu.exception.AiRequestRejectedException;
import com.vaiyu.exception.AiServiceUnavailableException;
import com.vaiyu.exception.ResourceNotFoundException;
import com.vaiyu.repository.CycloneObservationRepository;
import com.vaiyu.repository.CycloneRepository;
import com.vaiyu.repository.SatelliteAnalysisRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Sends one satellite frame to the vision model and records the answer.
 *
 * <p>Two things here are deliberate and worth stating.
 *
 * <p><strong>A real fix accompanies the image.</strong> The analysis request
 * requires a current observation, so the storm's latest stored fix is sent.
 * That is why an analysis must name a cyclone: without one there would be no
 * position to send, and inventing coordinates to satisfy a schema would be
 * fabricating input.
 *
 * <p><strong>A refusal is stored as a refusal.</strong> No satellite checkpoint
 * has been trained yet, so the expected answer today is NOT_AVAILABLE with a
 * reason, and that is what gets saved. The moment a checkpoint exists this same
 * path returns real detections with the model's own confidence, with no code
 * change.
 */
@Service
public class SatelliteAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(SatelliteAnalysisService.class);

    private final AiServiceClient ai;
    private final CycloneRepository cyclones;
    private final CycloneObservationRepository observations;
    private final SatelliteAnalysisRepository analyses;
    private final SatelliteImageStore images;
    private final boolean allowExternalUrls;

    public SatelliteAnalysisService(AiServiceClient ai,
                                    CycloneRepository cyclones,
                                    CycloneObservationRepository observations,
                                    SatelliteAnalysisRepository analyses,
                                    SatelliteImageStore images,
                                    @Value("${vaiyu.satellite.allow-external-urls:false}")
                                    boolean allowExternalUrls) {
        this.ai = ai;
        this.cyclones = cyclones;
        this.observations = observations;
        this.analyses = analyses;
        this.images = images;
        this.allowExternalUrls = allowExternalUrls;
    }

    @Transactional
    public SatelliteAnalysisDto analyse(
            UUID cycloneId, String imageUrl, String imageType, Instant capturedAt) {

        if (imageUrl == null || imageUrl.isBlank()) {
            throw new IllegalArgumentException("An image URL is required.");
        }
        // Only images this service stored may be analysed. The AI service
        // fetches the URL from inside the network, so accepting an arbitrary
        // one would let any caller make it request internal hosts or a cloud
        // metadata endpoint. A trusted deployment that genuinely needs to
        // analyse external imagery can opt in explicitly.
        if (!allowExternalUrls && !images.isStoredImageUrl(imageUrl)) {
            throw new IllegalArgumentException(
                    "Only images uploaded to this service can be analysed. Upload the frame "
                            + "first and use the URL the upload returns.");
        }
        if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
            throw new IllegalArgumentException(
                    "The image URL must be http or https so the AI service can fetch it.");
        }

        Cyclone cyclone = cyclones.findById(cycloneId)
                .orElseThrow(() -> new ResourceNotFoundException("No cyclone with id " + cycloneId));

        CycloneObservation latest = observations
                .findFirstByCycloneIdOrderByObservedAtDesc(cycloneId)
                .orElseThrow(() -> new IllegalStateException(
                        "This cyclone has no observations, so there is no position to send "
                                + "with the image."));

        AiAnalysisRequest request = new AiAnalysisRequest(
                "cv-sat-" + UUID.randomUUID(),
                cycloneId.toString(),
                List.of(AiAnalysisRequest.SATELLITE),
                new AiAnalysisRequest.Observation(
                        latest.getObservedAt(), latest.getLatitude(), latest.getLongitude(),
                        latest.getWindSpeedKph(), latest.getPressureHpa(), null, null),
                List.of(),
                null,
                new AiAnalysisRequest.SatelliteImage(imageUrl, imageType, capturedAt));

        AiAnalysisOutcome outcome = ai.analyse(request, true);

        if (outcome instanceof AiAnalysisOutcome.Rejected rejected) {
            throw new AiRequestRejectedException(rejected.errorCode(), rejected.detail());
        }
        if (outcome instanceof AiAnalysisOutcome.Unreachable unreachable) {
            throw new AiServiceUnavailableException(unreachable.detail());
        }

        AiAnalysisResponse response = outcome.responseOrNull();
        AiAnalysisResponse.SatelliteAnalysis result =
                response == null ? null : response.satelliteAnalysis();

        SatelliteAnalysis record = SatelliteAnalysis.builder()
                .cyclone(cyclone)
                .imageUrl(imageUrl)
                .imageType(imageType)
                .capturedAt(capturedAt)
                .status(result != null ? result.status() : AiAnalysisResponse.NOT_AVAILABLE)
                .reason(result != null
                        ? result.reason()
                        : "The AI service returned no satellite analysis for this image.")
                .build();

        if (result != null) {
            record.setCycloneDetected(result.cycloneDetected());
            record.setConfidence(result.confidence());
            if (result.cycloneCenter() != null) {
                record.setCenterLatitude(result.cycloneCenter().latitude());
                record.setCenterLongitude(result.cycloneCenter().longitude());
            }
            record.setGradcamUrl(result.gradcamImageUrl());
            if (result.model() != null) {
                record.setModelName(result.model().name());
                record.setModelVersion(result.model().version());
                record.setInferenceMs(result.model().inferenceTimeMs());
            }
        }

        SatelliteAnalysis saved = analyses.save(record);
        log.info("Satellite analysis {} for cyclone {}: {}",
                saved.getId(), cyclone.getExternalId(), saved.getStatus());
        return SatelliteAnalysisDto.from(saved);
    }

    @Transactional(readOnly = true)
    public List<SatelliteAnalysisDto> forCyclone(UUID cycloneId) {
        return analyses.findByCycloneIdOrderByCreatedAtDesc(cycloneId).stream()
                .map(SatelliteAnalysisDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SatelliteAnalysisDto> recent(int limit) {
        return analyses.findAllByOrderByCreatedAtDesc(
                        PageRequest.of(0, Math.min(Math.max(1, limit), 50)))
                .stream()
                .map(SatelliteAnalysisDto::from)
                .toList();
    }
}

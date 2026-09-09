package com.cyclovision.ingestion.service;

import com.cyclovision.entity.Cyclone;
import com.cyclovision.entity.CycloneObservation;
import com.cyclovision.ingestion.dto.ExternalCycloneDto;
import com.cyclovision.ingestion.dto.ExternalObservationDto;
import com.cyclovision.ingestion.provider.CycloneDataProvider;
import com.cyclovision.repository.CycloneObservationRepository;
import com.cyclovision.repository.CycloneRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class CycloneIngestionService {

    private static final Logger logger = LoggerFactory.getLogger(CycloneIngestionService.class);

    private final List<CycloneDataProvider> dataProviders;
    private final CycloneRepository cycloneRepository;
    private final CycloneObservationRepository observationRepository;

    public CycloneIngestionService(List<CycloneDataProvider> dataProviders,
                                   CycloneRepository cycloneRepository,
                                   CycloneObservationRepository observationRepository) {
        this.dataProviders = dataProviders;
        this.cycloneRepository = cycloneRepository;
        this.observationRepository = observationRepository;
    }

    @Transactional
    public void runIngestion() {
        for (CycloneDataProvider provider : dataProviders) {
            String providerName = provider.getProviderName();
            logger.info("Starting ingestion from provider: {}", providerName);

            try {
                List<ExternalCycloneDto> activeCyclones = provider.fetchActiveCyclones();
                for (ExternalCycloneDto extCyclone : activeCyclones) {
                    processCyclone(providerName, extCyclone, provider);
                }
            } catch (Exception e) {
                logger.error("Error during ingestion for provider: " + providerName, e);
            }
        }
    }

    private void processCyclone(String providerName, ExternalCycloneDto extCyclone, CycloneDataProvider provider) {
        String externalId = extCyclone.getExternalId();

        Optional<Cyclone> existingCyclone = cycloneRepository.findByExternalSourceAndExternalId(providerName, externalId);
        Cyclone cyclone;

        if (existingCyclone.isPresent()) {
            cyclone = existingCyclone.get();
            cyclone.setName(extCyclone.getName());
            cyclone.setBasin(extCyclone.getBasin());
            cyclone.setStatus(extCyclone.getStatus());
            cyclone.setCurrentCategory(extCyclone.getCurrentCategory());
        } else {
            cyclone = new Cyclone();
            cyclone.setExternalSource(providerName);
            cyclone.setExternalId(externalId);
            cyclone.setName(extCyclone.getName());
            cyclone.setBasin(extCyclone.getBasin());
            cyclone.setStatus(extCyclone.getStatus());
            cyclone.setCurrentCategory(extCyclone.getCurrentCategory());
        }

        cyclone = cycloneRepository.save(cyclone);

        List<ExternalObservationDto> observations = provider.fetchObservations(externalId);
        for (ExternalObservationDto extObs : observations) {
            processObservation(cyclone, extObs);
        }
    }

    private void processObservation(Cyclone cyclone, ExternalObservationDto extObs) {
        Optional<CycloneObservation> existingObservation = observationRepository.findByCycloneIdAndSourceRecordId(
                cyclone.getId(), extObs.getSourceRecordId()
        );

        CycloneObservation observation;
        if (existingObservation.isPresent()) {
            observation = existingObservation.get();
        } else {
            observation = new CycloneObservation();
            observation.setCyclone(cyclone);
            observation.setSourceRecordId(extObs.getSourceRecordId());
        }

        observation.setObservedAt(extObs.getObservedAt());
        observation.setLatitude(extObs.getLatitude());
        observation.setLongitude(extObs.getLongitude());
        observation.setWindSpeedKph(extObs.getWindSpeedKph());
        observation.setPressureHpa(extObs.getPressureHpa());
        observation.setMovementSpeedKph(extObs.getMovementSpeedKph());
        observation.setMovementDirectionDegrees(extObs.getMovementDirectionDegrees());
        
        String source = extObs.getSource() != null ? extObs.getSource() : cyclone.getExternalSource();
        observation.setSource(source);

        observationRepository.save(observation);
    }
}

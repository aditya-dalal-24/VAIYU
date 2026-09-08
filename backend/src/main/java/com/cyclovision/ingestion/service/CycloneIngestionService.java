package com.cyclovision.ingestion.service;

import com.cyclovision.entity.Cyclone;
import com.cyclovision.entity.CycloneObservation;
import com.cyclovision.ingestion.dto.ExternalCycloneDto;
import com.cyclovision.ingestion.dto.ExternalObservationDto;
import com.cyclovision.ingestion.provider.CycloneDataProvider;
import com.cyclovision.repository.CycloneObservationRepository;
import com.cyclovision.repository.CycloneRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class CycloneIngestionService {

    private final List<CycloneDataProvider> providers;
    private final CycloneRepository cycloneRepository;
    private final CycloneObservationRepository observationRepository;

    public CycloneIngestionService(List<CycloneDataProvider> providers, 
                                   CycloneRepository cycloneRepository, 
                                   CycloneObservationRepository observationRepository) {
        this.providers = providers;
        this.cycloneRepository = cycloneRepository;
        this.observationRepository = observationRepository;
    }

    @Transactional
    public void runIngestion() {
        for (CycloneDataProvider provider : providers) {
            String source = provider.getProviderName();
            List<ExternalCycloneDto> externalCyclones = provider.fetchActiveCyclones();

            for (ExternalCycloneDto extCyc : externalCyclones) {
                // Upsert Cyclone
                Cyclone cyclone = cycloneRepository.findByExternalSourceAndExternalId(source, extCyc.getExternalId())
                        .orElseGet(Cyclone::new);

                cyclone.setExternalSource(source);
                cyclone.setExternalId(extCyc.getExternalId());
                cyclone.setName(extCyc.getName());
                cyclone.setBasin(extCyc.getBasin());
                cyclone.setStatus(extCyc.getStatus());
                cyclone.setCurrentCategory(extCyc.getCurrentCategory());
                
                cyclone = cycloneRepository.save(cyclone);

                // Fetch and upsert observations
                List<ExternalObservationDto> observations = provider.fetchObservations(extCyc.getExternalId());
                for (ExternalObservationDto extObs : observations) {
                    
                    // Basic idempotency check by sourceRecordId if available
                    if (extObs.getSourceRecordId() != null) {
                        Optional<CycloneObservation> existing = observationRepository.findByCycloneIdAndSourceRecordId(
                                cyclone.getId(), extObs.getSourceRecordId());
                        if (existing.isPresent()) {
                            continue; // Skip already ingested observation
                        }
                    }

                    CycloneObservation obs = new CycloneObservation();
                    obs.setCyclone(cyclone);
                    obs.setObservedAt(extObs.getObservedAt());
                    obs.setLatitude(extObs.getLatitude());
                    obs.setLongitude(extObs.getLongitude());
                    obs.setWindSpeedKph(extObs.getWindSpeedKph());
                    obs.setPressureHpa(extObs.getPressureHpa());
                    obs.setMovementSpeedKph(extObs.getMovementSpeedKph());
                    obs.setMovementDirectionDegrees(extObs.getMovementDirectionDegrees());
                    obs.setSource(source);
                    obs.setSourceRecordId(extObs.getSourceRecordId());

                    observationRepository.save(obs);
                }
            }
        }
    }
}

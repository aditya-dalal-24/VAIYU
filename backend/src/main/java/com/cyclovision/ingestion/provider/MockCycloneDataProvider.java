package com.cyclovision.ingestion.provider;

import com.cyclovision.ingestion.dto.ExternalCycloneDto;
import com.cyclovision.ingestion.dto.ExternalObservationDto;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Component
public class MockCycloneDataProvider implements CycloneDataProvider {

    @Override
    public String getProviderName() {
        return "MOCK_PROVIDER";
    }

    @Override
    public List<ExternalCycloneDto> fetchActiveCyclones() {
        List<ExternalCycloneDto> list = new ArrayList<>();
        ExternalCycloneDto cyclone = new ExternalCycloneDto();
        cyclone.setExternalId("MOCK-2026-01");
        cyclone.setName("Mock Cyclone Alpha");
        cyclone.setBasin("Bay of Bengal");
        cyclone.setStatus("ACTIVE");
        cyclone.setCurrentCategory("Severe Cyclonic Storm");
        list.add(cyclone);
        return list;
    }

    @Override
    public List<ExternalObservationDto> fetchObservations(String externalCycloneId) {
        if (!"MOCK-2026-01".equals(externalCycloneId)) {
            return Collections.emptyList();
        }
        
        List<ExternalObservationDto> list = new ArrayList<>();
        Instant now = Instant.now();
        
        ExternalObservationDto obs1 = new ExternalObservationDto();
        obs1.setExternalCycloneId(externalCycloneId);
        obs1.setObservedAt(now.minus(6, ChronoUnit.HOURS));
        obs1.setLatitude(15.2);
        obs1.setLongitude(88.4);
        obs1.setWindSpeedKph(85.0);
        obs1.setPressureHpa(990.0);
        obs1.setMovementSpeedKph(14.0);
        obs1.setMovementDirectionDegrees(315.0);
        obs1.setSourceRecordId("OBS-1");
        list.add(obs1);

        ExternalObservationDto obs2 = new ExternalObservationDto();
        obs2.setExternalCycloneId(externalCycloneId);
        obs2.setObservedAt(now);
        obs2.setLatitude(16.0);
        obs2.setLongitude(87.8);
        obs2.setWindSpeedKph(95.0);
        obs2.setPressureHpa(985.0);
        obs2.setMovementSpeedKph(15.0);
        obs2.setMovementDirectionDegrees(310.0);
        obs2.setSourceRecordId("OBS-2");
        list.add(obs2);

        return list;
    }
}

package com.cyclovision.ingestion.provider;

import com.cyclovision.ingestion.dto.ExternalCycloneDto;
import com.cyclovision.ingestion.dto.ExternalObservationDto;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Component
public class MockCycloneDataProvider implements CycloneDataProvider {

    private static final String CYCLONE_1_ID = "MOCK-2026-01";
    private static final String CYCLONE_2_ID = "MOCK-2026-02";

    @Override
    public String getProviderName() {
        return "MOCK";
    }

    @Override
    public List<ExternalCycloneDto> fetchActiveCyclones() {
        List<ExternalCycloneDto> list = new ArrayList<>();

        ExternalCycloneDto c1 = new ExternalCycloneDto();
        c1.setExternalSource(getProviderName());
        c1.setExternalId(CYCLONE_1_ID);
        c1.setName("Cyclone Alpha");
        c1.setBasin("Bay of Bengal");
        c1.setStatus("ACTIVE");
        c1.setCurrentCategory("Severe Cyclonic Storm");
        list.add(c1);

        ExternalCycloneDto c2 = new ExternalCycloneDto();
        c2.setExternalSource(getProviderName());
        c2.setExternalId(CYCLONE_2_ID);
        c2.setName("Cyclone Beta");
        c2.setBasin("Arabian Sea");
        c2.setStatus("ACTIVE");
        c2.setCurrentCategory("Cyclonic Storm");
        list.add(c2);

        return list;
    }

    @Override
    public List<ExternalObservationDto> fetchObservations(String externalCycloneId) {
        List<ExternalObservationDto> observations = new ArrayList<>();
        
        // Base fixed timestamp for determinism
        Instant baseTime = Instant.parse("2026-09-09T00:00:00Z");

        if (CYCLONE_1_ID.equals(externalCycloneId)) {
            for (int i = 0; i < 5; i++) {
                ExternalObservationDto obs = new ExternalObservationDto();
                obs.setExternalCycloneId(externalCycloneId);
                obs.setObservedAt(baseTime.plusSeconds(i * 3600L * 6)); // every 6 hours
                obs.setLatitude(15.0 + (i * 0.5));
                obs.setLongitude(88.0 - (i * 0.2));
                obs.setWindSpeedKph(80.0 + (i * 10));
                obs.setPressureHpa(995.0 - (i * 5));
                obs.setMovementSpeedKph(12.0 + i);
                obs.setMovementDirectionDegrees(315.0);
                obs.setSource(getProviderName());
                obs.setSourceRecordId(CYCLONE_1_ID + "-OBS-" + i);
                observations.add(obs);
            }
        } else if (CYCLONE_2_ID.equals(externalCycloneId)) {
            for (int i = 0; i < 5; i++) {
                ExternalObservationDto obs = new ExternalObservationDto();
                obs.setExternalCycloneId(externalCycloneId);
                obs.setObservedAt(baseTime.plusSeconds(i * 3600L * 6)); // every 6 hours
                obs.setLatitude(12.0 + (i * 0.3));
                obs.setLongitude(68.0 + (i * 0.4));
                obs.setWindSpeedKph(65.0 + (i * 5));
                obs.setPressureHpa(1000.0 - (i * 3));
                obs.setMovementSpeedKph(10.0 + (i * 0.5));
                obs.setMovementDirectionDegrees(45.0);
                obs.setSource(getProviderName());
                obs.setSourceRecordId(CYCLONE_2_ID + "-OBS-" + i);
                observations.add(obs);
            }
        }

        return observations;
    }
}

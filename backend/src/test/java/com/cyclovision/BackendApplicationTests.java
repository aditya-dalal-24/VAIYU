package com.cyclovision;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import com.cyclovision.repository.*;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
class BackendApplicationTests {

    @Autowired
    private CycloneRepository cycloneRepository;
    @Autowired
    private CycloneObservationRepository observationRepository;
    @Autowired
    private WeatherDataRepository weatherDataRepository;
    @Autowired
    private SatelliteImageRepository satelliteImageRepository;
    @Autowired
    private CyclonePredictionRepository predictionRepository;

    @Test
    void contextLoadsAndRepositoriesAreInitialized() {
        assertNotNull(cycloneRepository);
        assertNotNull(observationRepository);
        assertNotNull(weatherDataRepository);
        assertNotNull(satelliteImageRepository);
        assertNotNull(predictionRepository);
    }
}

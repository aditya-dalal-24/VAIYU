package com.cyclovision.config;

import com.cyclovision.entity.*;
import com.cyclovision.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class DemoDataSeeder implements CommandLineRunner {

    private final CycloneRepository cycloneRepository;
    private final CycloneObservationRepository observationRepository;
    private final HistoricalCycloneRepository historicalRepository;
    private final AlertRepository alertRepository;
    private final PredictionRepository predictionRepository;

    @Override
    public void run(String... args) {
        if (cycloneRepository.count() > 0) return;

        // Seed Active Cyclone Biparjoy
        Cyclone biparjoy = new Cyclone();
        biparjoy.setName("Cyclone Biparjoy");
        biparjoy.setBasin("Arabian Sea");
        biparjoy.setStatus("ACTIVE");
        cycloneRepository.save(biparjoy);

        CycloneObservation obsB1 = new CycloneObservation();
        obsB1.setCyclone(biparjoy);
        obsB1.setObservedAt(Instant.now().minus(48, ChronoUnit.HOURS));
        obsB1.setLatitude(14.2);
        obsB1.setLongitude(66.0);
        obsB1.setWindSpeedKph(90.0);
        obsB1.setPressureHpa(990.0);
        obsB1.setSource("DEMO");
        
        CycloneObservation obsB2 = new CycloneObservation();
        obsB2.setCyclone(biparjoy);
        obsB2.setObservedAt(Instant.now().minus(36, ChronoUnit.HOURS));
        obsB2.setLatitude(15.6);
        obsB2.setLongitude(66.4);
        obsB2.setWindSpeedKph(120.0);
        obsB2.setPressureHpa(978.0);
        obsB2.setSource("DEMO");
        
        CycloneObservation obsB3 = new CycloneObservation();
        obsB3.setCyclone(biparjoy);
        obsB3.setObservedAt(Instant.now().minus(24, ChronoUnit.HOURS));
        obsB3.setLatitude(17.0);
        obsB3.setLongitude(66.9);
        obsB3.setWindSpeedKph(145.0);
        obsB3.setPressureHpa(965.0);
        obsB3.setSource("DEMO");

        CycloneObservation obsB4 = new CycloneObservation();
        obsB4.setCyclone(biparjoy);
        obsB4.setObservedAt(Instant.now().minus(12, ChronoUnit.HOURS));
        obsB4.setLatitude(18.2);
        obsB4.setLongitude(67.3);
        obsB4.setWindSpeedKph(160.0);
        obsB4.setPressureHpa(958.0);
        obsB4.setSource("DEMO");

        CycloneObservation obsB5 = new CycloneObservation();
        obsB5.setCyclone(biparjoy);
        obsB5.setObservedAt(Instant.now());
        obsB5.setLatitude(19.4);
        obsB5.setLongitude(67.8);
        obsB5.setWindSpeedKph(165.0);
        obsB5.setPressureHpa(954.0);
        obsB5.setMovementDirectionDegrees(340.0);
        obsB5.setMovementSpeedKph(14.0);
        obsB5.setSource("DEMO");

        observationRepository.saveAll(List.of(obsB1, obsB2, obsB3, obsB4, obsB5));

        // Seed Active Cyclone Amphan
        Cyclone amphan = new Cyclone();
        amphan.setName("Cyclone Amphan");
        amphan.setBasin("Bay of Bengal");
        amphan.setStatus("ACTIVE");
        cycloneRepository.save(amphan);

        CycloneObservation obsA1 = new CycloneObservation();
        obsA1.setCyclone(amphan);
        obsA1.setObservedAt(Instant.now().minus(36, ChronoUnit.HOURS));
        obsA1.setLatitude(13.0);
        obsA1.setLongitude(86.2);
        obsA1.setWindSpeedKph(110.0);
        obsA1.setPressureHpa(982.0);
        obsA1.setSource("DEMO");

        CycloneObservation obsA2 = new CycloneObservation();
        obsA2.setCyclone(amphan);
        obsA2.setObservedAt(Instant.now().minus(24, ChronoUnit.HOURS));
        obsA2.setLatitude(14.5);
        obsA2.setLongitude(86.3);
        obsA2.setWindSpeedKph(160.0);
        obsA2.setPressureHpa(955.0);
        obsA2.setSource("DEMO");

        CycloneObservation obsA3 = new CycloneObservation();
        obsA3.setCyclone(amphan);
        obsA3.setObservedAt(Instant.now().minus(12, ChronoUnit.HOURS));
        obsA3.setLatitude(16.2);
        obsA3.setLongitude(86.5);
        obsA3.setWindSpeedKph(195.0);
        obsA3.setPressureHpa(930.0);
        obsA3.setSource("DEMO");

        CycloneObservation obsA4 = new CycloneObservation();
        obsA4.setCyclone(amphan);
        obsA4.setObservedAt(Instant.now());
        obsA4.setLatitude(18.2);
        obsA4.setLongitude(86.9);
        obsA4.setWindSpeedKph(215.0);
        obsA4.setPressureHpa(920.0);
        obsA4.setMovementDirectionDegrees(15.0);
        obsA4.setMovementSpeedKph(18.0);
        obsA4.setSource("DEMO");

        observationRepository.saveAll(List.of(obsA1, obsA2, obsA3, obsA4));

        // Seed Historical Cyclones
        historicalRepository.saveAll(List.of(
                HistoricalCyclone.builder().id("fani-2019").name("Cyclone Fani").seasonYear(2019).finalIntensity("Extremely Severe Cyclonic Storm").finalLandfallLocation("Puri, Odisha").impactSummary("Category 4 equivalent landfall near Puri with sustained winds up to 215 km/h; ~1.2M evacuated.").maxWindSpeedKmh(215.0).minPressureHpa(932.0).build(),
                HistoricalCyclone.builder().id("vayu-2019").name("Cyclone Vayu").seasonYear(2019).finalIntensity("Very Severe Cyclonic Storm").finalLandfallLocation("Saurashtra Coast, Gujarat").impactSummary("Skirted Saurashtra coast in Arabian Sea bringing torrential rainfall.").maxWindSpeedKmh(150.0).minPressureHpa(970.0).build(),
                HistoricalCyclone.builder().id("tauktae-2021").name("Cyclone Tauktae").seasonYear(2021).finalIntensity("Extremely Severe Cyclonic Storm").finalLandfallLocation("Una, Gujarat").impactSummary("Paralleled West Coast causing severe damage across Goa, Maharashtra, Gujarat.").maxWindSpeedKmh(185.0).minPressureHpa(950.0).build()
        ));

        // Seed Alerts
        alertRepository.saveAll(List.of(
                Alert.builder().id("alert-1").cycloneId(biparjoy.getId().toString()).cycloneName("Cyclone Biparjoy").severity("Critical").message("High probability of severe landfall along Kutch coastline within 36-48 hours.").issuedAt(LocalDateTime.now()).affectedRegionsJson("[\"Kutch\", \"Dwarka\", \"Morbi\"]").build(),
                Alert.builder().id("alert-2").cycloneId(amphan.getId().toString()).cycloneName("Cyclone Amphan").severity("Warning").message("Extremely high sea surface temperatures driving rapid intensification.").issuedAt(LocalDateTime.now().minusHours(2)).affectedRegionsJson("[\"North 24 Parganas\", \"South 24 Parganas\"]").build()
        ));

        // Seed Prediction
        Prediction pred = Prediction.builder()
                .id("pred-biparjoy-1")
                .cycloneId(biparjoy.getId().toString())
                .generatedAt(LocalDateTime.now())
                .modelVersion("Kalman-XGBoost-v2.1")
                .predictedIntensityTrend("INTENSIFY")
                .confidenceScore(0.88)
                .explanation("SST (>29.5?C) and low vertical wind shear in northern Arabian Sea support further intensification before potential landfall near Kutch.")
                .build();

        pred.setTrajectory(List.of(
                PredictedTrackPoint.builder().id("pt-1").prediction(pred).forecastHour(6).lat(20.1).longCoord(68.2).confidenceRadiusKm(35.0).build(),
                PredictedTrackPoint.builder().id("pt-2").prediction(pred).forecastHour(12).lat(21.0).longCoord(68.7).confidenceRadiusKm(55.0).build(),
                PredictedTrackPoint.builder().id("pt-3").prediction(pred).forecastHour(24).lat(22.3).longCoord(69.4).confidenceRadiusKm(95.0).build(),
                PredictedTrackPoint.builder().id("pt-4").prediction(pred).forecastHour(48).lat(23.8).longCoord(70.3).confidenceRadiusKm(150.0).build()
        ));
        predictionRepository.save(pred);
    }
}

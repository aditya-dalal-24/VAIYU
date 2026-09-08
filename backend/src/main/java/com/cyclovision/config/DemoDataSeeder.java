package com.cyclovision.config;

import com.cyclovision.entity.*;
import com.cyclovision.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

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
        Cyclone biparjoy = Cyclone.builder()
                .id("cyclone-biparjoy-2023")
                .name("Cyclone Biparjoy")
                .basin("Arabian Sea")
                .seasonYear(2023)
                .status("ACTIVE")
                .createdAt(LocalDateTime.now().minusDays(3))
                .build();
        cycloneRepository.save(biparjoy);

        List<CycloneObservation> biparjoyObs = List.of(
                CycloneObservation.builder().id("obs-b-1").cyclone(biparjoy).observedAt(LocalDateTime.now().minusHours(48)).lat(14.2).longCoord(66.0).windSpeedKmh(90.0).pressureHpa(990.0).intensityCategory("Cyclonic Storm").build(),
                CycloneObservation.builder().id("obs-b-2").cyclone(biparjoy).observedAt(LocalDateTime.now().minusHours(36)).lat(15.6).longCoord(66.4).windSpeedKmh(120.0).pressureHpa(978.0).intensityCategory("Severe Cyclonic Storm").build(),
                CycloneObservation.builder().id("obs-b-3").cyclone(biparjoy).observedAt(LocalDateTime.now().minusHours(24)).lat(17.0).longCoord(66.9).windSpeedKmh(145.0).pressureHpa(965.0).intensityCategory("Very Severe Cyclonic Storm").build(),
                CycloneObservation.builder().id("obs-b-4").cyclone(biparjoy).observedAt(LocalDateTime.now().minusHours(12)).lat(18.2).longCoord(67.3).windSpeedKmh(160.0).pressureHpa(958.0).intensityCategory("Very Severe Cyclonic Storm").build(),
                CycloneObservation.builder().id("obs-b-5").cyclone(biparjoy).observedAt(LocalDateTime.now()).lat(19.4).longCoord(67.8).windSpeedKmh(165.0).pressureHpa(954.0).movementDirectionDeg(340.0).movementSpeedKmh(14.0).intensityCategory("Very Severe Cyclonic Storm").build()
        );
        observationRepository.saveAll(biparjoyObs);

        // Seed Active Cyclone Amphan
        Cyclone amphan = Cyclone.builder()
                .id("cyclone-amphan-2020")
                .name("Cyclone Amphan")
                .basin("Bay of Bengal")
                .seasonYear(2020)
                .status("ACTIVE")
                .createdAt(LocalDateTime.now().minusDays(3))
                .build();
        cycloneRepository.save(amphan);

        List<CycloneObservation> amphanObs = List.of(
                CycloneObservation.builder().id("obs-a-1").cyclone(amphan).observedAt(LocalDateTime.now().minusHours(36)).lat(13.0).longCoord(86.2).windSpeedKmh(110.0).pressureHpa(982.0).intensityCategory("Severe Cyclonic Storm").build(),
                CycloneObservation.builder().id("obs-a-2").cyclone(amphan).observedAt(LocalDateTime.now().minusHours(24)).lat(14.5).longCoord(86.3).windSpeedKmh(160.0).pressureHpa(955.0).intensityCategory("Very Severe Cyclonic Storm").build(),
                CycloneObservation.builder().id("obs-a-3").cyclone(amphan).observedAt(LocalDateTime.now().minusHours(12)).lat(16.2).longCoord(86.5).windSpeedKmh(195.0).pressureHpa(930.0).intensityCategory("Extremely Severe Cyclonic Storm").build(),
                CycloneObservation.builder().id("obs-a-4").cyclone(amphan).observedAt(LocalDateTime.now()).lat(18.2).longCoord(86.9).windSpeedKmh(215.0).pressureHpa(920.0).movementDirectionDeg(15.0).movementSpeedKmh(18.0).intensityCategory("Super Cyclonic Storm").build()
        );
        observationRepository.saveAll(amphanObs);

        // Seed Historical Cyclones
        historicalRepository.saveAll(List.of(
                HistoricalCyclone.builder().id("fani-2019").name("Cyclone Fani").seasonYear(2019).finalIntensity("Extremely Severe Cyclonic Storm").finalLandfallLocation("Puri, Odisha").impactSummary("Category 4 equivalent landfall near Puri with sustained winds up to 215 km/h; ~1.2M evacuated.").maxWindSpeedKmh(215.0).minPressureHpa(932.0).build(),
                HistoricalCyclone.builder().id("vayu-2019").name("Cyclone Vayu").seasonYear(2019).finalIntensity("Very Severe Cyclonic Storm").finalLandfallLocation("Saurashtra Coast, Gujarat").impactSummary("Skirted Saurashtra coast in Arabian Sea bringing torrential rainfall.").maxWindSpeedKmh(150.0).minPressureHpa(970.0).build(),
                HistoricalCyclone.builder().id("tauktae-2021").name("Cyclone Tauktae").seasonYear(2021).finalIntensity("Extremely Severe Cyclonic Storm").finalLandfallLocation("Una, Gujarat").impactSummary("Paralleled West Coast causing severe damage across Goa, Maharashtra, Gujarat.").maxWindSpeedKmh(185.0).minPressureHpa(950.0).build()
        ));

        // Seed Alerts
        alertRepository.saveAll(List.of(
                Alert.builder().id("alert-1").cycloneId(biparjoy.getId()).cycloneName("Cyclone Biparjoy").severity("Critical").message("High probability of severe landfall along Kutch coastline within 36-48 hours.").issuedAt(LocalDateTime.now()).affectedRegionsJson("[\"Kutch\", \"Dwarka\", \"Morbi\"]").build(),
                Alert.builder().id("alert-2").cycloneId(amphan.getId()).cycloneName("Cyclone Amphan").severity("Warning").message("Extremely high sea surface temperatures driving rapid intensification.").issuedAt(LocalDateTime.now().minusHours(2)).affectedRegionsJson("[\"North 24 Parganas\", \"South 24 Parganas\"]").build()
        ));

        // Seed Prediction
        Prediction pred = Prediction.builder()
                .id("pred-biparjoy-1")
                .cycloneId(biparjoy.getId())
                .generatedAt(LocalDateTime.now())
                .modelVersion("Kalman-XGBoost-v2.1")
                .predictedIntensityTrend("INTENSIFY")
                .confidenceScore(0.88)
                .explanation("SST (>29.5°C) and low vertical wind shear in northern Arabian Sea support further intensification before potential landfall near Kutch.")
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

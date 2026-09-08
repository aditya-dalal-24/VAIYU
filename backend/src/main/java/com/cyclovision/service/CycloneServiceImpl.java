package com.cyclovision.service;

import com.cyclovision.dto.CycloneDetailResponse;
import com.cyclovision.dto.CycloneObservationResponse;
import com.cyclovision.dto.CycloneSummaryResponse;
import com.cyclovision.entity.Cyclone;
import com.cyclovision.entity.CycloneObservation;
import com.cyclovision.exception.ResourceNotFoundException;
import com.cyclovision.repository.CycloneObservationRepository;
import com.cyclovision.repository.CycloneRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class CycloneServiceImpl implements CycloneService {

    private final CycloneRepository cycloneRepository;
    private final CycloneObservationRepository observationRepository;

    public CycloneServiceImpl(CycloneRepository cycloneRepository, CycloneObservationRepository observationRepository) {
        this.cycloneRepository = cycloneRepository;
        this.observationRepository = observationRepository;
    }

    @Override
    public List<CycloneSummaryResponse> getAllCyclones(String status) {
        List<Cyclone> cyclones;
        if (status != null && !status.trim().isEmpty()) {
            cyclones = cycloneRepository.findByStatus(status);
        } else {
            cyclones = cycloneRepository.findAll();
        }
        return cyclones.stream().map(this::mapToSummary).collect(Collectors.toList());
    }

    @Override
    public List<CycloneSummaryResponse> getActiveCyclones() {
        return getAllCyclones("ACTIVE");
    }

    @Override
    public CycloneDetailResponse getCycloneById(UUID id) {
        Cyclone cyclone = cycloneRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cyclone not found: " + id));

        CycloneDetailResponse response = mapToDetail(cyclone);

        Optional<CycloneObservation> latestObs = observationRepository.findFirstByCycloneIdOrderByObservedAtDesc(id);
        latestObs.ifPresent(obs -> response.setLatestObservation(mapToObservation(obs)));

        return response;
    }

    @Override
    public List<CycloneObservationResponse> getCycloneObservations(UUID id) {
        if (!cycloneRepository.existsById(id)) {
            throw new ResourceNotFoundException("Cyclone not found: " + id);
        }
        List<CycloneObservation> observations = observationRepository.findByCycloneIdOrderByObservedAtAsc(id);
        return observations.stream().map(this::mapToObservation).collect(Collectors.toList());
    }

    private CycloneSummaryResponse mapToSummary(Cyclone c) {
        CycloneSummaryResponse dto = new CycloneSummaryResponse();
        dto.setId(c.getId());
        dto.setExternalSource(c.getExternalSource());
        dto.setExternalId(c.getExternalId());
        dto.setName(c.getName());
        dto.setBasin(c.getBasin());
        dto.setStatus(c.getStatus());
        dto.setCurrentCategory(c.getCurrentCategory());
        dto.setCreatedAt(c.getCreatedAt());
        dto.setUpdatedAt(c.getUpdatedAt());
        return dto;
    }

    private CycloneDetailResponse mapToDetail(Cyclone c) {
        CycloneDetailResponse dto = new CycloneDetailResponse();
        dto.setId(c.getId());
        dto.setExternalSource(c.getExternalSource());
        dto.setExternalId(c.getExternalId());
        dto.setName(c.getName());
        dto.setBasin(c.getBasin());
        dto.setStatus(c.getStatus());
        dto.setCurrentCategory(c.getCurrentCategory());
        dto.setCreatedAt(c.getCreatedAt());
        dto.setUpdatedAt(c.getUpdatedAt());
        return dto;
    }

    private CycloneObservationResponse mapToObservation(CycloneObservation obs) {
        CycloneObservationResponse dto = new CycloneObservationResponse();
        dto.setId(obs.getId());
        dto.setObservedAt(obs.getObservedAt());
        dto.setLatitude(obs.getLatitude());
        dto.setLongitude(obs.getLongitude());
        dto.setWindSpeedKph(obs.getWindSpeedKph());
        dto.setPressureHpa(obs.getPressureHpa());
        dto.setMovementSpeedKph(obs.getMovementSpeedKph());
        dto.setMovementDirectionDegrees(obs.getMovementDirectionDegrees());
        dto.setSource(obs.getSource());
        return dto;
    }
}

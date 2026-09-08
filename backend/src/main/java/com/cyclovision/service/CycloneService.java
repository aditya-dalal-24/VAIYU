package com.cyclovision.service;

import com.cyclovision.entity.Cyclone;
import com.cyclovision.entity.CycloneObservation;
import com.cyclovision.repository.CycloneObservationRepository;
import com.cyclovision.repository.CycloneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CycloneService {

    private final CycloneRepository cycloneRepository;
    private final CycloneObservationRepository observationRepository;

    public List<Cyclone> getActiveCyclones() {
        List<Cyclone> active = cycloneRepository.findByStatus("ACTIVE");
        active.forEach(c -> {
            List<CycloneObservation> obs = observationRepository.findByCycloneIdOrderByObservedAtAsc(c.getId());
            if (!obs.isEmpty()) {
                c.setObservations(obs);
            }
        });
        return active;
    }

    public Optional<Cyclone> getCycloneById(String id) {
        Optional<Cyclone> cycloneOpt = cycloneRepository.findById(id);
        cycloneOpt.ifPresent(c -> {
            List<CycloneObservation> obs = observationRepository.findByCycloneIdOrderByObservedAtAsc(c.getId());
            c.setObservations(obs);
        });
        return cycloneOpt;
    }

    public List<CycloneObservation> getCycloneObservations(String cycloneId) {
        return observationRepository.findByCycloneIdOrderByObservedAtAsc(cycloneId);
    }
}

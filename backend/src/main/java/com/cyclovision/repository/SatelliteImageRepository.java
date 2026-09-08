package com.cyclovision.repository;

import com.cyclovision.entity.SatelliteImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SatelliteImageRepository extends JpaRepository<SatelliteImage, UUID> {
    List<SatelliteImage> findByCycloneIdOrderByCapturedAtDesc(UUID cycloneId);
    Optional<SatelliteImage> findFirstByCycloneIdOrderByCapturedAtDesc(UUID cycloneId);
}

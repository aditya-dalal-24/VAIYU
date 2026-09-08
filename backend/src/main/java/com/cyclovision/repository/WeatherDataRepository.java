package com.cyclovision.repository;

import com.cyclovision.entity.WeatherData;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WeatherDataRepository extends JpaRepository<WeatherData, UUID> {
    List<WeatherData> findByCycloneIdOrderByMeasuredAtDesc(UUID cycloneId);
    Optional<WeatherData> findFirstByCycloneIdOrderByMeasuredAtDesc(UUID cycloneId);
}

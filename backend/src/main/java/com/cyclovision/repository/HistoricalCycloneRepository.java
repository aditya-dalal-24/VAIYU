package com.cyclovision.repository;

import com.cyclovision.entity.HistoricalCyclone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface HistoricalCycloneRepository extends JpaRepository<HistoricalCyclone, String> {
}

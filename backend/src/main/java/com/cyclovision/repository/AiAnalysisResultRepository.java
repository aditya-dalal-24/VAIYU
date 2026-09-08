package com.cyclovision.repository;

import com.cyclovision.entity.AiAnalysisResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface AiAnalysisResultRepository extends JpaRepository<AiAnalysisResult, String> {
    Optional<AiAnalysisResult> findFirstByCycloneIdOrderByGeneratedAtDesc(String cycloneId);
}

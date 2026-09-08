package com.cyclovision.repository;

import com.cyclovision.entity.SimilarityResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SimilarityResultRepository extends JpaRepository<SimilarityResult, String> {
    List<SimilarityResult> findByCycloneIdOrderByRankOrderAsc(String cycloneId);
}

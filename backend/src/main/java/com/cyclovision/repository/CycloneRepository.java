package com.cyclovision.repository;

import com.cyclovision.entity.Cyclone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CycloneRepository extends JpaRepository<Cyclone, UUID> {

    List<Cyclone> findByStatus(String status);

    Optional<Cyclone> findByExternalSourceAndExternalId(
            String externalSource,
            String externalId
    );
}
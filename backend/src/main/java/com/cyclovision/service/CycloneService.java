package com.cyclovision.service;

import com.cyclovision.dto.CycloneDetailResponse;
import com.cyclovision.dto.CycloneObservationResponse;
import com.cyclovision.dto.CycloneSummaryResponse;

import java.util.List;
import java.util.UUID;

public interface CycloneService {

    List<CycloneSummaryResponse> getAllCyclones(String status);

    List<CycloneSummaryResponse> getActiveCyclones();

    CycloneDetailResponse getCycloneById(UUID id);

    List<CycloneObservationResponse> getCycloneObservations(UUID id);
}
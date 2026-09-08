package com.cyclovision.ingestion.provider;

import com.cyclovision.ingestion.dto.ExternalCycloneDto;
import com.cyclovision.ingestion.dto.ExternalObservationDto;

import java.util.List;

public interface CycloneDataProvider {
    String getProviderName();
    List<ExternalCycloneDto> fetchActiveCyclones();
    List<ExternalObservationDto> fetchObservations(String externalCycloneId);
}

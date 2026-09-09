package com.cyclovision.ingestion.provider;

import com.cyclovision.ingestion.dto.ExternalCycloneDto;
import com.cyclovision.ingestion.dto.ExternalObservationDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class IbtracsDataProvider implements CycloneDataProvider {

    private static final Logger logger = LoggerFactory.getLogger(IbtracsDataProvider.class);
    private final ObjectMapper objectMapper;

    private List<ExternalCycloneDto> cachedCyclones = new ArrayList<>();
    private Map<String, List<ExternalObservationDto>> observationsMap = new HashMap<>();
    private boolean loaded = false;

    public IbtracsDataProvider(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String getProviderName() {
        return "IBTrACS";
    }

    private synchronized void ensureLoaded() {
        if (loaded) return;
        try {
            logger.info("Loading IBTrACS dataset into memory...");
            
            // Load Cyclones
            try (InputStream is = new ClassPathResource("data/cyclones.json").getInputStream()) {
                JsonNode root = objectMapper.readTree(is);
                for (JsonNode node : root) {
                    ExternalCycloneDto dto = new ExternalCycloneDto();
                    dto.setExternalSource(getProviderName());
                    dto.setExternalId(node.path("id").asText());
                    dto.setName(node.path("name").asText());
                    dto.setBasin(node.path("basin").asText());
                    dto.setStatus(node.path("status").asText());
                    // Note: 'season_year' is excluded to avoid schema changes.
                    // 'currentCategory' is left null as there isn't a direct equivalent in the JSON cyclone object.
                    cachedCyclones.add(dto);
                }
            }

            // Load Observations
            try (InputStream is = new ClassPathResource("data/observations.json").getInputStream()) {
                JsonNode root = objectMapper.readTree(is);
                for (JsonNode node : root) {
                    ExternalObservationDto dto = new ExternalObservationDto();
                    String cycloneId = node.path("cyclone_id").asText();
                    dto.setExternalCycloneId(cycloneId);
                    
                    String observedAtStr = node.path("observed_at").asText();
                    dto.setObservedAt(Instant.parse(observedAtStr));
                    
                    if (!node.path("latitude").isNull()) {
                        dto.setLatitude(node.path("latitude").asDouble());
                    }
                    if (!node.path("longitude").isNull()) {
                        dto.setLongitude(node.path("longitude").asDouble());
                    }
                    if (!node.path("wind_speed_kmh").isNull()) {
                        dto.setWindSpeedKph(node.path("wind_speed_kmh").asDouble());
                    }
                    if (!node.path("pressure_hpa").isNull()) {
                        dto.setPressureHpa(node.path("pressure_hpa").asDouble());
                    }
                    if (!node.path("movement_direction_deg").isNull()) {
                        dto.setMovementDirectionDegrees(node.path("movement_direction_deg").asDouble());
                    }
                    if (!node.path("movement_speed_kmh").isNull()) {
                        dto.setMovementSpeedKph(node.path("movement_speed_kmh").asDouble());
                    }
                    
                    dto.setSource(getProviderName());
                    // Creating a stable sourceRecordId from cyclone_id and timestamp
                    dto.setSourceRecordId(cycloneId + "-" + observedAtStr);
                    
                    observationsMap.computeIfAbsent(cycloneId, k -> new ArrayList<>()).add(dto);
                }
            }
            
            loaded = true;
            logger.info("Loaded {} cyclones and {} observations from IBTrACS", 
                cachedCyclones.size(), 
                observationsMap.values().stream().mapToInt(List::size).sum());
                
        } catch (Exception e) {
            logger.error("Failed to load IBTrACS data", e);
        }
    }

    @Override
    public List<ExternalCycloneDto> fetchActiveCyclones() {
        ensureLoaded();
        return cachedCyclones;
    }

    @Override
    public List<ExternalObservationDto> fetchObservations(String externalCycloneId) {
        ensureLoaded();
        return observationsMap.getOrDefault(externalCycloneId, Collections.emptyList());
    }
}

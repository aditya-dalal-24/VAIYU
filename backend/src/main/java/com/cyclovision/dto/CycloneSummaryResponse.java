package com.cyclovision.dto;

import java.time.Instant;
import java.util.UUID;

public class CycloneSummaryResponse {
    private UUID id;
    private String externalSource;
    private String externalId;
    private String name;
    private String basin;
    private String status;
    private String currentCategory;
    private Instant createdAt;
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getExternalSource() { return externalSource; }
    public void setExternalSource(String externalSource) { this.externalSource = externalSource; }
    public String getExternalId() { return externalId; }
    public void setExternalId(String externalId) { this.externalId = externalId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getBasin() { return basin; }
    public void setBasin(String basin) { this.basin = basin; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getCurrentCategory() { return currentCategory; }
    public void setCurrentCategory(String currentCategory) { this.currentCategory = currentCategory; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}

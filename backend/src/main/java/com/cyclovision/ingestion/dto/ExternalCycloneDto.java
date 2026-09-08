package com.cyclovision.ingestion.dto;

public class ExternalCycloneDto {
    private String externalId;
    private String name;
    private String basin;
    private String status;
    private String currentCategory;

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
}

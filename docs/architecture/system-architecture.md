# CycloVision System Architecture

## Architecture Rules

1. Frontend communicates **only** with Spring Boot.
2. Frontend does **not** directly access PostgreSQL.
3. Frontend does **not** directly communicate with FastAPI.
4. Spring Boot is the central application backend.
5. Spring Boot communicates with FastAPI for AI/ML operations.
6. FastAPI remains focused solely on AI/ML processing.
7. Database access is handled entirely through Spring Boot.

## Core Flow

```text
React Frontend
        ↓ REST API
Spring Boot Backend
        ↓              ↓
Neon PostgreSQL      FastAPI AI Service
```

## Future Intended Flows (Not yet implemented)

### Data Ingestion Flow
```text
External Data Sources
        ↓
Data Ingestion
        ↓
Database
        ↓
Spring Boot
        ↓
Frontend
```

### Prediction Flow
```text
Cyclone Observations
        ↓
Spring Boot
        ↓
FastAPI AI
        ↓
Prediction
        ↓
Spring Boot
        ↓
Frontend
```

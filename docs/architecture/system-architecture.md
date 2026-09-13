# VAIYU System Architecture

## Architecture Rules

1. Frontend communicates **only** with Spring Boot.
2. Frontend does **not** directly access PostgreSQL.
3. Frontend does **not** directly communicate with FastAPI.
4. Spring Boot is the central application backend.
5. Spring Boot communicates with FastAPI for AI/ML operations.
6. FastAPI remains focused solely on AI/ML processing.
7. Database access is handled entirely through Spring Boot.

Rule 3 is the one that shapes the rest. Because the browser cannot reach the AI
service, every model output must pass through Spring Boot, which is therefore
the only place that decides what is fit to show, records what was asked and
persists the answer. The AI service can be restarted, retrained or stopped
without the console losing its history.

## Core Flow

```text
React console (TanStack Start)         :5173
        ↓ REST
Spring Boot 3.2.4 / Java 17            :8081
        ↓ JPA + Flyway      ↓ RestClient
PostgreSQL "vaiyu"          FastAPI AI service      :8000
                                    ↓
                            PyTorch checkpoints
                              trajectory, intensity, analogue index
```

## Data ingestion

Implemented. `POST /api/internal/ingest/ibtracs`.

```text
IBTrACS v04r01 (NOAA/NCEI)
        ↓ ai-service/training/prepare_ibtracs.py
data/processed/observations.csv
        ↓ IbtracsImporter (JdbcTemplate batch upsert)
PostgreSQL
        ↓ CycloneQueryService
Frontend
```

The CSV is the same table the models were trained on, so what the models are
asked at inference matches what they learned from. Upserts key on
`(external_source, external_id)`, which makes re-running after a retrain safe.

## Prediction

Implemented. `POST /api/v1/cyclones/{id}/forecast`.

```text
Stored observations
        ↓ AiRequestFactory: synoptic fixes at or before the base time,
        ↓ 3 minimum, 12 maximum, nothing after the base fix
FastAPI AI service
        ↓ trajectory / intensity / analogue inference
PredictionRun + track, intensity and analogue points
        ↓ persisted with the base fix and the observation ids used
Frontend
```

Bounding the input at the base fix is what makes a stored run verifiable
afterwards: the run records which fixes it saw, so a reader can confirm the
forecast predates the outcome it is being scored against.

Status codes carry meaning and the console depends on them: 422 the storm's
data cannot support a forecast, 503 the AI service or model is unavailable, 204
no run has been made for this storm yet, 404 no such storm.

## Storm DNA

Implemented. `GET /api/v1/cyclones/{id}/dna`.

```text
Stored observations
        ↓ StormSignature: nine traits measured per storm
Archive index (built once per ingest, held in memory)
        ↓ standardised Euclidean distance over shared traits
Nearest neighbours
        ↓
Frontend
```

No model and no AI service is involved, which is why it works for every storm
in the archive including those never forecast. The index is rebuilt when the
stored fix count changes, so a newly ingested season is never silently missing
from the comparison.

## Seasonal activity

Implemented. `GET /api/v1/cyclones/seasons?basin=NI`.

One row per season and sub-basin: storms that reached 34 kt, their combined
Accumulated Cyclone Energy, and the strongest storm. Computed in the database
with a native query, because ACE is a squared sum over fixes and naming the
strongest storm needs a per-group ordering. The 34 kt floor is written as
62.9 kph, not 63: 34 kt is 62.968 kph, and a fix reported at exactly 34 kt
would otherwise fall out of the season it belongs to.

## Not implemented

- Satellite inference has an architecture, a training pipeline and source
  conditioning, but no checkpoint for the current architecture, so it reports
  `NOT_AVAILABLE` with a reason.
- Humidity and wind shear are accepted by the model interface and joined to
  nothing, so those features stay flagged absent. Sea-surface temperature *is*
  joined — NOAA ERSST v5 monthly means, sampled per fix by
  `ai-service/training/prepare_sst.py`, stored in
  `cyclone_observations.sea_surface_temperature_c` (V5), and sent by
  `AiRequestFactory` from the base fix. It is a monthly mean on a 2° grid, so it
  describes the water mass a storm crossed rather than the water under its
  core.

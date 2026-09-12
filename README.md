# VAIYU — Tropical Cyclone Intelligence

VAIYU is a cyclone mission-control console. It reads the IBTrACS best-track
archive, forecasts a storm's track and intensity with trained neural models,
finds the historical storms whose recent behaviour most resembles it, and shows
all three on one map with the provenance of every number made explicit.

Its governing rule is that nothing on screen is invented. A value that was
measured, a value a model produced, and a value nobody has are drawn
differently, and the third is drawn as `—` rather than filled in with something
plausible. Where a capability is missing — satellite analysis has no trained
checkpoint on this machine — the interface says so and explains why, instead of
showing a confident-looking placeholder.

```text
React console (TanStack Start, Leaflet)      :5173
        |  REST, the only network call the browser makes
        v
Spring Boot 3.2.4 / Java 17                  :8081
        |                     \
        | JPA + Flyway         \  RestClient, server-to-server only
        v                       v
PostgreSQL "vaiyu"              FastAPI AI service            :8000
  3,829 storms                         |
  90,537 fixes                         v
  stored model runs             PyTorch checkpoints
                                  trajectory GRU
                                  intensity GRU
                                  analogue index
```

The browser never talks to the AI service. Spring Boot owns orchestration,
validation, persistence and every decision about what is fit to show, so the
Python service can be restarted, retrained or taken down without the console
losing its history.

## The data

| | |
| --- | --- |
| Source | IBTrACS v04r01, NOAA/NCEI best-track archive |
| Wind column | `USA_WIND`, 1-minute sustained |
| Fixes | Synoptic only — 00/06/12/18Z |
| Span | 1980 – 2026, 3,829 storms, 90,537 fixes |
| Basins | WP 1226, EP 699, SI 673, NA 654, SP 409, NI 167, SA 1 |
| Scale | Saffir-Simpson, which is defined for 1-minute winds |

Two choices in that table are load-bearing. `USA_WIND` is used alone because
`WMO_WIND` mixes 1-, 3- and 10-minute averaging periods between agencies, so
comparing its values across basins compares different quantities. And only
synoptic rows are kept because IBTrACS interpolates the intermediate 3-hourly
rows from fixes on both sides — including later ones. Training on those rows let
the model read forward in time, and they were 42% of the original table.

## The models

Measured on held-out **storms**, never held-out rows: every fix of a storm is
in exactly one split, so nothing is scored against a storm it trained on.

**Track** — GRU over up to 12 past fixes, 20 features per step.

| Horizon | Mean error | Persistence | Linear extrapolation |
| --- | --- | --- | --- |
| +6h | 28.8 km | 105.1 km | 31.8 km |
| +12h | 62.8 km | 205.8 km | 72.4 km |
| +24h | 146.6 km | 396.4 km | 175.5 km |

**Intensity** — same encoder, wind and pressure regression plus a three-class
trend head.

| Horizon | Wind MAE | Persistence | Pressure MAE | Persistence |
| --- | --- | --- | --- | --- |
| +6h | 6.4 kph | 8.3 kph | 2.5 hPa | 3.2 hPa |
| +12h | 11.3 kph | 15.8 kph | 4.4 hPa | 6.0 hPa |
| +24h | 19.8 kph | 28.6 kph | 7.8 hPa | 11.0 hPa |

Trend accuracy 65.9% against a 36.9% majority-class baseline.

**Analogue ensemble** — nearest neighbours over 69,984 track windows from 3,675
storms, matched on recent curvature rather than absolute displacement, with the
ten closest averaged into an independent second forecast. It carries a real
caveat: at +24h it beats linear extrapolation (160.9 vs 167.7 km) but at +6h it
does not (30.3 vs 29.8 km), and it is behind the neural track model at every
horizon. It is in the product because a forecast built only from named past
storms is inspectable in a way a network's output is not, and because the
spread across its members is an honest, if weak, uncertainty signal
(spread/error correlation ≈ 0.30).

**Storm DNA** — the one analysis here with no model in it. A storm's whole
life is reduced to nine measured traits — how long it lasted, how strong and
how quickly it got there, how far, how fast and how crookedly it travelled,
where it formed and how far poleward it went — and compared with every other
storm in the archive by standardised Euclidean distance. It is not the analogue
ensemble: that matches the last 24 hours to forecast the next 24, while this
compares completed lives and forecasts nothing. Nearest neighbours are reported
with the distance and the number of traits it was computed from, because a
distance over four traits is not the same claim as one over nine.

**Satellite** — architecture, training pipeline and source-conditioning are
complete, but no checkpoint for the current architecture exists on this machine,
so every satellite request returns `NOT_AVAILABLE` with a reason. An earlier
ResNet-18 checkpoint under `ai-service/trained_models/` predates the
source-conditioned architecture and deliberately fails to load rather than
loading partially.

Baselines matter more than the headline numbers. Persistence and linear
extrapolation are what a forecaster gets for free, so a model is only worth
running if it beats them — and the honest margin over linear extrapolation at
+24h is 10–20% by basin, not the multiple that a comparison against persistence
alone would suggest.

## Running it

**Prerequisites:** Java 17, Maven, Node 20+, Python 3.11+, PostgreSQL 14+.

### 1. Database

```sql
CREATE DATABASE vaiyu;
```

Flyway creates and migrates the schema on first backend start; JPA runs with
`ddl-auto: validate`, so the entities are checked against the migrations rather
than silently reshaping them.

### 2. AI service

```bash
cd ai-service
pip install -r requirements.txt
python app/main.py                  # http://localhost:8000
```

Checkpoints are not committed — they are large and reproducible. With none
present the service still starts and reports every analysis as `NOT_AVAILABLE`
with a reason. To produce them, follow *Training from scratch* in
[`ai-service/README.md`](ai-service/README.md); that also writes
`data/processed/observations.csv`, which the backend ingests.

### 3. Backend

Create `backend/.env`:

```properties
SERVER_PORT=8081
DB_URL=jdbc:postgresql://localhost:5432/vaiyu
DB_USERNAME=postgres
DB_PASSWORD=your_password
AI_SERVICE_URL=http://localhost:8000
```

```bash
cd backend
mvn spring-boot:run                 # http://localhost:8081
```

Port 8081 rather than 8080, which is too often already taken by something else.

### 4. Load the archive

```bash
curl -X POST http://localhost:8081/api/internal/ingest/ibtracs
```

Reads `ai-service/data/processed/observations.csv` and upserts storms and fixes,
so it is safe to re-run after a retrain. Roughly 25 seconds for 90,537 fixes.
Storms are marked `ARCHIVED` or `RECENT` — never `ACTIVE`, because this archive
is not a live feed and labelling it one would misrepresent it.

### 5. Frontend

```bash
cd frontend
npm install
npm run dev                         # http://localhost:5173
```

Set `VITE_API_BASE_URL` in `frontend/.env.local` if the backend is not on
`http://localhost:8081`.

## The console

| Screen | What it is for |
| --- | --- |
| **Mission Control** | One storm in full: track, scrubbable lifecycle, selected fix, data quality, and the panel that runs the models. |
| **Explorer** | The whole archive — search, basin and season filters, sorting by intensity or recency. |
| **Storm profile** | Every fix as numbers, the storm's DNA, and the history of model runs made against that storm. |
| **Prediction Lab** | Rewind a storm to an earlier fix, run the models on what was knowable then, reveal what happened, and score the forecast against persistence, linear extrapolation and the analogue ensemble. |
| **Satellite** | Frame analysis. Currently an explained unavailable state. |
| **System** | Live pipeline state: which models are loaded, how much data is stored, what is missing and why. |

The Prediction Lab is the screen that justifies the rest. A forecast that cannot
be checked is a claim; the Lab only ever forecasts from a fix that predates the
outcome it is then scored against, and every stored run records its base fix and
the observation ids it used, so that ordering stays verifiable after the fact.

## Deliberately absent

- **Risk, impact and evacuation scoring.** These need coastline geometry,
  population exposure and infrastructure data that this project does not have.
  A number computed without them would look authoritative and mean nothing.
- **Live storm feeds and alerting.** The archive ends at its last fix. Nothing
  here is a warning product.
- **Explainability heatmaps.** The extension point exists; no model here
  produces attributions yet.

## Tests

```bash
cd backend    && mvn test           # 35
cd ai-service && python -m pytest   # 305
cd frontend   && npm run typecheck
```

The tests worth reading are the ones that pin honesty rather than behaviour:
`AiRequestFactoryTest` asserts that no environmental data is invented when none
is stored, `ForecastControllerStatusTest` pins the difference between "this
storm has no forecast yet" (204) and "no such storm" (404), and
`IntensityScaleTest` pins the Saffir-Simpson thresholds to the 1-minute wind
definition they are valid for.

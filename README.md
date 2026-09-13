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
  4,450 storms                         |
  111,960 fixes                        v
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
| Span | 1980 – 2026, 4,450 storms, 111,960 fixes |
| Basins | WP 1338, EP 946, SI 757, NA 710, SP 465, NI 233, SA 1 |
| North Indian Ocean | Bay of Bengal 157, Arabian Sea 76 |
| Scale | Saffir-Simpson, which is defined for 1-minute winds |
| Environment | Sea-surface temperature: NOAA ERSST v5 monthly means, 2° grid |

A storm is filed under the basin and sub-basin it **formed** in, which is why
those counts sum to the total exactly. Twenty-five more storms formed elsewhere and
later moved into the North Indian Ocean, and IBTrACS records both names for
them: the Pacific storm Matmo became Bulbul on entering the Bay of Bengal in
2019, and the archive stores it as `BULBUL:MATMO`.

Four choices in that table are load-bearing.

`USA_WIND` is used alone because `WMO_WIND` mixes 1-, 3- and 10-minute
averaging periods between agencies, so comparing its values across basins
compares different quantities.

Only synoptic rows are kept because IBTrACS interpolates the intermediate
3-hourly rows from fixes on both sides — including later ones. Training on those
rows let the model read forward in time, and they were 42% of the original
table.

A fix needs a position and a wind, but **not** a pressure. Requiring one threw
away 18,472 fixes and 476 whole storms, and it fell hardest where the data is
thinnest: two thirds of North Indian Ocean fixes report a wind and only two
thirds of those also report a pressure. The models are built for this — the
step features carry a `pressure_present` flag, training applies pressure
dropout, and the intensity loss and metrics mask the pressure component per fix
so an absent reading contributes nothing rather than being learned as "no
change".

Uncoded fixes (IBTrACS `NATURE = NR`) are kept. `NR` means *not reported*, not
*not tropical*: measured against this archive those fixes sit at a median 12.7°
of latitude against 41.5° for extratropical ones, and the live adapter has
always accepted them. Fixes positively coded as something else — extratropical,
subtropical, disturbance, mixed — stay out.

That rule was briefly stricter, keeping `NR` only inside storms coded `TS`
somewhere, and the North Indian Ocean is why it is not. Between 1990 and 1995
that basin has **1,952 `NR` fixes against 57 `TS`** ones: only 5 of its 58
storms carry a single `TS` fix, because that is simply how the basin was
recorded then. The restriction deleted six consecutive Indian Ocean seasons,
among them the **April 1991 Bangladesh cyclone** — 33 synoptic fixes, every one
reporting a wind, coded `NR` throughout, peak 259 kph, and one of the deadliest
tropical cyclones ever recorded. A filter that silently erases the deadliest
storm in the record is not conservative, it is broken.

The **Arabian Sea** and the **Bay of Bengal** are one IBTrACS basin (NI) but two
seas on opposite sides of the Indian peninsula, so the sub-basin is stored and
filterable in its own right. It is taken from the storm's genesis fix, the same
rule already used for the basin.

## The models

Measured on 668 held-out **storms**, never held-out rows: every fix of a storm
is in exactly one split, so nothing is scored against a storm it trained on.

**Track** — GRU over up to 12 past fixes, 20 features per step.

| Horizon | Mean error | Median | Persistence | Linear extrapolation |
| --- | --- | --- | --- | --- |
| +6h | 28.6 km | 23.5 km | 105.0 km | 31.0 km |
| +12h | 61.8 km | 51.6 km | 206.0 km | 69.0 km |
| +24h | 143.7 km | 122.0 km | 399.6 km | 166.3 km |

Per basin, with the margin over linear extrapolation at +24h — the comparison
that shows the model learned how tracks curve in that basin, rather than just
that storms keep moving:

| Basin | Held-out storms | +6h | +12h | +24h | vs linear at +24h |
| --- | --- | --- | --- | --- | --- |
| East/Central Pacific | 132 | 22 km | 48 km | 111 km | 9% better |
| North Atlantic | 152 | 31 km | 69 km | 164 km | 18% better |
| **North Indian Ocean** | 42 | 31 km | 60 km | 134 km | 11% better |
| South Indian | 103 | 28 km | 59 km | 136 km | 11% better |
| South Pacific | 61 | 34 km | 75 km | 180 km | 6% better |
| West Pacific | 214 | 29 km | 63 km | 146 km | 16% better |

Two honest notes on that table. The North Indian Ocean row rests on 42 held-out
storms, the fewest of any basin, so its margin carries the widest error bars.
And at **+6h** the South Pacific is a wash — 34 km against the baseline's 33 —
so "beats linear in every basin" is true at +24h and not at every horizon.

Forecasting the same held-out storms with **pressure withheld entirely** costs
under 0.3 km at every horizon (28.8 / 61.8 / 143.5 km). That is what the
`pressure_present` flag is for, and it is why the archive can include storms
that never reported a pressure: the model degrades gracefully on them instead
of mispredicting them.

**Intensity** — same encoder, wind and pressure regression plus a three-class
trend head.

| Horizon | Wind MAE | Persistence | Wind n | Pressure MAE | Persistence | Pressure n |
| --- | --- | --- | --- | --- | --- | --- |
| +6h | 5.9 kph | 7.5 kph | 15,090 | 2.5 hPa | 3.1 hPa | 12,457 |
| +12h | 10.3 kph | 14.4 kph | 14,386 | 4.3 hPa | 5.9 hPa | 11,877 |
| +24h | 18.0 kph | 26.0 kph | 13,063 | 7.8 hPa | 10.8 hPa | 10,730 |

Trend accuracy 68.0% against a 42.1% majority-class baseline.

Sea-surface temperature is one of the inputs, and it does not earn its place.
Retraining the same model on the same held-out storms without it gives wind
MAE 17.9 kph at +24h instead of 18.0 and trend accuracy 68.4% instead of 68.0%
— within noise, and no better. It stays wired in because it costs nothing and a
finer-grained field might change that; it is not claimed as an improvement.

The two sample counts differ on purpose, and the gap is the honesty fix made
visible: 2,633 held-out samples at +6h have a wind target and no pressure
target, so they score the wind head and are excluded from the pressure figure
entirely. Counting them would have meant scoring the model against a pressure
change of zero that nobody measured — and it would have flattered the pressure
MAE precisely where reporting is thinnest.

**Analogue ensemble** — nearest neighbours over 88,304 track windows from 4,313
storms, matched on recent curvature rather than absolute displacement, with the
ten closest averaged into an independent second forecast.

It is the weakest component here, and the wider archive made it weaker as a
forecaster rather than stronger:

| Horizon | Analogue | Linear extrapolation | Neural track model |
| --- | --- | --- | --- |
| +6h | 30.1 km | 29.0 km | 28.6 km |
| +12h | 66.3 km | 65.7 km | 61.8 km |
| +24h | 158.0 km | 161.0 km | 143.7 km |

So it now loses to plain linear extrapolation at +6h and +12h, and beats it at
+24h by only 1.9% — down from 4% before, because the added sparsely-reported
storms are ones a straight line predicts well. Combining the members differently does not rescue it: the plain mean, the
median and a closeness-weighted mean score 158.0, 157.9 and 158.1 km at +24h
on the same windows. Its member spread correlates
with its own error at only 0.23–0.25, so it is a weak uncertainty signal.

Blending it into the neural forecast was measured too, fairly: the same held-out
moments, an analogue index built from training storms only, the weight chosen on
validation storms and applied once to the test set, and a confidence interval
that resamples whole storms (`evaluation/blend_report.py`). The gain is real at
every horizon and far too small to matter — 0.3 km at +6h, 0.4 km at +12h and
+24h, against best-track positions recorded to about 11 km — so the two are not
blended.

It stays in the product for the one thing it does that no network does: every
number it produces is traceable to named storms a reader can go and look at.
Asked about Mocha in 2023 it returns Mala 2006 — which also crossed the Bay of
Bengal into Myanmar's Rakhine coast in May — and that is an argument a
forecaster can check. It is presented as a second opinion, never as the
forecast. The console words its comparison with a straight line from the
evaluation the index recorded, so the claim moves with the next rebuild instead
of going stale, and its circles are labelled as disagreement between past
storms, not as an error range.

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

**The quick way, on Windows.** With PostgreSQL running and the prerequisites
below in place, one command builds whatever is missing and starts everything:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-local.ps1     # add -Rebuild after code changes
powershell -ExecutionPolicy Bypass -File scripts\ingest-local.ps1    # first run only: load the archive
powershell -ExecutionPolicy Bypass -File scripts\stop-local.ps1
```

It runs the packaged backend jar with a 512 MB heap and the production build of
the console rather than `mvn spring-boot:run` and `npm run dev`. The whole stack
then uses about 600 MB instead of roughly 1.5 GB — the difference between it
staying up and Windows killing it on a laptop that also has a browser open.
Logs are written to `logs\`.

The steps below are the same thing done by hand, and what you need the first
time.

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
PUBLIC_BASE_URL=http://localhost:8081
VAIYU_ADMIN_TOKEN=generate-with-openssl-rand-hex-32
VAIYU_CORS_ALLOWED_ORIGINS=http://localhost:5173
```

```bash
cd backend
mvn spring-boot:run                 # http://localhost:8081
```

Port 8081 rather than 8080, which is too often already taken by something else.

### 4. Load the archive

```bash
curl -X POST -H "X-Admin-Token: $VAIYU_ADMIN_TOKEN"   http://localhost:8081/api/internal/ingest/ibtracs
```

Ingestion rewrites the archive, so it needs the admin token from
`backend/.env` (`VAIYU_ADMIN_TOKEN`, at least 24 characters). With no token
configured it is refused outright.

Reads `ai-service/data/processed/observations.csv` and upserts storms and fixes,
so it is safe to re-run after a retrain. Roughly 30 seconds for 111,960 fixes.
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

## Running it in containers

For a production server with HTTPS, follow [`DEPLOYMENT.md`](DEPLOYMENT.md).
This section is the local container setup.

```bash
docker compose up --build
curl -X POST http://localhost:8081/api/internal/ingest/ibtracs
# http://localhost:5173
```

Four services: `postgres`, `ai-service`, `backend`, `frontend`. Two things are
mounted rather than baked into images, because both are large, regenerable and
absent from this repository — the trained checkpoints
(`ai-service/checkpoints`, read-only) and the observation table
(`ai-service/data/processed`, read-only). Produce them first with *Training
from scratch* in [`ai-service/README.md`](ai-service/README.md); without them
the stack still starts, the archive is simply empty and every analysis reports
`NOT_AVAILABLE` with a reason.

Three details in there are load-bearing, and each one is a way this could
silently half-work:

- The **frontend image must be built with `NITRO_PRESET=node-server`**. The
  project's default preset is `cloudflare-module`, which emits a Workers bundle
  with no Node server in it, so the image would build and then have nothing to
  run. The Dockerfile sets it.
- **`VITE_API_BASE_URL` is baked in at build time** and read by the browser, so
  it must be an address the *viewer* can reach. `http://backend:8081` resolves
  inside the compose network and nowhere else. Override with
  `VAIYU_PUBLIC_API_URL` when deploying.
- **`PUBLIC_BASE_URL` is the opposite case.** It is the address the AI service
  uses to fetch an uploaded satellite frame, so it *is* the compose network's
  `http://backend:8081`.

The AI service is not published to the host. Spring Boot is its only intended
caller, and the browser must never reach it.

**Status of this, stated plainly:** the compose file is validated and every
variable in it matches what `application.yml` reads; the jar the backend image
runs was built and started from its env vars, and `/actuator/health` — the
container's health check — answered `UP`; the frontend build and its Node
server were run and serve every route with the map rendering. The **images
themselves have not been built**, because the machine this was written on has
no running Docker daemon and 2 GB free on its system drive, and the CPU-only
PyTorch layer alone needs several. Treat `docker compose up --build` as
unexercised until someone runs it.

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
- **Humidity and wind shear.** The model interface accepts both and nothing
  supplies them, so those features stay flagged absent rather than filled in.
  Sea-surface temperature *is* joined, from NOAA ERSST v5 — a monthly mean on a
  2° grid, which describes the water mass a storm crossed rather than the water
  under its core, and cannot show a cold wake.
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

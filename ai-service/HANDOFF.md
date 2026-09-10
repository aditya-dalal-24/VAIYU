# CycloVision AI Service — Handoff

State as of **2026-09-10**, branch `ad_model`. Written for the next device and the
next AI agent. Every figure below was measured or read from disk in the session
that produced this file; nothing is projected. Where something is unknown it says
so.

Companion documents, all in `ai-service/`:
**`CycloVision AI Service Contract.txt`** (authoritative spec) ·
**`README.md`** (runbook) · **`docs/AI_ARCHITECTURE.md`** (full design rationale).

---

## 1. Status at a glance

| Analysis (contract §5) | State | Serves today? |
| --- | --- | --- |
| `TRAJECTORY_PREDICTION` | Implemented, trained, verified | Yes, where checkpoints are present |
| `INTENSITY_PREDICTION` | Implemented, trained, verified | Yes, where checkpoints are present |
| `SATELLITE_ANALYSIS` | Pipeline and source handling implemented; **no imagery, no checkpoint** | No: returns `NOT_AVAILABLE` + reason |
| `HISTORICAL_SIMILARITY` | Extension point only | No: returns `NOT_AVAILABLE` + reason |
| Explainability | Extension point only | No: `explanations: []` |

- **Tests:** 262 passing (`python -m pytest`, 15 test files), on Python 3.11.9 and 3.13.2.
- **Contract check:** 46/46 passing against the live service (§9).
- **Git:** the 8 AI commits listed in §3, plus handoff-doc commits, are all local and **not pushed**.

---

## 2. Objective and end goals

**The service:** an internal FastAPI AI service. Spring Boot is its only caller and
React never calls it (contract §1, §16). It implements the contract exactly:
- `GET /api/v1/health`
- `POST /api/v1/analysis/cyclone`

**Product (scope locked by the user):** a "flight recorder for tropical cyclones",
with Cyclone Evolution Intelligence as the central idea. There are four locked
differentiators, and no major feature may be added unless it strengthens one:
- **A. Evolution Replay:** a synchronised timeline.
- **B. Rewind & Verify:** forecast from time T using only data at or before T,
  then reveal the real outcome and its error. `evaluation/live_check.py` already
  does this against real storms.
- **C. Analogue Ensemble:** historical analogues as an independent second
  forecast. This is what `HISTORICAL_SIMILARITY` is meant to become.
- **D. Structural Signature + Grad-CAM:** deterministic measurements from raw
  brightness-temperature data, plus a rule-engine regime classifier. Do not claim
  a trained Dvorak classifier without a validated labelled dataset.

**Barred by the user:** Kubernetes, multiple AI microservices, WebSockets, auth,
chatbots, unnecessary agents, CRUD pages, and complex cloud infrastructure.
Offline data engineering and training stay separate from inference code.

**Geographic focus:** the North Indian Ocean (NI). The models are trained
globally.

**Non-negotiable rules** (user-stated; they apply to all future work):
1. **Never fabricate** a prediction, confidence or metric. An untrained or
   unavailable model returns `NOT_AVAILABLE` with a reason and never a plausible
   placeholder. Every value must be traceable to a trained model, an
   observation, or a clearly labelled baseline or rule engine.
2. **Temporal leakage prevention is critical.** A prediction at T may use only
   information at or before T. Splits are by storm, never by row or frame.
3. **Never expose** stack traces, secrets, internal model paths or filesystem
   details in responses.
4. **Do not commit** trained weights or datasets. Both are gitignored.
5. **Scope: modify only `ai-service/`.** Never touch `backend/`, `frontend/`,
   `ml/`, `data/`, `scripts/`, `docs/` (repo root) or root files, and never
   rename existing contract fields.
6. **Never handle credentials.** MOSDAC, OpenWeather and similar logins stay with
   the user. They are never pasted into chat or committed. The user runs
   authenticated downloads.

---

## 3. Repository state

**Local commits** (on top of `3e69332`, `origin/ad_model`): all eight touch
`ai-service/` only and none has been pushed. The user intends to push
`ai-service/` to their branch so a teammate's laptop can train.

```
32ed312 fix: remove interpolated IBTrACS rows that leaked future data; ready to train elsewhere
ab22cb4 feat: global live storm coverage via IBTrACS, and per-basin skill
ed6197b feat: report live-check errors against persistence and linear baselines
ff71e26 feat: ATCF best-track adapter and leakage-guarded live check
56cc343 chore: keep the data and checkpoint directories in the tree
7af0e70 chore: ignore checkpoints, cap test temp, add an IBTrACS adapter
ffe7c5f feat: expose the section 15 optional model metadata
042a740 fix: stop constant training features exploding at inference
```
(`HANDOFF.md` itself is committed on top of these.)

**Uncommitted changes outside the AI work:** `frontend/src/routeTree.gen.ts`
(modified) and `frontend/package-lock.json` (untracked). Both come from the
user's own frontend runs. **Do not commit them with AI work.**

**Push size:** a clean export of the `ai-service/` tree is **528 KB**, with no
data and no checkpoints.

**Machine constraints (development laptop):**
- C: is 100% full. During the session the OS deleted the temp scratch directory.
- D: has about 14 GB free. **Keep all data and scratch work on D:.**

---

## 4. Data: what exists, where, and its status

All paths are relative to `ai-service/`. `data/` and `checkpoints/` contents are
gitignored and **exist on the development laptop only**.

| Item | Location | Status |
| --- | --- | --- |
| IBTrACS global best track | `data/raw/ibtracs.since1980.csv` (138 MB) | Present locally. Remote name is `ibtracs.since1980.list.v04r01.csv` (see the URL in the README; the shorter name 404s). |
| **Training table (tracks)** | `data/processed/observations.csv` (7.3 MB) | Present locally. 90,537 synoptic fixes, 3,829 storms, 1980-01-02 → 2026-09-08. Storms per basin: WP 1246, EP 708, SI 702, NA 655, SP 417, **NI 177**, SA 1. Produced by the fixed `prepare_ibtracs.py`. |
| HURSAT-style label array | `data/raw/Cyclone_Labels h5.npy` (1.8 MB) | Present. Shape `(21076, 8)`, object dtype: `basin, storm_id, lon, lat, YYYYMMDDHH, wind_kt, <column 6: see below>, pressure_hpa`. 485 storms, 3-hourly (off-synoptic rows interpolated). Basins **ATLN 7,144 / EPAC 5,010 / WPAC 8,922 — no North Indian frames**. Column 6 is 0–375, zero whenever wind < 34 kt and interpolated at 3-hourly times, so it is *probably* the 34-kt wind radius (unverified). **The companion image frames are not on this machine**; the name implies an HDF5 image file that was never provided. |
| NASA IMPACT satellite dataset | Described on branches `Ab4J`/`Aditya` in `ai-service/data/satellite/README.md` | **Images not on this machine.** GOES Clean IR 10.7 µm, CC-BY-4.0, DOI 10.34911/rdnt.xs53up, `ImageFolder` layout `images/{train,validation,test}/{cyclone,non_cyclone}/`, split by storm. |
| Weather dataset | `data/weather/` on the other branch holds only a `.gitkeep` | **Does not exist.** |
| `data/processed/cyclone_metadata.csv`, `training_table.csv` | Local | Left over from earlier work; **no current code reads them**. |
| **MOSDAC sample file** | Intended: `data/raw/mosdac/` | **Not downloaded yet**; the folder does not exist. Spec in §5. |
| **MOSDAC ordered dataset** | — | **Not ordered.** The order list is generated only after the sample is verified (§10). |
| Trajectory checkpoint | `checkpoints/trajectory.pt` (177 KB) | Trained 2026-09-10 08:10 UTC on the clean table. |
| Intensity checkpoint | `checkpoints/intensity.pt` (214 KB) | Trained 2026-09-10 08:17 UTC on the clean table. |
| Old checkpoints | `checkpoints/pre-synoptic/` | Backup of the models trained on leaky data. **Do not serve.** Safe to delete. |
| Satellite checkpoint | — | None. |

**North Indian storms covered by INSAT imagery** (counted from our table):
- INSAT-3DR era (from 2016-09-29): 58 storms, 1,135 synoptic times.
- INSAT-3D era (from 2013-07-26): 75 storms, 1,505 times.
- Since 2023: 17 storms, including MOCHA, BIPARJOY, TEJ, HAMOON, MICHAUNG,
  REMAL, DANA, FENGAL, SHAKHTI, MONTHA, SENYAR and DITWAH.

---

## 5. MOSDAC and data-source access

**MOSDAC status:**
- The account is verified and active (reported by the user on 2026-09-10).
- No MOSDAC data has been downloaded. No credentials are held by the agent, and
  none may be.

**What MOSDAC can unlock, in priority order:**
1. **Satellite analysis:** INSAT-3D/3DR/3DS imager, TIR1 10.8 µm brightness
   temperature.
2. **Two of the three unused weather inputs:** INSAT SST for sea-surface
   temperature, and UTH as a humidity proxy. UTH is not the same quantity as
   relative humidity, so it must be named for what it is. Coverage starts in
   2013. There is no clean wind-shear product.
3. **Possibly a live North Indian feed:** SCORPIO ("Sat. Based Cyclone Obser. and
   Realtime Pred. over IO").

**Still required from the user, in this order:**
1. **One sample file:**
   - Satellite: INSAT-3DR imager.
   - Product: Level-1C Asia-sector Mercator if offered, otherwise Level-1B full
     disk.
   - Time: **2023-05-14 00:00 UTC**. Cyclone MOCHA was at 18.7°N 91.7°E, 145 kt,
     908 hPa per our table.
   - Save it in `data/raw/mosdac/` and report the filename and size.
2. The **product names** as listed in the MOSDAC catalogue for INSAT-3DR Imager,
   SST, UTH and SCORPIO. The agent cannot see the catalogue behind the login.
3. Whether **SCORPIO** has a downloadable track file, with one example.
4. MOSDAC's **data policy** on showing imagery publicly in the demo.

**Unknown until the sample arrives:**
- Exact product IDs.
- Per-file size. It is believed to be on the order of 100 MB+ for L1B full disk,
  which would put 1,135 files beyond the ~14 GB free.
- Grid, projection, calibration (counts → kelvin), and the lat/lon dataset names
  and fill values.

MOSDAC may offer a scripted download tool that takes credentials from a local
config file. If so, the **user** runs it.

**Other sources, verified from this machine on 2026-09-10:**

| Source | Coverage | Result |
| --- | --- | --- |
| NHC ATCF b-decks `ftp.nhc.noaa.gov/atcf/btk/` | al, cp, ep | Reachable, near-real-time. Adapter: `preprocessing/atcf.py`. |
| IBTrACS ACTIVE list | global, all basins | Reachable, 1–2 days behind. Adapter: `preprocessing/ibtracs_live.py`. |
| GDACS event GeoJSON | global, incl. Indian Ocean | Reachable, but no pressure and 12-hourly. Not adopted. |
| ECMWF open data `*-enfo-tf.bufr` | global forecast tracks | Reachable. These are **forecasts: never use them as observations**; they are usable only as a comparison baseline (needs `eccodes`). Not adopted. |
| JTWC `metoc.navy.mil` | io, sh, wp | 403 |
| IMD `rsmcnewdelhi.imd.gov.in` | NI | Unreachable |
| ISRO Bhuvan | — | Carries no cyclone data (its API offers postal, geocoding, LULC, routing, geoid). |
| `tropycal` library | — | Rejected. Needs cartopy, pyproj and shapely, takes ~40 s to initialise, and its JTWC path also 403s. |

An OpenWeather API key was supplied for an earlier live test. **It is not in the
repo** (verified), and the service does not use OpenWeather.

---

## 6. Architecture (implemented)

```
app/          FastAPI: main.py (error handlers), routers (health, analysis), schemas/contract.py, services/
preprocessing/ features.py, dataset.py, splits.py, scaler.py, satellite.py, atcf.py, ibtracs_live.py
models/       base.py (MaskedSequenceEncoder, resolve_device), trajectory/, intensity/, satellite/
registry/     checkpoint.py (envelopes, atomic save), registry.py (model states)
training/     config.py, pipeline.py, train_{trajectory,intensity,satellite}.py, prepare_{ibtracs,satellite}.py
evaluation/   trajectory_metrics.py, intensity_metrics.py, satellite_metrics.py, basin_report.py, live_check.py
tests/        262 tests
```

**Inputs.** Training and inference share one feature definition in
`preprocessing/features.py`. `FEATURE_SET_VERSION = "1.0"`, `SEQUENCE_LENGTH = 8`
steps, `MIN_OBSERVATIONS = 3`.
- **16 step features:**
  - position: `latitude`, `abs_latitude`, `longitude_sin`, `longitude_cos`
  - intensity: `wind_speed_kph`, `pressure_hpa`
  - motion: `movement_speed_kph`, `heading_sin`, `heading_cos`
  - changes: `delta_hours`, `wind_delta`, `pressure_delta`, `lat_delta`,
    `lon_delta`
  - season: `month_sin`, `month_cos`
- **6 environmental features:** `sea_surface_temperature_c`, `humidity_percent`
  and `wind_shear_kph`, each with a `*_present` flag. **All six are currently
  inert** (§8).
- Padding goes at the end (trailing), and the encoder uses
  `pack_padded_sequence`, so padding cannot change the encoding.

**Models.**
- **Trajectory:** a GRU encoder (hidden size 64, 1 layer) with one direct head
  per horizon. It predicts the change in latitude and longitude at +6, +12 and
  +24 h.
- **Intensity:** the same encoder, with a per-horizon head for wind and pressure
  change and a trend head over `WEAKENING`/`STABLE`/`INTENSIFYING`. `UNCERTAIN`
  is returned when the top class's confidence is below 0.45. It is a threshold
  on the output, not a learned class.
- **Satellite:**
  - A torchvision ResNet-18 plus a learned "source" embedding (8 values per
    `SENSOR|BAND` key; slot 0 is reserved for UNKNOWN).
  - Input is 224×224 with ImageNet normalisation. Output is binary
    `NOT_CYCLONE`/`CYCLONE`.
  - Only the last ResNet block is fine-tuned (`freeze_backbone(trainable_blocks=1)`).
  - Augmentation is rotation and translation only. **No horizontal flip**, because
    it would mirror the spiral's direction of rotation.
  - `IMAGE_SPEC_VERSION = "1.0"`.
  - **Source handling.** Training replaces the source with UNKNOWN on 20% of
    frames (`--source-dropout`), so slot 0 is trained rather than left random.
    At inference, `imageType` may carry the sensor as `<SENSOR>|<BAND>`
    (`source_key_from_image_type` in `preprocessing/satellite.py`), normalised
    exactly as catalog fields are: case, repeated spaces and parentheticals are
    ignored. A plain `imageType` such as `INFRARED` uses slot 0 and carries an
    "unknown source" note. Health lists the known keys under
    `models.satellite.sources`. Held-out metrics are stored twice, with real
    sources (`test`) and with every source withheld (`test_source_withheld`).

**Preprocessing decisions that must not be undone:**
- **Synoptic fixes only (00/06/12/18Z).** IBTrACS's 3-hourly rows are
  interpolated from the *next* fix, which leaks future data. Kept in, they were
  42% of the table and roughly doubled the apparent lead over linear
  extrapolation. `prepare_ibtracs.py` and `ibtracs_live.py` share one constant,
  and tests pin both.
- **Wind from `USA_WIND` only.** `WMO_WIND` mixes 1-, 3- and 10-minute averaging
  periods. Pressure is `USA_PRES`, falling back to `WMO_PRES`.
- **Tropical stage only** (`NATURE == "TS"`) for training. The live adapter also
  accepts `NR`, because provisional tracks leave it uncoded.
- **`keep_default_na=False`** when reading IBTrACS, because the North Atlantic
  basin code is the literal string `"NA"`.
- **Targets must fall within 3 h of a real fix.** Sample history is strictly
  `observations[:i+1]`, and inference filters history through
  `observations_up_to()`.
- **Scaler fitted on the training split only.** Features whose training std is
  below 1e-4 are recorded as degenerate and zeroed. This fixed an earlier
  explosion to latitude 227,382 and wind 661,509 kph.
- **Splits:** SHA-256 hash of the storm id, 70/15/15 (a storm keeps its split as
  the data grows). `split_by_season` is available. `assert_no_cyclone_overlap`
  runs before fitting.
- **Satellite catalogs** refuse to guess a storm id, and refuse any storm that
  straddles two splits.

**Checkpoints:**
- A checkpoint holds the weights, architecture config, fitted scaler, horizons,
  `feature_set_version`, evaluation metrics and training history. Satellite
  checkpoints also hold the source vocabulary and `image_spec_version`.
- Saves are atomic and load with `map_location="cpu"`, so a model trained on a
  GPU serves on a CPU.
- A version mismatch gives `CHECKPOINT_INVALID`; the model is never served
  against the wrong feature layout.
- Registry states: `TRAINED`, `UNTRAINED`, `CHECKPOINT_INVALID`, `LOAD_FAILED`,
  `UNAVAILABLE`. The reason text never includes paths.

**Training defaults** (`training/config.py`):
- horizons [6, 12, 24]; epochs 60; early-stopping patience 10; batch 64
- learning rate 1e-3; weight decay 1e-4; gradient clip 1.0
- `trend_loss_weight` 0.5; seed 42
- `device auto` (CUDA if present); `split_strategy cyclone`
- Satellite: epochs 25, batch 16, learning rate 3e-4, patience 6.

---

## 7. Measured results (current checkpoints, clean data)

**Held-out set:** 559 storms never seen in training, 11,436 samples.
Regenerate with `python evaluation/basin_report.py`.

**Trajectory, all basins** (mean position error):

| | +6h | +12h | +24h |
| --- | --- | --- | --- |
| Model | 29.0 km | 62.7 km | 146.4 km |
| Linear extrapolation | 31.8 km | 72.4 km | 175.5 km |
| Persistence (storm stays put) | 105.1 km | 205.8 km | 396.4 km |

`validation_skill` = 0.631. The service reports it as trajectory `confidence`,
defined as 1 − model_error / persistence_error at +24 h.

**Trajectory by basin:**

| Basin | Storms | +6h | +12h | +24h | Lead over linear at +24h |
| --- | --- | --- | --- | --- | --- |
| EP | 101 | 22 | 49 | 117 | 10% |
| NA | 118 | 30 | 68 | 164 | 20% |
| WP | 184 | 31 | 65 | 150 | 17% |
| **NI** | **27** | **32** | **63** | **141** | **17%** |
| SI | 96 | 27 | 58 | 133 | 16% |
| SP | 60 | 35 | 74 | 174 | 15% |

Errors are in km. NI has the fewest held-out storms, so its figure is the least
certain.

**Intensity:**

| | +6h | +12h | +24h |
| --- | --- | --- | --- |
| Wind error, model | 6.4 kph | 11.3 kph | 19.7 kph |
| Wind error, persistence | 8.3 kph | 15.8 kph | 28.6 kph |
| Pressure error, model | 2.5 hPa | 4.4 hPa | 7.8 hPa |
| Pressure error, persistence | 3.2 hPa | 6.0 hPa | 11.0 hPa |

Trend accuracy is 65.9% (macro F1 0.659), against a 36.9% majority-class
baseline.

**Invalid numbers.** Any "27–44% lead over linear" figure from before commit
`32ed312` came from leaky data and must not be quoted.

**Live checks** (single storms; these are anecdotes, not skill measurements):
- **KROVANH** (WP, recurving, via IBTrACS ACTIVE, 24 h withheld; **all 28 of
  its fixes are uncoded `NR`**, the kind training excludes): model mean
  105 km, linear 165 km, persistence 211 km.
- **ep142026** (EP, straight-moving, via NHC, 18 h withheld): model mean 76 km,
  linear 59 km, persistence 268 km. Linear wins on straight tracks; the model's
  advantage is on curving ones.

**Satellite:** only a pipeline smoke test. On 24 synthetic storms of random-noise
frames it scored accuracy 0.467 against a majority baseline of 0.600. That is the
correct result on noise and **says nothing about skill**.

**Training time** (development laptop, CPU only): trajectory about 9 min (18
epochs), intensity about 6 min (18 epochs).

---

## 8. Completion matrix

**Implemented and verified:**
- Contract API: health, unified analysis, `PARTIAL`, the HTTP 200/400/422/500/503
  mapping, and the §13 error shape with `requestId` echoed.
- Trajectory and intensity: training, evaluation against baselines, checkpoints,
  registry, serving.
- Data adapters: IBTrACS preparation, NHC ATCF, IBTrACS ACTIVE, and the satellite
  catalog builder (both dataset layouts).
- Leakage guards: temporal slicing, storm-level splits, synoptic-only filter, and
  the training-archive overlap check in `live_check.py`.
- `uncertaintyRadiusKm`, taken from the measured held-out mean error per horizon.
  It is absent, not zero, when no evaluation recorded one.
- Fresh-clone workflow: download → prepare → train → serve → 46/46 contract
  checks.

**Training-required (code done, needs data):**
- Satellite analysis. Needs real imagery and a satellite checkpoint.

**Fixed after the first handoff** (all with tests):
- **Satellite source-key mismatch.** Training tagged frames `SENSOR|BAND` while
  inference built keys from `imageType` alone, so every real request used the
  UNKNOWN slot, and training never taught that slot. Fixed with source dropout
  in training plus the `<SENSOR>|<BAND>` convention in `imageType` (§6, §9).
  No contract change: `imageType` was already a free string.
- **Nature-code difference, decided deliberately.** Training keeps `TS` only;
  the live adapter keeps `TS` + `NR`. Measured on the synoptic rows of
  `ibtracs.since1980`: 10,226 NR rows across 911 storms, median 25 kt, and 721
  of those storms also carry TS rows. NR is mostly the weak, uncoded ends of
  otherwise-tropical storms, and the provisional current season is largely
  uncoded. Each live storm now carries `uncoded_fixes`, which `--list` shows as
  `(N uncoded)` and `live_check.py` prints.
- **Windows reload gotcha.** Auto-reload is now opt-in (`RELOAD=1`). A plain
  `python app/main.py` no longer starts a reloader child that can outlive its
  parent. Separately, on Windows the venv's `python.exe` is a launcher that
  spawns the real interpreter under another PID, so check
  `netstat -ano | findstr :8000` when a restart seems to change nothing.
- **Python 3.11.** A fresh 3.11.9 environment built from `requirements.txt`
  alone passes all 262 tests and serves the checkpoints trained under 3.13.

**Known defects and gaps still open:**
1. **Environmental features are inert.** No weather data has been joined. The
   scaler zeroes these features, so `environmentalData` in a request is accepted
   and changes nothing. Needs data (§10 task 8).
2. **The backend drops the reasons on a 503.** When nothing requested can run,
   the service returns 503 with the full body, as contract §14 requires, but the
   `Ab4J` client discards non-2xx bodies. The fix is backend-side (§11); it is
   out of this service's scope.

**Untested:**
- The satellite model on real imagery.
- Satellite serving with a trained checkpoint against a real image URL.
- The INSAT reader (**not written yet**).
- Training on a GPU. There is no NVIDIA GPU on the development laptop, so only CPU has been run.
- Training on the teammate's laptop.
- Spring Boot ↔ service **live** integration. Only a static field-by-field DTO
  comparison has been done (§11).

**Future (extension points only, deliberately not faked):**
- Historical similarity (the Analogue Ensemble).
- Explainability and Grad-CAM, and the structural-signature rule engine.
- ECMWF as a comparison baseline.

---

## 9. AI-service contract as implemented

**Endpoints.** The service listens on `HOST`/`PORT` environment variables
(default `0.0.0.0:8000`); `LOG_LEVEL` sets logging; `RELOAD=1` enables
auto-reload for development (off by default).

- **`GET /api/v1/health`** returns `{status:"UP", service, version:"1.0.0",
  models:{trajectory|intensity|satellite: {available, state, model, version,
  horizons, trainedAt | reason}}}`.
- **`POST /api/v1/analysis/cyclone`**, request (camelCase):
  - `requestId`, `cycloneId`, `analysisTypes[]`
  - `currentObservation{timestamp, latitude, longitude, windSpeedKph?,
    pressureHpa?, movementSpeedKph?, movementDirectionDegrees?}`
  - `observationHistory[]`, **ordered oldest to newest** (otherwise 400)
  - `environmentalData{seaSurfaceTemperatureC?, humidityPercent?,
    windShearKph?}?`
  - `satelliteImage{imageUrl, imageType?, capturedAt?}?`, where `imageType` may
    be `"<SENSOR>|<BAND>"` (e.g. `"INSAT-3DR|TIR1 10.8 um"`) to name the sensor.
  - At least 3 observations in total, otherwise 422
    `INSUFFICIENT_OBSERVATION_HISTORY`.
- **Response:** `requestId`, `cycloneId`, `analysisTimestamp`, overall `status`,
  plus one block per requested analysis:
  - `trajectoryPrediction{status, reason?, model, confidence,
    predictedPositions[{forecastHours, timestamp, latitude, longitude,
    uncertaintyRadiusKm?}]}`
  - `intensityPrediction{..., trend, confidence, forecast[{forecastHours,
    windSpeedKph, pressureHpa}]}`
  - `satelliteAnalysis{..., cycloneDetected, confidence, cycloneCenter?,
    features?, gradcamImageUrl?}`
  - `historicalSimilarity{..., similarCyclones[]}`
  - `explanations[]`
  - `model{name, version, inferenceTimeMs, trainingDatasetVersion?,
    featureSetVersion?}`
- **Statuses:** `COMPLETED`, `PARTIAL` (some analyses ran and some could not),
  `NOT_AVAILABLE`, `FAILED`, `VALIDATION_ERROR`.
- **HTTP codes:** 200 for `COMPLETED` or `PARTIAL`; 400 for an invalid request
  (schema violation or out-of-order history); 422 for valid JSON with too little
  input to model; 500 for an unexpected failure (no stack trace); **503 when
  none of the requested analyses can run**. The 503 body is still the full
  analysis response, with each block `NOT_AVAILABLE` plus a reason. A fresh
  clone with no checkpoints therefore answers trajectory and intensity requests
  with 503.
- **Error body:** `{timestamp, status, errorCode, message, requestId?}`.
- **Satellite image fetch:** http/https URLs only, 10 s timeout, 12 MB cap.
  Image binaries never travel in the JSON body.
- **Contract evolution (§18):** grow only with optional fields; never rename a
  field silently.

**How a trained model integrates:**
1. Drop the `.pt` file into `ai-service/checkpoints/`:
   `trajectory.pt`, `intensity.pt` or `satellite.pt`.
2. Restart the service.
3. The registry validates it and `health` shows `TRAINED`.

No code changes are needed. Serve from the **same commit** the model was trained
on.

---

## 10. Remaining tasks, in order

| # | Task | Owner | Depends on |
| --- | --- | --- | --- |
| 1 | Push the `ai-service/` commits, excluding the frontend files | User | — |
| 2 | Download the MOSDAC sample file, and report product names and the SCORPIO format (§5) | User | Active account ✔ |
| 3 | Write `training/prepare_insat.py`: read L1B/L1C HDF5, calibrate to kelvin, georeference, and cut 224 px storm-centred crops at IBTrACS positions (cyclone examples) plus non-cyclone crops from the same images away from storms. Keep the raw-kelvin `.npy` next to each PNG, because differentiator D measures the array, not the picture. Feed the output to the existing catalog path, with `satellite="INSAT-3DR"` and band `TIR1 10.8 um`. Verify on the one sample file first. | Agent | 2 |
| 4 | ~~Fix the satellite source-key mismatch~~ **Done.** Remaining: the backend adopts the `imageType` convention (§11) | Backend owner | — |
| 5 | Generate the exact MOSDAC order list: NI synoptic times from `observations.csv`, sized to fit the disk (the 2023–2025 storms are the fallback) | Agent | 3 |
| 6 | Order and download the data into `data/raw/mosdac/`, on D: or the teammate's machine | User | 5 |
| 7 | Build the catalog, train and evaluate the satellite model (per-storm and per-source accuracy against the majority baseline; compare `test` with `test_source_withheld`) | Teammate / agent | 3, 6 |
| 8 | Weather inputs: join INSAT SST/UTH (2013+) or ERA5 via `cdsapi` (free account) into `observations.csv`. Bump `FEATURE_SET_VERSION` if feature meaning changes, then retrain trajectory and intensity. | Agent + user (account) | Data access |
| 9 | Merge the `Ab4J` Spring AI client into the backend branch and run end to end | Backend owner | 1 |
| 10 | Historical similarity (Analogue Ensemble), then Grad-CAM and structural signature | Agent | 7, 9 |
| 11 | ~~Nature codes, reload, Python 3.11~~ **Done.** Remaining: a GPU training run, on a machine that has one | Teammate | — |

---

## 11. Backend integration and end-to-end flow

**Configuration** (this branch): `backend/src/main/resources/application.yml`
sets `ai.service.url: ${AI_SERVICE_URL:http://localhost:8000}`.

**The client exists only on branch `Ab4J`**, not on `main` or `ad_model`:
- `backend/.../ai/AiServiceClient.java`: WebClient, 20 s analysis timeout, 3 s
  health timeout. It never throws and returns an empty Optional when the service
  is down or returns a 4xx/5xx. That includes the 503 sent when no model can
  run, so in that case the per-block `NOT_AVAILABLE` reasons do not reach the
  backend.
- `backend/.../ai/CycloneAnalysisService.java`: builds the request from database
  observations and persists predictions. A `NOT_AVAILABLE` block never becomes a
  row.
- `backend/.../ai/dto/AiAnalysisRequest.java` and `AiAnalysisResponse.java`: Java
  records using `@JsonIgnoreProperties(ignoreUnknown = true)`.

**DTO check:** a static comparison, field by field, of all 12 response blocks
against the Pydantic aliases shows no name mismatches. The `ModelInfo` fields
`trainingDatasetVersion` and `featureSetVersion` are ignored by Java. That is
harmless.

**Expected flow:**
```
React (map / timeline)
  -> Spring controller -> CycloneAnalysisService -> AiServiceClient
       POST {AI_SERVICE_URL}/api/v1/analysis/cyclone   (history oldest->newest, >=3 fixes,
                                                        optional satelliteImage.imageUrl reachable by the AI service)
  <- AiAnalysisResponse (COMPLETED | PARTIAL | NOT_AVAILABLE per block)
  -> persist usable blocks; the map draws the track, plus a cone from uncertaintyRadiusKm
  -> React renders values with their provenance; NOT_AVAILABLE blocks are shown as unavailable, never filled in
```

**Backend-side requirements:**
- Send ≥3 fixes in order.
- Serve satellite images at an http(s) URL the AI service can fetch.
- Send `imageType` as `"<SENSOR>|<BAND>"` using a key from
  `GET /api/v1/health` → `models.satellite.sources`. A plain value still works,
  but it is classified as an unknown source.
- In `AiServiceClient`, on a 503, read the body with
  `e.getResponseBodyAs(AiAnalysisResponse.class)` (Spring 6.1, from Boot 3.2.4)
  rather than returning empty. Otherwise the per-block `NOT_AVAILABLE` reasons
  are lost.
- Treat an empty Optional or `NOT_AVAILABLE` as a normal state.
- Never call FastAPI from controllers directly (§16).

---

## 12. Training on the other laptop (summary; full steps in `README.md`)

1. **Install:**
   - `python -m venv .venv`, then `pip install -r requirements.txt` (includes
     torch, torchvision and pillow).
   - For CUDA, run this first:
     `pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121`
2. **Tracks:**
   - Download `ibtracs.since1980.list.v04r01.csv` to
     `data/raw/ibtracs.since1980.csv` (URL in the README).
   - Prepare:
     `python training/prepare_ibtracs.py --input data/raw/ibtracs.since1980.csv --output data/processed/observations.csv`
   - Expect about 90.5k synoptic rows.
3. **Train:**
   - `python training/train_trajectory.py --dataset data/processed/observations.csv`
   - `python training/train_intensity.py --dataset data/processed/observations.csv`
   - Add `--device cuda|cpu` to force a device.
   - Alternative: copy the two current `.pt` files from the development laptop.
     They are valid for this commit (feature set 1.0).
4. **Satellite, once imagery exists:**
   - Build the catalog:
     `python training/prepare_satellite.py imagefolder --root data/processed/satellite/images --output data/processed/satellite/catalog.json`,
     or the `hursat` subcommand, or the INSAT reader from task 3.
   - Train: `python training/train_satellite.py --catalog data/processed/satellite/catalog.json`
   - Source dropout is on by default (`--source-dropout 0.2`). The stored
     metrics include `test_source_withheld`.
5. **Evaluate:**
   - `python -m pytest`
   - `python -m uvicorn app.main:app --port 8000`, then `/api/v1/health` should
     show `TRAINED`
   - `python evaluation/basin_report.py`, which should come close to the §7
     figures (hardware differences give small deviations)
   - `python evaluation/live_check.py --source ibtracs --list`, then
     `--storm <NAME>`
6. **Hand back:** copy `checkpoints/*.pt` into `checkpoints/` on the serving
   machine and restart. Everything the model needs travels inside the file.
   Train and serve from the same commit.

---

## 13. Context the next agent should not relearn

- Earlier bugs, all fixed and covered by tests:
  - constant features exploding at inference (the scaler);
  - padding changing the GRU encoding;
  - a live test on a storm that was in the training set (now blocked by
    `training_overlap`);
  - interpolated IBTrACS rows leaking future data.
- In `evaluation/live_check.py`, **always report errors next to the persistence
  and linear baselines**. An error in isolation misleads.
- `pytest.ini` caps temporary-directory retention, because the C: drive filled
  up during testing.
- The repo-root `docs/ai/` path mentioned in an early prompt is not where the
  contract lives. It is `ai-service/CycloVision AI Service Contract.txt` (`.txt`).
- An earlier backend fix set `spring.flyway.enabled=false` (Postgres DDL against
  H2). An `application.yml` rename was reverted as unnecessary. That is backend
  history, recorded only for context.
- The user's UI direction (not AI scope): restrained glassmorphism with the map
  as the centerpiece. No card grids, no neon.

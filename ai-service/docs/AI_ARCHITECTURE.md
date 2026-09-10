# CycloVision AI Service — Architecture

The authoritative specification is `CycloVision AI Service Contract.txt` in the
service root. Where this document and the contract disagree, the contract wins.

Status of every component is marked:

- **IMPLEMENTED NOW** — code exists, is tested, and runs
- **TRAINING REQUIRED LATER** — code exists but needs the real dataset
- **FUTURE EXTENSION** — interface only, deliberately produces no output

---

## 1. What exists today

| Component | Status |
|---|---|
| Trajectory model architecture | IMPLEMENTED NOW |
| Intensity model architecture | IMPLEMENTED NOW |
| Preprocessing and feature construction | IMPLEMENTED NOW |
| Dataset interface and sample builder | IMPLEMENTED NOW |
| Leakage-safe splitting | IMPLEMENTED NOW |
| Training pipelines | IMPLEMENTED NOW (not run) |
| Evaluation | IMPLEMENTED NOW (nothing to evaluate yet) |
| Checkpoint format and validation | IMPLEMENTED NOW |
| Model registry | IMPLEMENTED NOW |
| FastAPI service and contract endpoints | IMPLEMENTED NOW |
| Satellite model architecture | IMPLEMENTED NOW |
| Satellite preprocessing, training, evaluation | IMPLEMENTED NOW |
| Trained trajectory model | TRAINING REQUIRED LATER |
| Trained intensity model | TRAINING REQUIRED LATER |
| Trained satellite model | TRAINING REQUIRED LATER |
| Historical similarity | FUTURE EXTENSION |
| Explainability output | FUTURE EXTENSION |

**No model is trained.** With no checkpoints present the service starts, answers
health checks, validates requests, and reports every analysis as
`NOT_AVAILABLE` with a reason. That is a supported state, and it is what
contract section 2 requires instead of fabricating output.

Three models now have architectures and training pipelines: trajectory,
intensity and satellite. Historical similarity remains an interface only.

---

## 2. Layout

```
ai-service/
├── app/
│   ├── main.py                     FastAPI app, error handlers
│   ├── routers/health.py           GET  /api/v1/health
│   ├── routers/analysis.py         POST /api/v1/analysis/cyclone
│   ├── schemas/contract.py         Pydantic models for the contract
│   └── services/
│       ├── analysis_service.py     orchestration, partial-analysis logic
│       ├── inference.py            request -> tensors -> contract response
│       ├── satellite_inference.py  image fetch, classify, source checking
│       └── extensions.py           historical similarity extension point
├── models/
│   ├── base.py                     shared masked GRU encoder, forecast head
│   ├── trajectory/model.py         trajectory architecture
│   ├── intensity/model.py          intensity architecture
│   └── satellite/model.py          vision architecture, source-conditioned
├── preprocessing/
│   ├── features.py                 feature definition, sequence construction
│   ├── dataset.py                  dataset loading, sample and target building
│   ├── satellite.py                imagery catalog, transforms, source keys
│   ├── splits.py                   leakage-safe splitting
│   └── scaler.py                   standardisation fitted on train only
├── training/
│   ├── config.py                   TrainingConfig
│   ├── pipeline.py                 shared data prep, loop, early stopping
│   ├── train_trajectory.py         executable trajectory training
│   ├── train_intensity.py          executable intensity training
│   └── train_satellite.py          executable satellite training
├── evaluation/
│   ├── trajectory_metrics.py       geographic position error + baselines
│   ├── intensity_metrics.py        wind/pressure MAE, trend classification
│   └── satellite_metrics.py        detection scores, per storm/source/basin
├── registry/
│   ├── checkpoint.py               save, load, validate
│   └── registry.py                 model states and availability
├── checkpoints/                    trained weights land here (gitignored)
└── tests/
```

---

## 3. Trajectory model

**Architecture.** A masked GRU encoder over the observation sequence, followed
by one output head per forecast horizon.

The input is 3 to 8 steps of a 16-dimensional vector. That size rules out a
Transformer — self-attention needs far more data than a cyclone archive
provides before it beats a recurrent baseline — and it rules out flattening
into an MLP, which discards the ordering that makes a track informative. A one
or two layer GRU is the smallest architecture that respects the temporal
structure, and it trains on CPU.

**Direct multi-horizon heads**, not recursive rollout. Each horizon is
predicted from the encoded state independently, so a 24-hour error is not the
accumulation of four 6-hour errors, and each horizon can learn its own
behaviour — a 6-hour track is close to ballistic, a 24-hour one is not.

**Targets are displacements**, not absolute coordinates. Deltas centre near
zero and transfer between basins; absolute latitude and longitude would make
the model memorise where storms tend to sit.

**Output** maps to `trajectoryPrediction.predictedPositions`: the predicted
delta is added to the current fix, and the horizon supplies `forecastHours` and
the UTC timestamp.

Horizons are configurable. MVP is 6, 12 and 24 hours; 48 is supported by
passing `--horizons 6 12 24 48`.

---

## 4. Intensity model

**Architecture.** The same encoder, with two kinds of head:

- per-horizon regression heads predicting change in wind (kph) and pressure (hPa)
- a separate classification head over the trend classes

Contract section 10 requires the numerical forecast to be reported separately
from the categorical trend, so the trend is a real classifier with its own
cross-entropy loss, not a threshold applied to the regression output.

**Trend classes.** `WEAKENING`, `STABLE`, `INTENSIFYING` are trained.
`UNCERTAIN` is **not** a learned class: it is reported when the classifier's
maximum probability falls below `DEFAULT_TREND_CONFIDENCE_FLOOR` (0.45). That
gives the contract's fourth value an honest meaning — the model declining to
commit — rather than asking it to learn a label no dataset marks.

The combined loss is `regression + trend_loss_weight * classification`, with
`trend_loss_weight` configurable.
---

## 4b. Satellite model

**Architecture.** A pretrained ResNet-18 over the frame, conditioned on which
sensor produced it, with a single detection head.

**Why pretrained and mostly frozen.** Cyclone imagery archives are small — the
NASA IMPACT reference set is a few hundred frames from sixteen storms. Training
a convolutional network from scratch on that memorises it. ImageNet features
transfer because the early layers learn edges, texture and radial structure,
which is most of what separates an organised storm from a disorganised one.
Only the trailing residual block and the head are fine-tuned.

**Why source conditioning.** Frames arrive from different sensors and bands, and
they are not interchangeable: brightness in a GOES 10.7 µm clean-IR frame is
cloud-top temperature, while brightness in a visible-band frame is reflected
sunlight. Without knowing which it is looking at, the model must average over
that difference and fits neither. A small embedding of the source key —
`SENSOR|BAND` — is concatenated with the visual features so it can learn a
per-sensor offset.

**Unknown sources are handled, not hidden.** Embedding index 0 is reserved for
sources absent from training. The vocabulary is recorded in the checkpoint, and
a frame from an unfamiliar sensor still gets an answer, but the response says
the model is extrapolating. A classifier trained on GOES IR has no basis for
the same confidence on an instrument it never saw.

**What it does not output.** Eye detection, spiral structure, cloud density and
centre coordinates stay null. No label in the reference dataset supports them,
and section 8 keeps them optional until a model actually produces them.

**What a positive answer means.** In the reference dataset `is_cyclone` marks a
34-knot threshold — every frame contains *some* system, and the negatives are
15–33 kt depressions. So the model answers "at or above tropical-storm
strength", not "is there a storm here". That definition is stored in the
checkpoint and returned in the response `reason`, so a UI cannot present an
intensity threshold as presence detection.

### Expected imagery format

A `catalog.json` beside an `images/` tree. Required per entry: `image_id`,
`cyclone_id`, `storage_path`, `is_cyclone`. Optional but used when present:
`split`, `satellite`, `spectral_band`, `image_type`, `ocean_basin`.

Splits are by storm. If the catalog carries a `split` field it is honoured;
otherwise storms are hashed into splits. Frames of one cyclone minutes apart
are near-duplicates, so splitting on images would put the same storm on both
sides.

The **source vocabulary is built from the training split only**, so a sensor
appearing solely in test maps to UNKNOWN exactly as it would at serve time —
otherwise the test score would flatter the model.

### Evaluation

Accuracy, precision, recall and F1, reported alongside a **majority-class
baseline** and broken down **per storm**, **per source** and **per basin**. The
pooled number hides the two failures that matter most here: a model carried by
one easy storm, and a model that works on one sensor and fails on another.

Augmentation is rotation and translation only. A horizontal flip mirrors the
spiral's chirality, turning a Northern Hemisphere storm into one rotating the
wrong way — an image no sensor would record.

---

## 5. Input features

Sixteen per step, in the fixed order defined by `STEP_FEATURE_NAMES`:

| Feature | Notes |
|---|---|
| `latitude`, `abs_latitude` | degrees |
| `longitude_sin`, `longitude_cos` | circular encoding — 179° and −179° are adjacent |
| `wind_speed_kph`, `pressure_hpa` | contract units |
| `movement_speed_kph` | reported, or derived from the previous fix |
| `heading_sin`, `heading_cos` | circular encoding of movement direction |
| `delta_hours` | gap since the previous fix; tracks are irregularly sampled |
| `wind_delta`, `pressure_delta` | change since the previous fix |
| `lat_delta`, `lon_delta` | displacement since the previous fix |
| `month_sin`, `month_cos` | seasonality |

Six environmental features, each **paired with a presence flag**:
`seaSurfaceTemperatureC`, `humidityPercent`, `windShearKph`. The contract makes
these optional, so a missing value is filled with a neutral default *and*
flagged as absent — the model can then distinguish "missing" from "genuinely
this value", which silent imputation would hide.

`FEATURE_SET_VERSION` is recorded in every checkpoint. Changing the feature
layout without retraining is rejected at load time rather than served.

---

## 6. Expected dataset format

One row per cyclone observation, CSV or Parquet.

| Column | Unit | Required |
|---|---|---|
| `cyclone_id` | — | yes — groups rows into tracks |
| `timestamp` | ISO-8601 UTC | yes |
| `latitude` | decimal degrees, −90..90 | yes |
| `longitude` | decimal degrees, −180..180 | yes |
| `wind_speed_kph` | kph | for intensity targets |
| `pressure_hpa` | hPa | for intensity targets |
| `movement_speed_kph` | kph | optional |
| `movement_direction_degrees` | degrees clockwise from north | optional |
| `season` | year | optional — enables the chronological split |
| `sea_surface_temperature_c` | °C | optional |
| `humidity_percent` | % | optional |
| `wind_shear_kph` | kph | optional |

Validation on load rejects missing required columns, unparseable timestamps and
out-of-range coordinates, with a specific message rather than a KeyError deep
inside sample construction. Duplicate `(cyclone_id, timestamp)` pairs are
dropped, since duplicates distort every rate-of-change feature.

**No dataset is included or fabricated.** Synthetic tables appear only inside
tests, to exercise software behaviour.

---

## 7. Sequence and target construction

For each observation at time **T** with at least three fixes at or before it,
one sample is built:

- a padded `[8, 16]` window ending at T, with a step mask
- the environmental vector at T
- targets at each horizon, with a per-horizon mask

**Targets are deltas from the state at T.** A horizon's target exists only when
a real observation falls within 3 hours of T+h; otherwise it is masked out. The
model is never trained toward an interpolated or invented position.

**Padding trails the real steps.** The encoder packs its input, so the GRU never
runs over padding at all. This matters more than it appears: masking the output
alone is not enough, because a GRU consumes padded zeros as real timesteps and
its hidden state evolves through them. A four-observation track would otherwise
encode differently depending on how much padding surrounded it.

---

## 8. Temporal leakage prevention

Two failures would make every number in this project meaningless, and neither
surfaces as an error — both simply produce a model that scores well and is
wrong. Each has its own defence.

**Future data in an input.** A prediction at time T may only use observations at
or before T. Sample construction slices `observations[:index + 1]`, and the
inference path filters the request's history through `observations_up_to()`
before building a sequence — so even a caller that mistakenly includes a later
fix cannot leak it into the prediction.

**The same cyclone on both sides of a split.** Consecutive fixes of one storm
are near-duplicates: three hours apart it has barely moved. Splitting individual
observations at random puts almost-identical rows in train and test, and the
model is scored on what it memorised. `split_by_cyclone` therefore moves whole
storms together, and `assert_no_cyclone_overlap` is called before fitting so a
bad split fails at the start rather than producing an inflated score at the end.

The split is **hash-based, not shuffled**, so a storm keeps its assignment as
the archive grows. Without that, retraining on more data silently moves storms
between train and test and makes runs incomparable.

`split_by_season` is the stricter option: train on earlier seasons, test on
later ones. Prefer it when the dataset spans enough years to give each split a
usable number of storms.

The scaler is fitted on the **training split only**, and frozen into the
checkpoint. Fitting on everything would leak the test distribution; recomputing
at inference would mean a request was scaled differently from training data.

---

## 9. Training

```bash
.venv/Scripts/python training/train_trajectory.py --dataset path/to/observations.csv
.venv/Scripts/python training/train_intensity.py  --dataset path/to/observations.csv
.venv/Scripts/python training/train_satellite.py  --catalog path/to/catalog.json
```

Useful flags: `--epochs`, `--batch-size`, `--learning-rate`, `--hidden-size`,
`--horizons 6 12 24 48`, `--split-strategy season`, `--seed`. A full
`TrainingConfig` can be supplied as JSON with `--config`.

The loop uses AdamW, gradient clipping, and early stopping on validation loss,
and restores the best epoch's weights before saving — not the last epoch's.

Loss is **masked smooth L1**. Horizons without a real target contribute nothing.
Smooth L1 rather than MSE because track and intensity data contain genuine
outliers — rapid intensification, sharp recurvature — that a squared loss would
let dominate the gradient.

Reproducibility: `set_seed()` seeds Python, NumPy and torch. Bit-for-bit
determinism across backends is not guaranteed; runs are repeatable in practice.
---

## 9b. Training on a different machine

Training and serving need not happen on the same computer, and the pieces that
make that safe are built in rather than left to convention.

**GPU is used when present.** `--device auto` (the default) picks CUDA if it is
available and falls back to CPU, so the same command works on a laptop and a
GPU box. `--device cpu` forces CPU, which is what to use when reproducing a run
exactly. `--device cuda` fails loudly if no GPU is present, rather than
silently training slowly.

Installing torch for a GPU needs the CUDA build, which pip does not choose by
default:

```bash
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

**Checkpoints are device-neutral.** The model is moved back to CPU before
saving, and every checkpoint loads with `map_location="cpu"`. A checkpoint
trained on a GPU therefore serves on a machine that has none.

**Handover is a file copy.** Train on the other machine, then bring back:

```
checkpoints/trajectory.pt
checkpoints/intensity.pt
checkpoints/satellite.pt
```

Drop them into `checkpoints/` on the serving machine and restart. Nothing else
transfers: the scaler, the architecture config, the horizons, the source
vocabulary and the evaluation metrics all travel inside the checkpoint.

**Version mismatches are caught, not served.** A checkpoint records the
`FEATURE_SET_VERSION` (or `IMAGE_SPEC_VERSION`) it was trained under. If the two
machines are on different commits and the feature layout has moved, the registry
rejects the checkpoint and reports `CHECKPOINT_INVALID` rather than running a
model against inputs it was never fitted on. This is the failure most likely to
happen when training is split across machines, and it is the one that would
otherwise be invisible.

To avoid it entirely, train from the same commit you serve from.

**Reproducibility.** `--seed` covers Python, NumPy and torch. Bit-for-bit
determinism across different hardware is not guaranteed — a CUDA run and a CPU
run will differ slightly — so compare runs on the same device.

---

## 10. Evaluation

Run automatically at the end of training on the held-out split, and available
directly from `evaluation/`.

**Trajectory** — great-circle error in kilometres, not degrees. A degree of
longitude is ~111 km at the equator and ~55 km at 60° latitude, so a
degree-space error would understate mistakes at high latitude and make basins
incomparable. Mean, median and p90 per horizon, against two baselines:

- `persistence` — the storm does not move
- `linear` — the last observed motion continues

Beating persistence is a low bar. Beating linear extrapolation is what indicates
the model learned how tracks curve.

**Intensity** — MAE for wind and pressure per horizon against a persistence
baseline, plus trend accuracy, macro F1, class distribution and a confusion
matrix. Macro F1 and the majority-class baseline are both reported because
accuracy alone hides the usual failure: a model that answers `STABLE` for
everything because `STABLE` is the commonest class.

**No results exist yet.** Nothing has been trained.

---

## 10b. Live check against a real storm

Held-out evaluation answers "how does the model do across many storms".
`evaluation/live_check.py` answers a narrower, complementary question: does the
*deployed service*, on one specific real storm, produce a forecast matching what
that storm then did. It exercises the whole path — fetch, feature construction,
scaling, checkpoint load, inference, response shape — against ground truth the
model was never given.

```
.venv/Scripts/python evaluation/live_check.py --storm ep142026 --hold-back 12
```

Two properties make it a test rather than a demonstration:

- **The track is cut.** Fixes at and after the cut are withheld from the request
  and used only to score. `preprocessing.atcf.build_request(..., up_to_index=)`
  enforces this, and a test asserts no withheld timestamp appears in the payload.
- **The storm is checked against the training archive.** Scoring a model on a
  storm it trained on produces excellent, meaningless numbers. ATCF and IBTrACS
  identifiers do not match, so `training_overlap()` matches on space and time
  (±3°, ±12 h) instead of names, and the tool refuses to score a matched storm
  unless `--allow-seen` is passed.

That second guard exists because it was needed: an early live check reported
strong errors on a storm that turned out to be in the training split, and the
numbers had to be retracted. The check is deliberately biased toward false
positives — a warning on a clean storm costs a second look, a miss invalidates
the whole result.

Every position error is printed against two baselines -- persistence (the storm
stops) and linear extrapolation (the last motion continues) -- because an error
in isolation is unreadable: 126 km sounds good or bad depending on nothing.
Intensity errors carry a persistence reference for the same reason. When linear
extrapolation wins, the tool says so explicitly rather than leaving the reader
to notice.

One storm is an anecdote. Read the output as an end-to-end check of the deployed
path, never as a measure of forecast skill.

---

## 10c. Live track sources — what is actually reachable

`preprocessing/atcf.py` parses the ATCF b-deck format, which every operational
centre publishes best tracks in. The format is identical across basins, so the
parser serves whichever source is open. Availability verified from this
environment:

| Source | Coverage | Status |
| --- | --- | --- |
| `ftp.nhc.noaa.gov/atcf/btk/` | `al`, `cp`, `ep` | **Reachable**, no key |
| JTWC (`metoc.navy.mil`) | `io`, `sh`, `wp` | 403 Forbidden |
| IMD (`rsmcnewdelhi.imd.gov.in`) | North Indian Ocean | Unreachable |
| MOSDAC (ISRO) | INSAT-3D, NIO cyclone products | Requires an account |
| Bhuvan (ISRO Geoportal) | — | **No cyclone data** |

**No North Indian Ocean live track source is currently open.** That is a data
access problem, not a code one — the parser handles an `io`/`wp` b-deck the
moment one can be fetched.

**Bhuvan** was checked directly and does not carry cyclone data at all: its API
catalogue is postal/hospital lookup, village geocoding, LULC 50K/250K, shortest
path and geoid conversion. Its access token also expires daily, so it could not
back an unattended pipeline even if the data existed. **MOSDAC** is the ISRO
service that does hold relevant products ("Sat. Based Cyclone Obser. and
Realtime Pred. over IO", plus INSAT-3D imagery), but it requires a registered
account — that credential has to come from the project owner.

### On `tropycal`

`tropycal` is the obvious open-source candidate for this job and was evaluated
against the direct parser. It is **not a dependency**, for three measured
reasons:

- Its one differentiator over NHC — a JTWC path covering the Indian Ocean — also
  returns **403** from here, so it adds no basin coverage.
- It cannot import without `cartopy`, pulling in `pyproj` and `shapely`, and
  takes ~40 s to initialise its dataset object.
- On the NHC path it surfaces exactly the storms a direct fetch already finds.

That is a large plotting-and-analysis stack, and a 40 s startup, to duplicate a
~60-line parser. If it is ever wanted for exploratory analysis or figures, it
belongs in a separate data-prep requirements file, not in the service's
`requirements.txt` — the service must stay deployable without a geospatial
toolchain.

---

## 11. Checkpoints and the registry

A checkpoint contains weights, the architecture config, the fitted scaler, the
feature-set version, the horizons, and the metrics from its own evaluation.
Weights alone would be useless — a model served with a different scaler or
feature layout produces confident nonsense.

Saves are atomic (written to a temporary file, then moved), so an interrupted
save cannot leave a half-written file that later loads as valid.

The registry distinguishes five states:

| State | Meaning | Can serve? |
|---|---|---|
| `TRAINED` | valid checkpoint loaded | yes |
| `UNTRAINED` | architecture exists, no checkpoint | no |
| `CHECKPOINT_INVALID` | checkpoint present but failed validation | no |
| `LOAD_FAILED` | unexpected error while loading | no |
| `UNAVAILABLE` | dependency missing | no |

Only `TRAINED` permits a prediction. Every other state maps to `NOT_AVAILABLE`
with a reason, and none produces a placeholder forecast. Reasons never contain
filesystem paths, exception text or stack traces (section 13).

A checkpoint whose `feature_set_version` does not match the running service is
**rejected**. Tensor shapes would still line up, so nothing would fail at
runtime — the model would simply return confident, wrong numbers.

---

## 12. Inference flow

```
POST /api/v1/analysis/cyclone
  -> schema validation                    400 on failure
  -> history filtered to <= T             temporal safety
  -> sequence + environmental features    same code as training
  -> InsufficientHistory?                 422 INSUFFICIENT_OBSERVATION_HISTORY
  -> per analysis:
       registry TRAINED?  -> scale with the checkpoint's scaler -> predict
       otherwise          -> NOT_AVAILABLE + reason
  -> combine statuses                     COMPLETED / PARTIAL / NOT_AVAILABLE
  -> 200, or 503 when nothing could run
```

**Confidence** is not defined by the contract, so each analysis uses one stated
definition:

- **trajectory** — the validation skill recorded in the checkpoint at training
  time, against a no-change baseline. A property of the model, not the request.
  Omitted entirely when the checkpoint has no such metric; never synthesised.
- **intensity** — the trend classifier's own probability for the class it chose,
  a genuine per-request quantity.

---

## 13. Partial analysis

Each analysis runs independently. Contract section 2 requires that missing
imagery must not prevent a numerical forecast, so a typical response is:

```
trajectoryPrediction  COMPLETED
intensityPrediction   COMPLETED
satelliteAnalysis     NOT_AVAILABLE
-----------------------------------
status                PARTIAL
```

An unexpected error inside one analysis marks that block `FAILED` and leaves
the others untouched.

---

## 14. Future extensions

`app/services/extensions.py` holds the interfaces. Both currently return
`NOT_AVAILABLE` and fabricate nothing.

**Historical similarity** (section 11) may eventually return
`historicalCycloneId`, `similarityScore`, `rank` and `similarityBasis`. FastAPI
returns identifiers and scores only — Spring Boot enriches the historical record
from the application database.

**Explainability** (section 12) must be derived from model output or feature
importance. The contract explicitly forbids using an LLM to invent scientific
reasons, and nothing here does.

---

## 15. Steps to train later

1. Produce an observation table with the columns in section 6.
2. Sanity-check it loads:
   `python -c "from preprocessing.dataset import load_observations; print(load_observations('PATH').shape)"`
3. Train trajectory: `python training/train_trajectory.py --dataset PATH`
4. Train intensity: `python training/train_intensity.py --dataset PATH`
5. Train satellite (needs an imagery catalog, not the observation table):
   `python training/train_satellite.py --catalog CATALOG`
6. These write `checkpoints/trajectory.pt`, `checkpoints/intensity.pt` and
   `checkpoints/satellite.pt`, with evaluation metrics inside.
7. Start the service: `python app/main.py`
8. Confirm: `GET /api/v1/health` should show each trained model
   `available: true`, and the satellite entry lists the sources it saw.

No code changes are required between step 1 and step 8. The service picks up
checkpoints from `checkpoints/` at startup.

---

## 16. Testing

```bash
.venv/Scripts/python -m pytest
```

Covers the API and its status codes, request validation, model shapes and
forward passes, checkpoint round-trips and rejection of corrupt or mismatched
files, every registry state, partial analysis, temporal safety, split leakage,
and one end-to-end run from synthetic data through training to a served
prediction. ATCF parsing is covered too, including the two traps that would
corrupt features silently — each fix repeating once per wind-radii threshold,
and a missing pressure encoded as `0` rather than blank — along with the
live-check guards: that the withheld part of a track never reaches the request,
and that a storm present in the training archive is detected.

That end-to-end test is what makes "training-ready" verifiable rather than
asserted. It uses synthetic data and two epochs, and asserts only plumbing —
does a checkpoint appear, does it load, does the service move from
`NOT_AVAILABLE` to `COMPLETED`. **No test claims scientific accuracy**, and none
can: no model has been trained.

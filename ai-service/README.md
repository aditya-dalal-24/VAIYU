# VAIYU AI Service

Internal AI/ML inference service. Spring Boot is the only intended caller; the
React frontend never calls this service directly (contract section 1).

The authoritative specification is **`VAIYU AI Service Contract.txt`** in
this directory. The architecture is documented in **`docs/AI_ARCHITECTURE.md`**,
and the complete project state for the next machine or agent is in
**`HANDOFF.md`**.

## Status

| Analysis | State |
| --- | --- |
| Trajectory prediction | Trained and serving on 654 held-out storms. 28.6 / 61.7 / 143.9 km mean error at +6/12/24h. Beats linear extrapolation at +24h in all six basins, by 5–17%; at +6h the South Pacific is a wash. |
| Intensity prediction | Trained and serving. Wind MAE 22–31% below persistence; trend accuracy 68% vs a 42% baseline. Wind and pressure are scored on separate sample counts, because a third of North Indian Ocean fixes report a wind and no pressure. |
| Satellite analysis | Architecture, training pipeline and source handling ready; **needs imagery**. Reports `NOT_AVAILABLE` until a checkpoint exists. |
| Historical similarity | Analogue ensemble over 4,178 archive storms. Returns similar storms **and** an independent second forecast. Weakest component: loses to linear extrapolation at +6h and +12h, beats it at +24h by 1.8% (157.9 vs 160.8 km), and is behind the neural track model at every horizon (143.9 km at +24h). Kept for traceability to named storms, not for accuracy. |
| Explainability | Extension point only. |

**Checkpoints are not committed** (they are large and regenerable), so a fresh
clone serves nothing until you train. That is not a failure mode: with no
checkpoint the service runs and reports every analysis as `NOT_AVAILABLE` with a
reason, which is what contract section 2 requires instead of fabricating output.
Follow *Training from scratch* below to produce them.

## Run

```bash
pip install -r requirements.txt
python app/main.py            # http://localhost:8000
```

- `GET  /api/v1/health`: liveness, which models are loaded, and their state
- `POST /api/v1/analysis/cyclone`: unified analysis

`HOST` and `PORT` override the bind address (default `0.0.0.0:8000`) and
`LOG_LEVEL` the logging level.

**Auto-reload is off by default.** Set `RELOAD=1` while editing code. It is
opt-in because the reloader runs the server in a child process, and on Windows
stopping the parent can leave that child alive on the port, still serving the old
code and checkpoints. If a restart seems to change nothing, check for a leftover
process: `netstat -ano | findstr :8000`.

## Test

```bash
python -m pytest              # 305 tests
```

Verified on Python **3.11.9** and **3.13.2**, each from a fresh install of
`requirements.txt`.

---

## Training from scratch

Python 3.11 or newer. Everything below runs from this directory. Nothing outside
`ai-service/` is touched, and no step needs an API key.

### 1. Install

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt        # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux
```

For a CUDA machine, install the matching torch build first; pip does not pick
it by default:

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

The GPU path has not been exercised yet: every run so far has been on CPU.
Checkpoints are saved device-neutral either way.

### 2. Get the data

**Track data (required; this trains trajectory and intensity).** One file, no
account:

```bash
curl -o data/raw/ibtracs.since1980.csv \
  "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.since1980.list.v04r01.csv"
```

About 137 MB. Note the remote file is `ibtracs.since1980.list.v04r01.csv`; it is
saved locally under the shorter name the commands below use. For a quick trial
run, `ibtracs.last3years.list.v04r01.csv` (10 MB) from the same directory works
too (pass it as `--input` in step 3), but produces a much weaker model.

**Satellite imagery (optional; only for satellite analysis).** Three sources
are anticipated; none is in hand yet:

- *NASA IMPACT / GOES Clean IR* (`ImageFolder`): unpack so the tree is
  `data/processed/satellite/images/{train,validation,test}/{cyclone,non_cyclone}/*.jpg`.
  Frames must be named `{storm}_{n}.jpg` so the storm identity survives.
- *HURSAT-style*: a `.npy` label array beside a directory of frames. The array
  in `data/raw/Cyclone_Labels h5.npy` has this shape (21,076 frames, 485
  storms, **Atlantic, East Pacific and West Pacific only, no North Indian**), but
  its image frames are not in the repo.
- *INSAT-3D/3DR via MOSDAC*: the account is active, but the reader is written
  only once a sample file has been checked; see `HANDOFF.md` sections 5 and 10.

**Sea-surface temperature (optional; adds environmental context).** Downloaded
by the preparation step itself in step 3; no account needed, about 94 MB of NOAA
ERSST v5 monthly files cached under `data/raw/ersst/`. Humidity and wind shear
remain unjoined; see *Known gaps*.

### 3. Prepare

Convert the raw downloads into what training consumes:

```bash
# Tracks -> observation table (synoptic 00/06/12/18Z fixes only)
python training/prepare_ibtracs.py \
  --input data/raw/ibtracs.since1980.csv \
  --output data/processed/observations.csv

# Optional: add sea-surface temperature to that table. Downloads NOAA ERSST v5
# monthly means and samples each fix position. Cached and re-runnable; skip it
# and every environmental feature simply stays flagged absent.
python training/prepare_sst.py --observations data/processed/observations.csv

# Imagery -> catalog (only if you have imagery)
python training/prepare_satellite.py imagefolder \
  --root data/processed/satellite/images \
  --output data/processed/satellite/catalog.json
```

`prepare_ibtracs.py` keeps only reported 00/06/12/18Z fixes. IBTrACS's
three-hourly in-between rows are interpolated from the *next* fix, so keeping
them would leak future data into training.

`prepare_satellite.py` refuses to write a catalog it cannot split safely: if a
storm's frames would land in two splits, or a storm id cannot be recovered from
a filename, it fails and says why. Frames three hours apart are nearly
identical, so a frame-level split would report an accuracy that means nothing.

### 4. Train

```bash
python training/train_trajectory.py --dataset data/processed/observations.csv
python training/train_intensity.py  --dataset data/processed/observations.csv

# historical similarity: builds and evaluates the analogue index (no training)
python training/build_analogue_index.py --dataset data/processed/observations.csv

# only if you prepared a catalog
python training/train_satellite.py --catalog data/processed/satellite/catalog.json
```

On the laptop this was developed on (CPU only), the full archive took about
9 minutes for trajectory and 6 for intensity. Early stopping ends a run once
validation loss stops improving. `--device auto` is the default and uses a GPU
when one is present; `--device cuda` fails loudly if none is, rather than
silently training slowly.

**Satellite source dropout.** `train_satellite.py` replaces the source with
UNKNOWN on a fraction of training frames (`--source-dropout`, default `0.2`).
That trains the embedding slot used for images whose sensor the model cannot
identify; without it, that slot would stay at its random starting value. After
training, the held-out split is scored twice, once with the real sources and
once with every source withheld, and both results are stored in the
checkpoint's metrics as `test` and `test_source_withheld`.

**Pressure dropout.** The track and intensity trainers withhold pressure on 15%
of training samples (`pressure_dropout` in `training/config.py`). Pressure is
optional in the contract, and this is what teaches the model to forecast
without it. The trajectory trainer also scores the held-out storms with pressure
withheld, and stores that as `pressure_withheld` in the checkpoint.

Checkpoints land in `checkpoints/` and are picked up at startup. No code change
is needed between training and serving.

### 5. Verify

In this order, because each step checks something the previous one cannot.

```bash
python -m pytest                                    # 1. nothing regressed
python app/main.py                                  # 2. then, in another shell:
curl http://localhost:8000/api/v1/health            #    all models say TRAINED
python evaluation/basin_report.py                   # 3. held-out skill per basin
python evaluation/live_check.py --source ibtracs --list
python evaluation/live_check.py --source ibtracs --storm <NAME>   # 4. end to end
```

Step 3 is the measurement: mean position error per horizon on cyclones the model
never saw, against persistence and linear-extrapolation baselines. **Beating
linear extrapolation is the result that matters**; beating persistence only
means the model knows storms move.

Step 4 forecasts a real current storm from a truncated track and scores it
against the fixes that were withheld. It refuses to score a storm that appears
in the training archive, because that produces excellent and meaningless
numbers. It also says how many of the storm's fixes have no coded nature
(`NR`, shown in the list as `(N uncoded)`), because training used coded
tropical fixes only.

### 6. Hand the checkpoints back

Handover is a file copy:

```
checkpoints/trajectory.pt
checkpoints/intensity.pt
checkpoints/satellite.pt
checkpoints/analogue_index.npz    # and analogue_index.json beside it
```

Drop them into `checkpoints/` on the serving machine and restart. Nothing else
transfers: the fitted scaler, architecture config, horizons, source vocabulary
and evaluation metrics all travel inside the checkpoint file. Checkpoints trained
under Python 3.13 have been served under 3.11 without change.

**Train from the same commit you serve from.** A checkpoint records the
feature-set version it was built under; if the layout has moved the registry
reports `CHECKPOINT_INVALID` rather than running a model against inputs it was
never fitted on. That is the failure most likely to occur when training is split
across machines, and the one that would otherwise be invisible.

---

## Historical similarity (analogue ensemble)

`HISTORICAL_SIMILARITY` finds past storms whose last 24 hours evolved like the
current one, then uses what they did next as a **second, independent forecast**.
It has no learned weights and shares nothing with the neural models, so when
the two agree that is corroboration, and when they disagree that is worth
showing.

The response block carries:
- `similarCyclones`: the contract's evidence list, with IBTrACS SIDs, a
  similarity score in (0, 1], and the basis used (`TRACK_PATTERN`,
  `LOCATION`, `WIND_SPEED`, `PRESSURE` when supplied, `SEASON`). Names and
  seasons are included where the archive has them; per contract §11, Spring
  Boot stays the authority for the historical record.
- `analogueForecast` *(optional field)*: the position and wind at +6/12/24 h,
  the members' spread in km, and the member count.
- `confidence`: the measured skill against persistence on held-out storms.

Only the analogues' track **curvature** is used. Each member contributes its
deviation from its own straight-line motion, added to the current storm's own
extrapolation. Averaging absolute displacements measured worse than plain
linear extrapolation (193 vs 168 km at +24h), because it mixes in every
member's different speed.

Measured on 535 held-out storms (10,067 queries):

| | +6h | +12h | +24h |
| --- | --- | --- | --- |
| Analogue ensemble | 30.3 km | 67.3 km | 160.9 km |
| Linear extrapolation | 29.8 km | 67.9 km | 167.7 km |
| Persistence | 105.5 km | 206.6 km | 398.3 km |
| Wind MAE (persistence) | 7.7 (8.5) kph | 13.4 (16.2) kph | 23.7 (29.1) kph |

Spread correlates only weakly with error (r ≈ 0.3), so treat it as a hint,
not a calibrated uncertainty.

Analogues must have finished before the query time, so a rewind never sees
the future. They must also share the query's hemisphere. The query's own storm
is excluded by space and time, because live and archive identifiers differ.
The index needs at least 12 hours of history and a current wind; without an
index the analysis reports `NOT_AVAILABLE`.

---

## Sending satellite imagery

The contract's request carries a `satelliteImage` with a free-string
`imageType` and no sensor field. To tell the model which sensor an image came
from, put both in `imageType` as **`<SENSOR>|<BAND>`**:

```json
"satelliteImage": {
  "imageUrl": "https://…/frame.png",
  "imageType": "INSAT-3DR|TIR1 10.8 um",
  "capturedAt": "2026-09-08T12:00:00Z"
}
```

- Matching ignores case, repeated spaces and any parenthetical, so
  `insat-3dr | TIR1  10.8 UM` matches too.
- The exact keys a trained model recognises are listed by `GET /api/v1/health`
  under `models.satellite.sources`.
- A plain value such as `"INFRARED"` (the contract's own example) is still valid.
  It is classified using the UNKNOWN slot, and the result carries a note saying
  its confidence is not comparable to a known source.
- `imageUrl` must be http or https, reachable from this service, under 12 MB,
  and must answer within 10 seconds.

No contract change is involved: `imageType` was already a free string.

---

## Known gaps

These are real and stated rather than papered over.

**Four of the six environmental features are still inert.** Sea-surface
temperature is now joined (NOAA ERSST v5 monthly means, sampled per fix by
`training/prepare_sst.py`) and travels the whole way: the backend reads it from
the base fix, sends it in `environmentalData`, and the feature layer pairs it
with its presence flag. Humidity and wind shear are not joined, so those four
features (value and flag each) still carry no information, the scaler records
them as degenerate, and passing them in a request changes no prediction.

What SST is, stated where it is easy to check: a **monthly mean on a 2-degree
grid**. It separates the Bay of Bengal in May from the north Atlantic in
November, and it cannot see a cold wake or a warm eddy, so it describes the
water mass a storm crossed rather than the water under its core. Daily 0.25-degree
OISST would be the better field and needs roughly 21 GB for this archive.
ERA5 humidity and shear via `cdsapi` (free account) are the natural next step
and would make the remaining four features real.

**Satellite analysis has no imagery.** The architecture, source handling,
training loop, evaluation and checkpointing are done and verified end to end on
a synthetic fixture, but no real frames are in hand. The MOSDAC account is
active; the next step is one sample file (see `HANDOFF.md`).

**When nothing can run, the backend loses the reasons.** With no model able to
answer (for example, a fresh clone), the service returns HTTP 503 with the full
analysis body, each block `NOT_AVAILABLE` with a reason, as contract section 14
specifies. The Spring client on branch `Ab4J` turns every non-2xx reply into an
empty result, so those reasons never reach the backend. The fix belongs in the
backend, not here: in `AiServiceClient`, on a 503, read the body with
`e.getResponseBodyAs(AiAnalysisResponse.class)` instead of discarding it.

**Uncoded live fixes.** Training keeps coded tropical fixes only (`NATURE ==
TS`); the live IBTrACS path also admits `NR` (nature not yet coded), because
provisional current-season tracks are largely uncoded. This is deliberate and
measured (see `TROPICAL_NATURES` in `preprocessing/ibtracs_live.py`), and
`live_check.py` reports the count. Some live storms are entirely uncoded (every
fix of KROVANH is), so treat live results on them accordingly.

**No real-time North Indian Ocean feed.** JTWC returns 403, IMD is unreachable,
and Bhuvan carries no cyclone data. The IBTrACS active list covers every basin
without a key but runs one to two days behind. MOSDAC's SCORPIO product may
close this; that is unconfirmed. Details are in `docs/AI_ARCHITECTURE.md`
section 10c.

**Not yet exercised:** training on a GPU; a live call from the Spring Boot
client (only a field-by-field comparison of its DTOs has been done); the
satellite model on real imagery.

**Missing pressure or wind in a request.** A missing pressure is handled: the
track forecast still runs, and its `reason` states the measured held-out error
without pressure (147 km at +24h). Intensity still needs a real pressure to
forecast from. A current fix without wind makes both forecasts decline with a
reason, while other analyses still run.

**Explainability is an extension point.** It reports nothing
(`explanations: []`) and was deliberately not given a placeholder
implementation.

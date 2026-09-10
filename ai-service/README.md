# CycloVision AI Service

Internal AI/ML inference service. Spring Boot is the only intended caller; the
React frontend never calls this service directly (contract section 1).

The authoritative specification is **`CycloVision AI Service Contract.txt`** in
this directory. The architecture is documented in **`docs/AI_ARCHITECTURE.md`**.

## Status

| Analysis | State |
| --- | --- |
| Trajectory prediction | Trained and serving. Beats linear extrapolation in all six basins, by 10–20% at +24h. |
| Intensity prediction | Trained and serving. Wind MAE 22–31% below persistence; trend accuracy 66% vs a 37% baseline. |
| Satellite analysis | Architecture and training pipeline ready; **needs imagery**. Reports `NOT_AVAILABLE` until a checkpoint exists. |
| Historical similarity | Extension point only. Reports `NOT_AVAILABLE` with a reason. |
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

- `GET  /api/v1/health` — liveness and which models are loaded, with state
- `POST /api/v1/analysis/cyclone` — unified analysis

## Test

```bash
python -m pytest              # 232 tests
```

---

## Training from scratch

Python 3.11+ (developed on 3.13). Everything below runs from this directory.
Nothing outside `ai-service/` is touched, and no step needs an API key.

### 1. Install

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt        # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux
```

For a CUDA machine, install the matching torch build first — pip does not pick
it by default:

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

### 2. Get the data

**Track data (required — this trains trajectory and intensity).** One file, no
account:

```bash
curl -o data/raw/ibtracs.since1980.csv \
  "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.since1980.list.v04r01.csv"
```

About 137 MB. Note the remote file is `ibtracs.since1980.list.v04r01.csv`; it is
saved locally under the shorter name the commands below use. For a quick trial
run, `ibtracs.last3years.list.v04r01.csv` (10 MB) from the same directory works
too — pass it as `--input` in step 3 — but produces a much weaker model.

**Satellite imagery (optional — only for satellite analysis).** Either layout is
supported:

- *NASA IMPACT / GOES Clean IR* (`ImageFolder`): unpack so the tree is
  `data/processed/satellite/images/{train,validation,test}/{cyclone,non_cyclone}/*.jpg`.
  Frames must be named `{storm}_{n}.jpg` so the storm identity survives.
- *HURSAT-style*: a `.npy` label array beside a directory of frames. The label
  array in `data/raw/Cyclone_Labels h5.npy` is this shape (21,076 frames, 485
  storms) but the frames themselves are not in the repo.

**Weather data.** Not wired in, and there is nothing to download for it yet —
see *Known gaps*.

### 3. Prepare

Convert the raw downloads into what training consumes:

```bash
# Tracks -> observation table
python training/prepare_ibtracs.py \
  --input data/raw/ibtracs.since1980.csv \
  --output data/processed/observations.csv

# Imagery -> catalog (only if you have imagery)
python training/prepare_satellite.py imagefolder \
  --root data/processed/satellite/images \
  --output data/processed/satellite/catalog.json
```

`prepare_satellite.py` refuses to write a catalog it cannot split safely: if a
storm's frames would land in two splits, or a storm id cannot be recovered from
a filename, it fails and says why. Frames three hours apart are nearly
identical, so a frame-level split would report an accuracy that means nothing.

### 4. Train

```bash
python training/train_trajectory.py --dataset data/processed/observations.csv
python training/train_intensity.py  --dataset data/processed/observations.csv

# only if you prepared a catalog
python training/train_satellite.py --catalog data/processed/satellite/catalog.json
```

On the laptop this was developed on (CPU only), the full archive took about
9 minutes for trajectory and 6 for intensity; a GPU is faster.
Early stopping ends a run once validation loss stops improving. `--device auto` is the default and uses
a GPU when one is present; `--device cuda` fails loudly if none is, rather than
silently training slowly.

Checkpoints land in `checkpoints/` and are picked up at startup. No code change
is needed between training and serving.

### 5. Verify

In this order — each step checks something the previous one cannot.

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
linear extrapolation is the result that matters** — beating persistence only
means the model knows storms move.

Step 4 forecasts a real current storm from a truncated track and scores it
against the fixes that were withheld. It refuses to score a storm that appears
in the training archive, because that produces excellent and meaningless
numbers.

### 6. Hand the checkpoints back

Handover is a file copy:

```
checkpoints/trajectory.pt
checkpoints/intensity.pt
checkpoints/satellite.pt
```

Drop them into `checkpoints/` on the serving machine and restart. Nothing else
transfers — the fitted scaler, architecture config, horizons, source vocabulary
and evaluation metrics all travel inside the checkpoint file.

**Train from the same commit you serve from.** A checkpoint records the
feature-set version it was built under; if the layout has moved the registry
reports `CHECKPOINT_INVALID` rather than running a model against inputs it was
never fitted on. That is the failure most likely to occur when training is split
across machines, and the one that would otherwise be invisible.

---

## Known gaps

These are real and stated rather than papered over.

**The environmental features are inert.** Six of the input features — sea
surface temperature, humidity, wind shear, each with a presence flag — carry no
information, because IBTrACS has no environmental columns and no weather dataset
has been joined in. The scaler records them as degenerate and zeroes them at
inference, so passing `environmentalData` in a request is accepted and changes
no prediction. The models run on kinematics alone. Filling this in means
joining a reanalysis source (ERA5 via `cdsapi`, free account) into the
observation table and retraining; the request schema, feature layer and presence
flags already handle it end to end, so nothing needs redesigning.

**Satellite analysis has no imagery.** The architecture, training loop,
evaluation and checkpointing are done and verified end to end on a synthetic
fixture, but no real frames are in hand. MOSDAC (ISRO) is the one source found
that carries INSAT-3D imagery and North Indian Ocean products together, and it
requires an account.

**No North Indian Ocean live feed with pressure.** JTWC returns 403, IMD is
unreachable, and Bhuvan carries no cyclone data. The IBTrACS active list covers
every basin without a key but runs one to two days behind. Details and the full
source table are in `docs/AI_ARCHITECTURE.md` section 10c.

**Historical similarity and explainability are extension points.** They report
`NOT_AVAILABLE` with a reason and were deliberately not given placeholder
implementations.

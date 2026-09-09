# CycloVision AI Service

Internal AI/ML inference service. Spring Boot is the only intended caller; the
React frontend never calls this service directly (contract section 1).

The authoritative specification is **`CycloVision AI Service Contract.txt`** in
this directory. The architecture is documented in **`docs/AI_ARCHITECTURE.md`**.

## Status

The trajectory and intensity model architectures, preprocessing, training
pipelines, evaluation, checkpoint handling, registry and API are implemented.

**No model has been trained.** With no checkpoints present the service runs and
reports every analysis as `NOT_AVAILABLE` with a reason, which is what contract
section 2 requires instead of fabricating output.

## Run

```bash
pip install -r requirements.txt
python app/main.py            # http://localhost:8000
```

- `GET  /api/v1/health` — liveness and which models are loaded
- `POST /api/v1/analysis/cyclone` — unified analysis

## Train

Once a real dataset exists (format in `docs/AI_ARCHITECTURE.md` section 6):

```bash
python training/train_trajectory.py --dataset path/to/observations.csv
python training/train_intensity.py  --dataset path/to/observations.csv
```

Checkpoints are written to `checkpoints/` and picked up at startup. No code
changes are needed between training and serving.

### Training elsewhere

`--device auto` (default) uses a GPU when one is present. For a CUDA machine,
install the matching torch build:

```bash
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

Checkpoints are saved device-neutral and load onto CPU, so training on a GPU box
and serving on anything else works. Copy `checkpoints/*.pt` back and restart.

Train from the same commit you serve from: a checkpoint records the feature-set
version it was built under, and the registry rejects a mismatch rather than
serving a model against inputs it never saw.

## Test

```bash
python -m pytest
```

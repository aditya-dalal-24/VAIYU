"""Satellite frame inference (contract section 8).

Fetches the referenced image, classifies it, and reports the result with enough
context that a caller can tell how much to trust it.

Three honesty properties are built in rather than documented and hoped for:

* **Source awareness.** The frame's sensor and band decide which embedding the
  model uses. A sensor absent from the training vocabulary still gets an
  answer, but the response says so, because a model trained on GOES clean-IR
  has no basis for the same confidence on an unfamiliar instrument.
* **No invented structure.** Eye, spiral structure, cloud density and centre
  coordinates stay null. No label in the reference dataset supports them, and
  section 8 keeps them optional until a model actually produces them.
* **Failures degrade to NOT_AVAILABLE.** An unreachable URL or an undecodable
  file is a normal outcome, not a 500, and never a guessed detection.
"""

from __future__ import annotations

import io
import logging
import time
import urllib.request
from typing import Optional, Tuple

from app.schemas.contract import (
    AnalysisStatus,
    CycloneAnalysisRequest,
    ModelInfo,
    SatelliteAnalysis,
)
from preprocessing.satellite import build_transform, load_image, source_key
from registry.registry import LoadedModel

logger = logging.getLogger(__name__)

# Ceilings on fetching a caller-supplied image. The service is internal, but a
# URL arriving in a request is still untrusted input.
FETCH_TIMEOUT_SECONDS = 10
MAX_IMAGE_BYTES = 12 * 1024 * 1024

DETECTION_THRESHOLD = 0.5

UNKNOWN_SOURCE_NOTE = (
    "The supplied imagery comes from a source this model was not trained on, "
    "so the result is an extrapolation and its confidence is not comparable "
    "to a known source."
)


def _fetch(image_url: str) -> Tuple[Optional[object], Optional[str]]:
    """Retrieve and decode a frame.

    Returns ``(image, None)`` on success or ``(None, reason)`` on failure. The
    reason is caller-facing, so it names what went wrong without exposing a
    URL's internals, a stack trace or a filesystem path.
    """
    if not image_url.lower().startswith(("http://", "https://")):
        return None, "Only http and https image URLs are supported."

    try:
        request = urllib.request.Request(
            image_url, headers={"User-Agent": "cyclovision-ai-service"}
        )
        with urllib.request.urlopen(request, timeout=FETCH_TIMEOUT_SECONDS) as response:
            payload = response.read(MAX_IMAGE_BYTES + 1)
    except Exception:  # noqa: BLE001 - an unreachable image is a normal outcome
        logger.info("satellite image could not be retrieved")
        return None, "The supplied satellite image could not be retrieved."

    if len(payload) > MAX_IMAGE_BYTES:
        return None, "The supplied satellite image exceeds the size limit."

    try:
        return load_image(io.BytesIO(payload)), None
    except Exception:  # noqa: BLE001
        return None, "The supplied satellite image could not be decoded."


def run_satellite(
    entry: LoadedModel, request: CycloneAnalysisRequest
) -> SatelliteAnalysis:
    """Classify the request's satellite frame, or explain why it could not."""
    if not entry.is_ready:
        return SatelliteAnalysis(
            status=AnalysisStatus.NOT_AVAILABLE, reason=entry.reason
        )

    if request.satellite_image is None:
        return SatelliteAnalysis(
            status=AnalysisStatus.NOT_AVAILABLE,
            reason="No satelliteImage was supplied, so there was nothing to analyse.",
        )

    image, failure = _fetch(request.satellite_image.image_url)
    if image is None:
        return SatelliteAnalysis(
            status=AnalysisStatus.NOT_AVAILABLE, reason=failure
        )

    started = time.perf_counter()

    import torch

    checkpoint = entry.checkpoint

    # The request carries imageType; the sensor itself is not a contract field,
    # so the key falls back to the band alone and lands in UNKNOWN when the
    # model has not seen that combination.
    key = source_key(
        satellite=None,
        spectral_band=None,
        image_type=request.satellite_image.image_type,
    )
    known = checkpoint.knows_source(key)
    index = checkpoint.source_index(key)

    tensor = build_transform(train=False)(image).unsqueeze(0)
    source_tensor = torch.tensor([index], dtype=torch.long)

    with torch.no_grad():
        logit = entry.model(tensor, source_tensor)
        probability = float(torch.sigmoid(logit).squeeze().item())

    detected = probability >= DETECTION_THRESHOLD

    reason = None if known else UNKNOWN_SOURCE_NOTE
    if checkpoint.label_definition:
        # What a positive answer actually means travels with the answer, so a
        # UI cannot present an intensity threshold as presence detection.
        note = f"Positive class: {checkpoint.label_definition}"
        reason = f"{reason} {note}" if reason else note

    return SatelliteAnalysis(
        status=AnalysisStatus.COMPLETED,
        reason=reason,
        cyclone_detected=detected,
        # Confidence in the answer given, not in the positive class.
        confidence=round(probability if detected else 1.0 - probability, 3),
        # Structure features and centre coordinates are deliberately absent:
        # no model produces them.
        model=ModelInfo(
            name=checkpoint.model_name,
            version=checkpoint.model_version,
            inference_time_ms=int((time.perf_counter() - started) * 1000),
        ),
    )

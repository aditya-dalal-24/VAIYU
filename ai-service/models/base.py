"""Shared sequence encoder for the forecasting models.

Both models read the same thing -- a short, irregularly sampled history of
cyclone fixes -- so they share an encoder design while staying separate models
with separate weights and separate checkpoints.

Why a GRU
---------
The input is 3 to 8 steps of a 16-dimensional vector. That rules out a
Transformer, which needs far more data than a cyclone archive provides before
self-attention beats a recurrent baseline, and it rules out flattening into an
MLP, which throws away the ordering that makes the sequence informative. A one
or two layer GRU is the smallest architecture that respects the temporal
structure, and it trains on CPU in minutes.

The encoder packs its input, so the GRU never runs over padding. Masking the
output alone would not be enough: a GRU consumes padded zeros as real timesteps
and its hidden state evolves through them, which would make a four-observation
track encode differently depending on how much padding surrounded it.
"""

from __future__ import annotations

import torch
import torch.nn as nn


class MaskedSequenceEncoder(nn.Module):
    """GRU encoder producing one vector per sequence.

    Concatenates the final real hidden state with a masked mean over all real
    steps: the last state carries the current situation, the mean carries the
    track's overall behaviour, and together they are more stable on very short
    histories than either alone.
    """

    def __init__(
        self,
        step_features: int,
        hidden_size: int = 64,
        num_layers: int = 1,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers

        self.gru = nn.GRU(
            input_size=step_features,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.output_size = hidden_size * 2

    def forward(self, sequences: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
        """Encode ``[batch, steps, features]`` into ``[batch, hidden * 2]``.

        ``mask`` is ``[batch, steps]`` with 1 for real steps and 0 for trailing
        padding. Sequences are packed before the GRU sees them, so the
        encoding of a short track is identical however much padding follows it.
        """
        lengths = mask.sum(dim=1).clamp(min=1).long()

        packed = nn.utils.rnn.pack_padded_sequence(
            sequences,
            lengths.cpu(),
            batch_first=True,
            enforce_sorted=False,
        )
        packed_output, _ = self.gru(packed)
        outputs, _ = nn.utils.rnn.pad_packed_sequence(
            packed_output, batch_first=True, total_length=sequences.size(1)
        )

        expanded = mask.unsqueeze(-1)
        masked = outputs * expanded

        # Padding trails the real steps, so the last real step is at length-1.
        batch_index = torch.arange(outputs.size(0), device=outputs.device)
        last_state = masked[batch_index, lengths - 1]

        mean_state = masked.sum(dim=1) / lengths.unsqueeze(-1).float()

        return torch.cat([last_state, mean_state], dim=-1)


class ForecastHead(nn.Module):
    """Small MLP mapping the encoded state to one horizon's outputs.

    One head per horizon, predicting each horizon directly rather than rolling
    a single-step model forward. Direct heads keep a 24-hour error from being
    the accumulation of four 6-hour errors, and let each horizon learn its own
    behaviour -- a 6-hour track is close to ballistic, a 24-hour one is not.
    """

    def __init__(self, input_size: int, output_size: int, hidden_size: int = 64,
                 dropout: float = 0.1):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_size, hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, output_size),
        )

    def forward(self, encoded: torch.Tensor) -> torch.Tensor:
        return self.net(encoded)


def count_parameters(model: nn.Module) -> int:
    """Trainable parameter count, reported when a training run starts."""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


def resolve_device(preference: str = "auto") -> torch.device:
    """Pick the training device.

    "auto" uses CUDA when it is available and falls back to CPU, so the same
    command works on a laptop and on a GPU box without editing anything.
    Passing "cpu" explicitly is useful for reproducing a run exactly.
    """
    preference = (preference or "auto").lower()

    if preference == "auto":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")

    if preference.startswith("cuda") and not torch.cuda.is_available():
        raise RuntimeError(
            "CUDA was requested but is not available on this machine; "
            "install a CUDA build of torch or pass --device cpu"
        )

    return torch.device(preference)


def device_of(module: nn.Module) -> torch.device:
    """Where a module's parameters live.

    Evaluation and inference build tensors from NumPy, which always lands on
    the CPU; this is how they follow the model instead of assuming it.
    """
    try:
        return next(module.parameters()).device
    except StopIteration:
        return torch.device("cpu")

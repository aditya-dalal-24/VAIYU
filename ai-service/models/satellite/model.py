"""Satellite detection model (contract section 8).

A pretrained convolutional backbone over the frame, conditioned on which sensor
produced it.

Why a pretrained backbone
-------------------------
Cyclone imagery archives are small -- the NASA IMPACT reference set is a few
hundred frames from sixteen storms. Training a convolutional network from
scratch on that memorises it. ImageNet features transfer usefully to satellite
imagery because the early layers learn edges, texture and radial structure,
which is most of what distinguishes an organised storm from a disorganised one.
Only the last block and the head are fine-tuned; freezing the rest is what
keeps a small dataset from destroying general features.

Why source conditioning
-----------------------
Frames arrive from different sensors and bands. Brightness in a GOES 10.7 um
clean-IR frame means cloud-top temperature; brightness in a visible-band frame
means reflected sunlight. Without telling the model which it is looking at, it
must average over the difference, and the average fits neither. A small
embedding of the source key is concatenated with the visual features so the
model can learn a per-sensor offset.

Index 0 of that embedding is reserved for sources unseen in training, so an
unfamiliar sensor produces a defined output that the service flags as
extrapolation rather than a crash or a false equivalence.

Output
------
A single logit for "at or above tropical-storm strength". Structure features --
eye, spiral, cloud density -- and centre coordinates are not produced: no label
in the reference dataset supports them, and section 8 keeps them optional until
a real model does.
"""

from __future__ import annotations

from typing import Dict, List

import torch
import torch.nn as nn

MODEL_NAME = "cyclone-vision-v1"
MODEL_VERSION = "1.0"

# Width of the per-source embedding. Deliberately small: it exists to carry a
# calibration offset, not to let the model identify storms by their sensor.
SOURCE_EMBEDDING_DIM = 8

DEFAULT_DETECTION_THRESHOLD = 0.5


class SatelliteDetectionModel(nn.Module):
    """ResNet-18 backbone with source conditioning and a detection head."""

    def __init__(
        self,
        source_count: int,
        backbone: str = "resnet18",
        pretrained: bool = True,
        dropout: float = 0.4,
        source_embedding_dim: int = SOURCE_EMBEDDING_DIM,
    ):
        super().__init__()
        self.source_count = source_count
        self.backbone_name = backbone
        self.source_embedding_dim = source_embedding_dim

        from torchvision import models

        if backbone != "resnet18":
            raise ValueError(f"unsupported backbone: {backbone}")

        weights = models.ResNet18_Weights.IMAGENET1K_V1 if pretrained else None
        network = models.resnet18(weights=weights)

        feature_dim = network.fc.in_features
        # Drop the classifier; everything before it becomes a feature extractor.
        network.fc = nn.Identity()
        self.backbone = network

        self.source_embedding = nn.Embedding(source_count, source_embedding_dim)

        self.head = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(feature_dim + source_embedding_dim, 1),
        )

        self.feature_dim = feature_dim

    def freeze_backbone(self, trainable_blocks: int = 1) -> None:
        """Freeze all but the last ``trainable_blocks`` residual blocks.

        Called before training. With a few hundred frames, fine-tuning the whole
        network overfits long before it improves.
        """
        for parameter in self.backbone.parameters():
            parameter.requires_grad = False

        blocks = [self.backbone.layer4, self.backbone.layer3, self.backbone.layer2]
        for block in blocks[:trainable_blocks]:
            for parameter in block.parameters():
                parameter.requires_grad = True

    def forward(self, images: torch.Tensor, sources: torch.Tensor) -> torch.Tensor:
        """Return one logit per frame.

        ``images`` is ``[batch, 3, H, W]``; ``sources`` is ``[batch]`` of
        embedding indices, 0 meaning a source not seen in training.
        """
        features = self.backbone(images)
        conditioned = torch.cat([features, self.source_embedding(sources)], dim=-1)
        return self.head(conditioned).squeeze(-1)

    def config(self) -> Dict[str, object]:
        """Architecture parameters, stored in the checkpoint for exact rebuild."""
        return {
            "source_count": self.source_count,
            "backbone": self.backbone_name,
            "source_embedding_dim": self.source_embedding_dim,
        }

    @classmethod
    def from_config(cls, config: Dict[str, object]) -> "SatelliteDetectionModel":
        """Rebuild from a stored config before loading weights.

        ``pretrained=False`` because the checkpoint carries the fine-tuned
        weights; downloading ImageNet weights here would be wasted work and
        would make loading depend on network access.
        """
        return cls(
            source_count=int(config["source_count"]),
            backbone=str(config.get("backbone", "resnet18")),
            pretrained=False,
            source_embedding_dim=int(config.get("source_embedding_dim", SOURCE_EMBEDDING_DIM)),
        )


def trainable_parameter_count(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters() if p.requires_grad)

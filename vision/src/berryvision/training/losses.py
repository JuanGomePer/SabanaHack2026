"""Funciones de pérdida para clasificación con costos asimétricos.

- CE: referencia.
- CE ponderada: w_c = (N / (K * n_c)) ** power, recortada a [w_min, w_max] y
  normalizada a media 1. Se calcula SOLO con los conteos de train.
- Focal (Lin et al., 2017): FL = -(1 - p_t)^gamma * log p_t, con alpha por clase opcional.
"""

from __future__ import annotations

import torch
import torch.nn.functional as F
from torch import nn


def class_weights(counts: dict[str, int], classes: list[str], power: float = 1.0,
                  w_min: float = 0.25, w_max: float = 4.0) -> torch.Tensor:
    n = torch.tensor([float(counts.get(c, 0)) for c in classes])
    if (n == 0).any():
        missing = [c for c, k in zip(classes, n.tolist()) if k == 0]
        raise ValueError(f"Clases sin ejemplos en train: {missing}")
    w = (n.sum() / (len(classes) * n)) ** power
    w = w.clamp(w_min, w_max)
    return w / w.mean()


class FocalLoss(nn.Module):
    def __init__(self, gamma: float = 2.0, alpha: torch.Tensor | None = None):
        super().__init__()
        self.gamma = gamma
        self.register_buffer("alpha", alpha if alpha is not None else None)

    def forward(self, logits: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        logp = F.log_softmax(logits.float(), dim=1)
        logp_t = logp.gather(1, target[:, None]).squeeze(1)
        p_t = logp_t.exp()
        loss = -((1 - p_t) ** self.gamma) * logp_t
        if self.alpha is not None:
            loss = loss * self.alpha[target]
        return loss.mean()


def build_loss(name: str, weights: torch.Tensor | None = None, gamma: float = 2.0) -> nn.Module:
    if name == "ce":
        return nn.CrossEntropyLoss()
    if name == "weighted_ce":
        if weights is None:
            raise ValueError("weighted_ce requiere pesos")
        return nn.CrossEntropyLoss(weight=weights)
    if name == "focal":
        return FocalLoss(gamma=gamma, alpha=weights)
    raise ValueError(f"Pérdida desconocida: {name}")

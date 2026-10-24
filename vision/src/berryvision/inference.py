"""Inferencia a partir de un artefacto de modelo autocontenido (sin dataset de entrenamiento).

Un artefacto es un directorio `<BERRYVISION_MODEL_DIR>/<artifact_id>/` con:
- `model.pt`: solo el `state_dict` (no se ejecuta código pickled: `weights_only=True`);
- `model_card.json`: arquitectura, clases, `imgsz`, umbral de alerta congelado en validación,
  taxonomía, uso previsto y el SHA-256 de `model.pt`.

Antes de cargar se comprueba el SHA-256: un peso truncado o distinto falla con un
mensaje claro. La red se construye sin pesos preentrenados, así que la inferencia
no descarga nada. La salida es informativa: `is_diagnosis` siempre es False.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import torch
from PIL import Image

from .acquisition import sha256_path
from .storage import model_dir
from .training.data import build_transforms
from .training.models import build_model

CARD_REQUIRED = ("artifact_id", "arch", "classes", "healthy_class", "imgsz", "alert_threshold",
                 "weights_file", "weights_sha256", "taxonomy", "intended_use")


class ArtifactError(RuntimeError):
    """El artefacto de modelo falta, está incompleto o no coincide con su ficha."""


def resolve_artifact(ref: str | Path) -> Path:
    """Acepta una ruta a un directorio de artefacto o un id dentro de BERRYVISION_MODEL_DIR."""
    p = Path(ref)
    if not p.is_dir():
        p = model_dir() / str(ref)
    if not p.is_dir():
        raise ArtifactError(f"No existe el artefacto de modelo '{ref}' (buscado en {p}). "
                            "Exporte uno con scripts/export_model_artifact.py o monte BERRYVISION_MODEL_DIR.")
    return p


def load_card(art_dir: Path) -> dict:
    card_path = art_dir / "model_card.json"
    if not card_path.is_file():
        raise ArtifactError(f"Falta {card_path}")
    card = json.loads(card_path.read_text(encoding="utf-8"))
    missing = [k for k in CARD_REQUIRED if k not in card]
    if missing:
        raise ArtifactError(f"model_card.json incompleta, faltan: {missing}")
    if card["healthy_class"] not in card["classes"]:
        raise ArtifactError("healthy_class no está en classes")
    return card


@dataclass
class Predictor:
    card: dict
    model: torch.nn.Module
    device: torch.device

    @classmethod
    def load(cls, ref: str | Path, device: str = "cpu") -> "Predictor":
        art = resolve_artifact(ref)
        card = load_card(art)
        weights = art / card["weights_file"]
        if not weights.is_file():
            raise ArtifactError(f"Faltan los pesos {weights}")
        if sha256_path(weights) != card["weights_sha256"]:
            raise ArtifactError(f"SHA-256 de {weights.name} no coincide con model_card.json (archivo dañado o cambiado)")
        model = build_model(card["arch"], len(card["classes"]), pretrained=False, dropout=card.get("dropout", 0.0))
        model.load_state_dict(torch.load(weights, map_location="cpu", weights_only=True))
        dev = torch.device(device)
        return cls(card, model.to(dev).eval(), dev)

    @torch.inference_mode()
    def predict(self, images: list[Image.Image]) -> list[dict]:
        tf = build_transforms(self.card["imgsz"], train=False)
        x = torch.stack([tf(im.convert("RGB")) for im in images]).to(self.device)
        probs = torch.softmax(self.model(x).float(), 1).cpu()
        classes, h = self.card["classes"], self.card["classes"].index(self.card["healthy_class"])
        out = []
        for p in probs:
            top = int(p.argmax())
            alert_score = float(1.0 - p[h])
            out.append({
                "top_class": classes[top], "confidence": float(p[top]),
                "alert_score": alert_score, "alert": alert_score >= self.card["alert_threshold"],
                "alert_threshold": self.card["alert_threshold"], "taxonomy": self.card["taxonomy"],
                "model_version": self.card["artifact_id"], "is_diagnosis": False,
                "probs": {c: float(v) for c, v in zip(classes, p)},
            })
        return out

"""Datasets y DataLoaders a partir del manifiesto unificado.

Normalización: se usan las constantes de ImageNet porque los backbones están
preentrenados con ellas; no son estadísticas calculadas con nuestros datos (y por
tanto no pueden filtrar información de val/test). Se aplica UNA sola vez, al final
de la transformación.
"""

from __future__ import annotations

import random
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision.transforms import v2

from ..preprocess import letterbox_image

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


class Letterbox:
    """Redimensiona conservando la proporción y rellena (nunca estira)."""

    def __init__(self, size: int):
        self.size = size

    def __call__(self, img: Image.Image) -> Image.Image:
        return letterbox_image(img, self.size)[0]


def build_transforms(imgsz: int, train: bool, aug: dict | None = None):
    aug = aug or {}
    steps = [Letterbox(imgsz)]
    if train:
        if aug.get("hflip", True):
            steps.append(v2.RandomHorizontalFlip())
        if aug.get("vflip", False):
            steps.append(v2.RandomVerticalFlip())
        if aug.get("rotation", 0):
            steps.append(v2.RandomRotation(aug["rotation"], fill=114))
        cj = aug.get("color_jitter")
        if cj:
            steps.append(v2.ColorJitter(*cj))
        if aug.get("jpeg_quality"):  # el robot entrega MJPEG
            steps.append(v2.RandomApply([v2.JPEG(tuple(aug["jpeg_quality"]))], p=0.5))
        if aug.get("blur_p", 0):
            steps.append(v2.RandomApply([v2.GaussianBlur(5, sigma=(0.1, 1.2))], p=aug["blur_p"]))
    steps += [v2.ToImage(), v2.ToDtype(torch.float32, scale=True), v2.Normalize(IMAGENET_MEAN, IMAGENET_STD)]
    return v2.Compose(steps)


class ManifestDataset(Dataset):
    def __init__(self, rows: list[dict], classes: list[str], vision_root: Path, transform):
        self.rows = rows
        self.class_to_idx = {c: i for i, c in enumerate(classes)}
        self.root = Path(vision_root)
        self.transform = transform

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        r = self.rows[i]
        with Image.open(self.root / r["rel_path"]) as im:
            img = im.convert("RGB")  # orden RGB explícito
        return self.transform(img), self.class_to_idx[r["canonical_label"]], i

    def class_counts(self) -> dict[str, int]:
        return dict(Counter(r["canonical_label"] for r in self.rows))


def select_rows(manifest: list[dict], source_id: str, split: str, include_augmented: bool = True) -> list[dict]:
    out = [r for r in manifest if r["source_id"] == source_id and r["split"] == split and r["canonical_label"]]
    if not include_augmented:
        out = [r for r in out if not r["is_augmented"]]
    return out


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def _worker_init(worker_id: int) -> None:
    s = torch.initial_seed() % 2**32
    np.random.seed(s)
    random.seed(s)


def make_loader(ds: Dataset, batch_size: int, train: bool, num_workers: int = 4, seed: int = 0) -> DataLoader:
    g = torch.Generator()
    g.manual_seed(seed)
    return DataLoader(
        ds, batch_size=batch_size, shuffle=train,          # mezcla solo en train
        drop_last=train and len(ds) > batch_size,          # evita un último lote de 1 imagen con BN en train
        num_workers=num_workers, pin_memory=torch.cuda.is_available(),
        persistent_workers=num_workers > 0, worker_init_fn=_worker_init, generator=g)

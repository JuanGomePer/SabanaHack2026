"""Modelos: ResNet preentrenada (bloques residuales + BatchNorm) y una CNN pequeña de referencia."""

from __future__ import annotations

import torch
from torch import nn
from torchvision import models as tvm

RESNETS = {
    "resnet18": (tvm.resnet18, tvm.ResNet18_Weights.IMAGENET1K_V1),
    "resnet34": (tvm.resnet34, tvm.ResNet34_Weights.IMAGENET1K_V1),
    "resnet50": (tvm.resnet50, tvm.ResNet50_Weights.IMAGENET1K_V2),
}


class SmallCNN(nn.Module):
    """Referencia sin conexiones residuales ni preentrenamiento (Conv-BN-ReLU-MaxPool x4)."""

    def __init__(self, num_classes: int, width: int = 32, dropout: float = 0.2):
        super().__init__()
        layers, c_in = [], 3
        for k in range(4):
            c_out = width * 2**k
            layers += [nn.Conv2d(c_in, c_out, 3, padding=1, bias=False), nn.BatchNorm2d(c_out),
                       nn.ReLU(inplace=True), nn.MaxPool2d(2)]
            c_in = c_out
        self.features = nn.Sequential(*layers)
        self.head = nn.Sequential(nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Dropout(dropout), nn.Linear(c_in, num_classes))

    def forward(self, x):
        return self.head(self.features(x))


def build_model(name: str, num_classes: int, pretrained: bool = True, freeze_backbone: bool = False,
                dropout: float = 0.0) -> nn.Module:
    if name == "smallcnn":
        return SmallCNN(num_classes, dropout=dropout)
    if name not in RESNETS:
        raise ValueError(f"Modelo desconocido: {name}")
    fn, weights = RESNETS[name]
    model = fn(weights=weights if pretrained else None)
    in_f = model.fc.in_features
    model.fc = nn.Sequential(nn.Dropout(dropout), nn.Linear(in_f, num_classes)) if dropout else nn.Linear(in_f, num_classes)
    if freeze_backbone:
        for n, p in model.named_parameters():
            if not n.startswith("fc."):
                p.requires_grad = False
    return model


def set_bn_eval(model: nn.Module) -> None:
    """Congela las estadísticas de BatchNorm preentrenadas (útil con lotes pequeños o datasets chicos)."""
    for m in model.modules():
        if isinstance(m, nn.modules.batchnorm._BatchNorm):
            m.eval()
            for p in m.parameters():
                p.requires_grad = False


def count_params(model: nn.Module) -> tuple[int, int]:
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    return total, trainable


def param_groups(model: nn.Module, lr: float, backbone_lr_mult: float = 1.0):
    head, body = [], []
    for n, p in model.named_parameters():
        if not p.requires_grad:
            continue
        (head if n.startswith(("fc.", "head.")) else body).append(p)
    groups = [{"params": head, "lr": lr}]
    if body:
        groups.append({"params": body, "lr": lr * backbone_lr_mult})
    return groups


@torch.no_grad()
def measure_latency(model: nn.Module, imgsz: int, device, batch: int = 1, n: int = 50) -> dict:
    """Latencia en el equipo de desarrollo (indicativa; NO representa PC2)."""
    import time
    model.eval()
    x = torch.randn(batch, 3, imgsz, imgsz, device=device)
    for _ in range(10):
        model(x)
    if device.type == "cuda":
        torch.cuda.synchronize()
        torch.cuda.reset_peak_memory_stats()
    t = time.perf_counter()
    for _ in range(n):
        model(x)
    if device.type == "cuda":
        torch.cuda.synchronize()
    ms = (time.perf_counter() - t) / n * 1000
    mem = torch.cuda.max_memory_allocated() / 2**20 if device.type == "cuda" else None
    return {"latency_ms_per_batch": round(ms, 3), "batch": batch, "imgsz": imgsz, "peak_mem_mib": mem}

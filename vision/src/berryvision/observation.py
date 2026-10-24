"""Contrato de salida propuesto para una observación del robot.

Es una propuesta (v0) para que la aplicación consuma resultados sin depender
del entrenamiento. No es una API implementada. La especificación equivalente
en JSON Schema está en contracts/observation.schema.json.

Reglas que el contrato hace explícitas:
- `confidence` es la confianza del modelo visual, no la probabilidad de infección.
- Las lecturas ambientales llevan siempre sensor de origen y fecha de medición
  y viven separadas de los hallazgos visuales.
- La ubicación desconocida se deja en None; nunca se inventa.
"""

from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime

SCHEMA_VERSION = "0.2.0"
REVIEW_STATUSES = ("pending", "confirmed", "rejected", "needs_field_check")


@dataclass
class Location:
    farm_id: str | None = None
    block_id: str | None = None
    greenhouse_id: str | None = None  # "nave"
    bed_id: str | None = None  # "cama"
    position: str | None = None  # p. ej. "tramo 3/10" o distancia en metros desde la cabecera
    method: str | None = None  # cómo se obtuvo: "ruta_predefinida", "odometria", "manual"...


@dataclass
class VisualFinding:
    class_name: str
    confidence: float
    taxonomy: str  # p. ej. "blueberry_leaf/drberry-v1"; evita mezclar clases de otros cultivos
    bbox_xyxy: list[float] | None = None  # píxeles de la imagen original
    mask_reference: str | None = None
    # Fase posterior (docs/10): None hasta que el registro RGB-profundidad esté validado.
    depth_m: float | None = None
    point_xyz_m: list[float] | None = None
    point_frame_id: str | None = None


@dataclass
class EnvironmentalReading:
    variable: str  # "temperature_c", "relative_humidity_pct"...
    value: float
    source_sensor_id: str
    measured_at: str  # ISO 8601
    distance_to_bed_m: float | None = None  # None = desconocida, no "cerca"


@dataclass
class Observation:
    observed_at: str
    model_version: str
    image_reference: str
    camera_id: str
    location: Location = field(default_factory=Location)
    visual_findings: list[VisualFinding] = field(default_factory=list)
    environmental_context: list[EnvironmentalReading] = field(default_factory=list)
    review_status: str = "pending"
    observation_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    schema_version: str = SCHEMA_VERSION

    def validate(self) -> list[str]:
        problems: list[str] = []
        for name in ("observed_at",):
            try:
                datetime.fromisoformat(getattr(self, name))
            except (TypeError, ValueError):
                problems.append(f"{name} no es ISO 8601")
        for name in ("model_version", "image_reference", "camera_id"):
            if not getattr(self, name):
                problems.append(f"{name} es obligatorio")
        if self.review_status not in REVIEW_STATUSES:
            problems.append(f"review_status inválido: {self.review_status}")
        for i, f in enumerate(self.visual_findings):
            if not 0.0 <= f.confidence <= 1.0:
                problems.append(f"visual_findings[{i}].confidence fuera de [0,1]")
            if not f.taxonomy:
                problems.append(f"visual_findings[{i}].taxonomy es obligatoria")
            if f.bbox_xyxy is not None:
                if len(f.bbox_xyxy) != 4:
                    problems.append(f"visual_findings[{i}].bbox_xyxy debe tener 4 valores")
                else:
                    x1, y1, x2, y2 = f.bbox_xyxy
                    if x2 <= x1 or y2 <= y1:
                        problems.append(f"visual_findings[{i}].bbox_xyxy degenerada")
            if f.depth_m is not None and f.depth_m <= 0:
                problems.append(f"visual_findings[{i}].depth_m debe ser positiva")
            if f.point_xyz_m is not None and (len(f.point_xyz_m) != 3 or not f.point_frame_id):
                problems.append(f"visual_findings[{i}].point_xyz_m requiere 3 valores y point_frame_id")
        for i, r in enumerate(self.environmental_context):
            if not r.source_sensor_id:
                problems.append(f"environmental_context[{i}] sin sensor de origen")
            try:
                datetime.fromisoformat(r.measured_at)
            except (TypeError, ValueError):
                problems.append(f"environmental_context[{i}].measured_at no es ISO 8601")
        return problems

    def to_dict(self) -> dict:
        return asdict(self)

"""Riesgo AMBIENTAL de infección por Botrytis (componente separado de la visión).

Referencia: Rivera, Zoffoli & Latorre (2013), Plant Disease, doi:10.1094/PDIS-12-12-1112-RE.
Algoritmo publicado: periodos de > 6 h de humectación con temperatura entre 14 y 25 °C se
asociaron con la incidencia de moho gris en fruta almacenada (Chile; r = 0,96). Los autores
indican que falta validación de campo.

Este módulo:
- calcula EVENTOS DE RIESGO por sensor a partir de series de temperatura y humectación;
- si no hay sensor de humectación foliar, usa como sustituto HR >= umbral (configurable) y lo
  declara explícitamente (`wetness_source = "proxy_rh"`); el sustituto no está validado;
- marca huecos de datos: un periodo con huecos no se considera "continuo";
- NUNCA produce un diagnóstico ni una etiqueta de enfermedad, y no actúa sobre ventilación.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass(frozen=True)
class RiskParams:
    t_min: float = 14.0
    t_max: float = 25.0
    min_wet_hours: float = 6.0
    rh_wet_threshold: float = 90.0          # SOLO para el sustituto por HR (no validado)
    max_gap: timedelta = timedelta(minutes=30)
    reference: str = "Rivera, Zoffoli & Latorre 2013 (doi:10.1094/PDIS-12-12-1112-RE)"


@dataclass
class Reading:
    sensor_id: str
    at: datetime
    temp_c: float | None
    rh_pct: float | None = None
    leaf_wet: bool | None = None            # sensor de humectación foliar, si existe


def _favorable(r: Reading, p: RiskParams) -> tuple[bool | None, str]:
    if r.temp_c is None:
        return None, "sin_temperatura"
    if r.leaf_wet is not None:
        wet, src = r.leaf_wet, "leaf_wetness_sensor"
    elif r.rh_pct is not None:
        wet, src = r.rh_pct >= p.rh_wet_threshold, "proxy_rh"
    else:
        return None, "sin_humectacion"
    return (wet and p.t_min <= r.temp_c <= p.t_max), src


def risk_events(readings: list[Reading], params: RiskParams | None = None) -> list[dict]:
    """Devuelve periodos continuos favorables por sensor; `risk=True` si superan min_wet_hours."""
    p = params or RiskParams()
    out: list[dict] = []
    by_sensor: dict[str, list[Reading]] = {}
    for r in readings:
        by_sensor.setdefault(r.sensor_id, []).append(r)
    for sid, rs in by_sensor.items():
        rs.sort(key=lambda r: r.at)
        start = prev = None
        sources: set[str] = set()

        def close(end: datetime):
            hours = (end - start).total_seconds() / 3600
            out.append({"sensor_id": sid, "start": start.isoformat(), "end": end.isoformat(),
                        "hours": round(hours, 2), "risk": hours > p.min_wet_hours,
                        "wetness_source": "+".join(sorted(sources)), "reference": p.reference,
                        "kind": "riesgo_ambiental", "is_diagnosis": False})

        for r in rs:
            fav, src = _favorable(r, p)
            gap = prev is not None and (r.at - prev.at) > p.max_gap
            if start is not None and (gap or not fav):
                close(prev.at)
                start, sources = None, set()
            if fav:
                if start is None:
                    start = r.at
                sources.add(src)
            prev = r
        if start is not None:
            close(prev.at)
    return out


def data_gaps(readings: list[Reading], max_gap: timedelta = timedelta(minutes=30)) -> list[dict]:
    gaps = []
    by_sensor: dict[str, list[Reading]] = {}
    for r in readings:
        by_sensor.setdefault(r.sensor_id, []).append(r)
    for sid, rs in by_sensor.items():
        rs.sort(key=lambda r: r.at)
        for a, b in zip(rs, rs[1:]):
            if b.at - a.at > max_gap:
                gaps.append({"sensor_id": sid, "from": a.at.isoformat(), "to": b.at.isoformat(),
                             "minutes": round((b.at - a.at).total_seconds() / 60, 1)})
    return gaps

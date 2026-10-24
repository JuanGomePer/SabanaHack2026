# Datasets

| Archivo | Contenido |
|---|---|
| `catalog.yaml` | Ficha v2 de cada fuente: versión, URL, clases, conteos verificados, anotación, licencia, acceso, estado, papel y resultado de auditoría |
| `taxonomy.yaml` | Clases canónicas, equivalencias permitidas y prohibidas, y clases no entrenables |
| `dataset_comparison.md` | Histórico de la primera comparación (superada por el informe de selección) |
| `../../reports/dataset_selection_report.md` | Informe de selección reproducible (decisiones, evidencia, auditoría, plan) |
| `../../reports/dataset_selection_matrix.csv` | Matriz de 11 fuentes × 37 columnas |
| `../claims_pending_verification.md` | Cifras del equipo sin fuente (80 %, 50 %) |

Las decisiones sobre datos se registran en la bitácora general `../decision_log.md` (D-018 en adelante), para no mantener dos bitácoras.

## Reglas

1. Los datos **no** se versionan. Se descargan con `scripts/acquire/*` en `vision/data/external/<id>/` (ignorado), que deja un `ACQUISITION.json` con su procedencia.
2. Antes de usar un dataset hay que registrar en `catalog.yaml` la versión, la licencia y la salida de `scripts/audit_local_datasets.py`.
3. No se redistribuyen datasets con restricciones (Thrip_Leaf, Hybrid NC) ni se comparten enlaces con contraseña.
4. Las imágenes aumentadas o sintéticas jamás entran en validación ni test. Las particiones se hacen por grupos (`scripts/make_group_splits.py`).
5. Las clases se nombran según `taxonomy.yaml`; nunca se fusionan cultivos, órganos o niveles de anotación distintos.
6. Si un número cambia tras la auditoría, se actualiza el catálogo y se anota en `../decision_log.md`.

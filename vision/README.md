# vision/: inspección fitosanitaria de arándanos con el AgiBot X2 Ultra

Módulo de visión por computadora de SabanaHack2026 (reto AGRAR Berry Good Idea). Analiza imágenes de la cámara RGB-D frontal del **AgiBot X2 Ultra** y produce **hallazgos visuales documentados** (clase validada, región, confianza, imagen, versión del modelo y ubicación declarada) para que el responsable agronómico priorice inspecciones.

**Solo informa.** No controla ventiladores, riego ni el robot. **Nunca se ejecuta en PC1** (control de movimiento, 10.0.1.40).

Empiece por `docs/00_resumen_ejecutivo.md`.

## Estructura

```text
vision/
├── CLAUDE.md                 # contexto y reglas para futuras sesiones
├── pyproject.toml            # dependencias propias (Pillow, PyYAML; pytest en dev)
├── configs/                  # x2_vision.yaml (validada), experiments/ (E1, E3), splits/ (manifiestos por grupo)
├── contracts/                # contrato JSON de una observación (propuesta v0.2.0)
├── docs/                     # 00–12: resumen, contexto, robot X2, alcance, arquitectura, estrategia,
│                             #        evaluación, riesgos, roadmap, captura, 3D, datasets, adquisición
├── knowledge/                # fuentes, datasets, robótica, agronomía, decisiones
├── data/                     # solo .gitkeep en Git
├── scripts/                  # auditoría, densidad de píxeles, validación de config
│   ├── acquire/              # descargas reproducibles con ACQUISITION.json (sin credenciales en archivos)
│   ├── build_manifest.py, train_classifier.py, select_experiment.py, evaluate_final.py, report_metrics.py
│   └── robot/                # inspección y captura en PC2 (solo lectura, bloquean PC1)
├── manifests/                # vista versionada del manifiesto unificado y su meta (hashes, fugas)
├── notebooks/                # 01 EDA y preparación · 02 entrenamiento y evaluación (ejecutados)
├── src/berryvision/          # audit, acquisition, splits, manifest, training/, preprocess, calibration, config, safety, optics, observation
├── tests/                    # 62 pruebas con datos sintéticos
└── reports/                  # informes y matriz de datasets
```

## Uso rápido

```bash
cd vision
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"     # Linux/macOS: .venv/bin/python
.venv/Scripts/python -m pytest -q
.venv/Scripts/python scripts/validate_config.py
.venv/Scripts/python scripts/audit_local_datasets.py --root data/external/<dataset>
```

## Estado

Diseño, herramientas y documentación para el X2 Ultra listos y probados localmente. Selección de datasets hecha (`reports/dataset_selection_report.md`). Descargados y auditados solo los auxiliares (PlantVillage y PlantDoc de arándano). **DrBerry (núcleo) bloqueado sin `ROBOFLOW_API_KEY`; sin acceso al robot.** Único entrenamiento: experimento **auxiliar en fresa** (E4c, `reports/experiment_report.md`); **no hay modelo de arándano**. Bloqueos en `docs/07_riesgos_y_preguntas_abiertas.md`.

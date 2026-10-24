# data/ (nada de esto se versiona salvo los .gitkeep)

| Carpeta | Contenido |
|---|---|
| `external/<id>/` | Datasets públicos tal como se descargaron (solo lectura). `<id>` coincide con `knowledge/datasets/catalog.yaml` |
| `raw/` | Datos propios sin procesar (fotos de campo de AGRAR) |
| `robot_captures/` | Rosbags y fotogramas extraídos del robot. **Reservados para el test**, salvo decisión explícita |
| `processed/` | Conversiones derivadas, siempre con un manifiesto de procedencia (archivo original + hash) |

Estado local (2026-10-23): `external/plantvillage_blueberry_healthy/` (1.502 img) y `external/plantdoc_blueberry/` (117 img), cada uno con `ACQUISITION.json`. Se reconstruyen con `scripts/acquire/fetch_github_subset.py`. `raw/_downloads/` es temporal.

`external/strawberry_hybrid/` (579 MB, CC BY-NC 4.0) desde 2026-10-24. `processed/manifest_v1.csv` lo genera `scripts/build_manifest.py`.

Antes de descargar: verifica la licencia y el espacio (`df -h`) y registra la URL exacta y la fecha en el catálogo.

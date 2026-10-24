# data/ (nada de esto se versiona salvo los .gitkeep)

| Carpeta | Contenido |
|---|---|
| `external/<id>/` | Datasets públicos tal como se descargaron (solo lectura). `<id>` coincide con `knowledge/datasets/catalog.yaml` |
| `raw/` | Datos propios sin procesar (fotos de campo de AGRAR) |
| `robot_captures/` | Rosbags y fotogramas extraídos del robot. **Reservados para el test**, salvo decisión explícita |
| `processed/` | Conversiones derivadas, siempre con un manifiesto de procedencia (archivo original + hash) |

Estado local (2026-10-23): `external/plantvillage_blueberry_healthy/` (1.502 img) y `external/plantdoc_blueberry/` (117 img), cada uno con `ACQUISITION.json`. Se reconstruyen con `scripts/acquire/fetch_github_subset.py`. `raw/_downloads/` es temporal.

`external/strawberry_hybrid/` (579 MB, CC BY-NC 4.0) desde 2026-10-24. `processed/manifest_v1.csv` lo genera `scripts/build_manifest.py`.

`external/blueberry_dcm/` (CC BY-NC 4.0) y `external/blueberry_yolo_zhang/` (CC BY 4.0) desde 2026-10-24, ambos verificados con el MD5 publicado. Datos propios de AGRAR en `raw/agrar/<finca>/<sesión>/` (confidenciales, ignorados); referencias visuales sin licencia de reutilización en `reference_only/` (ignorado).

Antes de descargar: verifica la licencia y el espacio (`df -h`) y registra la URL exacta y la fecha en el catálogo.

Desde D-044 la ubicación se configura con `BERRYVISION_DATA_DIR` y las dos fuentes autorizadas se verifican con `scripts/prepare_data.py verify` contra `manifests/data_lock/`. Ver `docs/14_persistence_and_deployment.md`.

## Descargar los datos (repo privado de Hugging Face, D-049)

Los archivos no están en GitHub: están en el repo de datasets **privado** `sofnun1109/berryvision-data` (pide acceso a quien lo administra). Git guarda los hashes en `manifests/data_lock/<id>.csv` para verificar la descarga.

```bash
cd vision
pip install -e ".[hub]"
hf auth login                                   # tu token; nunca en archivos del repo
export BERRYVISION_HF_REPO=sofnun1109/berryvision-data   # PowerShell: $env:BERRYVISION_HF_REPO="sofnun1109/berryvision-data"
python scripts/sync_hub.py status
python scripts/sync_hub.py pull-data blueberry_yolo_zhang   # o blueberry_dcm, strawberry_hybrid, plantdoc_blueberry, plantvillage_blueberry_healthy
python scripts/sync_hub.py pull-model E4c_04_originals_ce
```

# Persistencia de datos, artefactos y despliegue (Docker / Railway)

## A. Diagnóstico (2026-10-24, con evidencia)

Síntoma informado: tras publicar en `main` y desplegar con Docker en Railway, "dejaron de estar disponibles los datos".

| Evidencia | Qué muestra |
|---|---|
| `vision/.gitignore` (desde el primer commit 9aa92fb) | `data/raw/*`, `data/external/*`, `data/processed/*`, `runs/`, `*.pt` nunca se versionan. En Git solo hay `.gitkeep` y manifiestos CSV |
| `.dockerignore` de la raíz en `main` (commit 1f21536, otro integrante) | excluye `vision/` completo y `server/fotos/*.jpg/.png/.webp` |
| `web/Dockerfile` | copia solo `shared/` y `web/`; nunca `vision/` ni `server/fotos` |
| `railway.api.json` (Nixpacks) y `railway.web.json` | sin volumen declarado; el servidor sirve fotos desde `server/fotos/` dentro del contenedor |
| Copia local (`_backups/…/data_inventory.csv`) | los 13.337 archivos de datos (905 MB) siguen en el equipo de desarrollo |

**Causa raíz confirmada (escenarios 1, 2 y 3):** los datos de visión nunca salieron del equipo local: no están en Git y, aunque lo estuvieran, el `.dockerignore` y el `Dockerfile` los excluyen. No es un efecto de "compresión" de Railway.

**Causa probable (escenario 5), no verificada sin acceso a Railway:** cualquier foto copiada a `server/fotos/` dentro de un contenedor en ejecución se pierde en cada redeploy, porque no hay volumen. Los datos de la app (Postgres gestionado) no dependen de la imagen.

**Datos perdidos:** ninguno demostrado. No se pudo inspeccionar el servicio de Railway (sin CLI ni credenciales); si alguien subió fotos solo al contenedor, esas sí podrían haberse perdido.

## B. Arquitectura correcta

| Elemento | Dónde vive | Cómo se verifica |
|---|---|---|
| Código, configs, manifiestos, bloqueos de hash | Git (`vision/`) | pruebas (`pytest`) |
| Datasets | `BERRYVISION_DATA_DIR` (por defecto `vision/data`), fuera de Git y de la imagen | `scripts/prepare_data.py verify` contra `manifests/data_lock/<id>.csv` |
| Artefactos de modelo (`model.pt` + `model_card.json`) | `BERRYVISION_MODEL_DIR` (por defecto `vision/artifacts/models`); se montan en `/models` | SHA-256 de la ficha, comprobado al cargar |
| Datos persistentes de ejecución (fotos del robot en la app) | volumen de Railway o almacenamiento de objetos: **pendiente, decisión del equipo de `main`** | — |

No hay bucket configurado ni credenciales de almacenamiento: no se subió ningún dataset. Las licencias además lo limitan: DrBerry y Zhang son CC BY (redistribuibles con atribución); BlueberryDCM y la fresa de Mendeley son CC BY-NC.

## C. Uso

```bash
cd vision
.venv/Scripts/python scripts/prepare_data.py verify                 # complete / missing / incomplete / modified
.venv/Scripts/python scripts/prepare_data.py prepare --source blueberry_yolo_zhang   # idempotente
.venv/Scripts/python scripts/prepare_data.py prepare --source drberry_pry20220204    # requiere ROBOFLOW_API_KEY
.venv/Scripts/python scripts/prepare_data.py lock --source drberry_pry20220204       # tras auditarla
.venv/Scripts/python scripts/export_model_artifact.py <experimento>                  # runs/ → artifacts/models/
.venv/Scripts/python scripts/predict.py --artifact <id> foto.jpg
.venv/Scripts/python scripts/eval_field_domain.py --artifact <id>                    # tasa de alerta en campo
docker build -t berryvision-infer vision
docker run --rm -v <modelos>:/models:ro -v <fotos>:/in:ro berryvision-infer --artifact <id> /in/foto.jpg
```

Reglas: `prepare` descarga a `.part`, verifica tamaño, MD5 y SHA-256, extrae a un directorio de preparación, valida etiquetas y solo entonces lo mueve al destino. Nunca sobrescribe una copia existente que no coincide. Ningún build de Docker descarga datos.

## D. Docker y Railway

- `vision/Dockerfile`: solo inferencia (CPU). `vision/.dockerignore` es una lista blanca (`src/`, `scripts/predict.py`, `requirements-infer.txt`). Verificado en local (imagen de 1,51 GB): no contiene imágenes, pesos ni `.env`, corre como usuario sin privilegios, infiere con el modelo montado y sin `/data`, y sin modelo sale con código 3 y un mensaje claro.
- El módulo de visión **no está desplegado en Railway** y esta rama no modifica la configuración de `main`.
- Volúmenes de Railway: se montan al arrancar. Lo escrito durante el build no aparece en el volumen. Nunca poblarlo en el build ni sobrescribirlo al arrancar.
- Para la Jetson (PC2), dentro del contenedor podman: hace falta una base L4T con PyTorch para JetPack. Pendiente.

## E. Pendiente

1. `ROBOFLOW_API_KEY` (variable de entorno) → preparar, auditar y congelar DrBerry → experimento base E1.
2. Decidir, con el equipo de la app, un volumen o almacenamiento de objetos para las fotos reales de `server/fotos/`.
3. Imagen L4T para PC2.

# Imagen de INFERENCIA del módulo de visión (CPU, x86_64/arm64 genérico).
#
# Contiene solo código y dependencias. NO contiene datasets, pesos ni secretos:
#   - el artefacto de modelo (model.pt + model_card.json) se monta en /models;
#   - los datos, si hicieran falta, se montan en /data (la inferencia no los necesita).
# Así un redeploy nunca "pierde" datos: nunca estuvieron en la imagen (ver docs/14).
#
# Contexto de build = vision/ (su .dockerignore es una lista blanca):
#   docker build -t berryvision-infer vision
#   docker run --rm -v <dir_modelos>:/models:ro -v <dir_imgs>:/in:ro berryvision-infer \
#       --artifact E4c_04_originals_ce /in/foto.jpg
# Para la Jetson (PC2) hace falta una base L4T con PyTorch para JetPack: pendiente (docs/14).
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app/src \
    BERRYVISION_MODEL_DIR=/models \
    BERRYVISION_DATA_DIR=/data

WORKDIR /app
COPY requirements-infer.txt .
RUN pip install -r requirements-infer.txt

COPY src/berryvision ./src/berryvision
COPY scripts/predict.py ./scripts/predict.py

RUN useradd --uid 10001 --no-create-home berry
USER berry

ENTRYPOINT ["python", "scripts/predict.py"]

#!/usr/bin/env bash
# Ejecuta en orden los experimentos auxiliares E4c (fresa). No toca el split de test.
# Uso: bash scripts/run_aux_experiments.sh [patrón]
cd "$(dirname "$0")/.."
PY=.venv/Scripts/python; [ -x "$PY" ] || PY=.venv/bin/python
mkdir -p reports/experiments
for cfg in configs/experiments/aux_strawberry/E4c_${1:-*}.yaml; do
  id=$(basename "$cfg" .yaml)
  if [ -f "reports/experiments/$id/run_info.json" ]; then echo "== $id ya existe, se omite"; continue; fi
  echo "== $id ($(date +%H:%M:%S))"
  "$PY" -u scripts/train_classifier.py "$cfg" > "reports/experiments/$id.log" 2>&1
  tail -1 "reports/experiments/$id.log"
done

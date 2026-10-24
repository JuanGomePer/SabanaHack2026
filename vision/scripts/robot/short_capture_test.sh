#!/usr/bin/env bash
# Prueba de captura BREVE (por defecto 5 s) del RGB comprimido + CameraInfo.
# Solo en PC2, con autorización del responsable del robot, con el robot quieto.
# Comprueba espacio antes de grabar y que el bag se puede leer después.
#
# Uso: bash short_capture_test.sh --yes [segundos] [directorio_salida]
set -eu

[ "${1:-}" = "--yes" ] || { echo "Requiere --yes (confirmación de autorización)"; exit 1; }
DUR="${2:-5}"
OUT_ROOT="${3:-$HOME/agrar_vision/captures}"
NS="/aima/hal/sensor/rgbd_head_front"
MIN_FREE_GB=5

LOCAL_IPS="$(hostname -I 2>/dev/null || true)"
for ip in 10.0.1.40 192.168.88.88; do
  echo " $LOCAL_IPS " | grep -q " $ip " && { echo "ABORTADO: IP de PC1 ($ip)"; exit 2; }
done
echo " $LOCAL_IPS " | grep -q " 10.0.1.41 " || { echo "ABORTADO: no es PC2 (10.0.1.41)"; exit 2; }
[ "$DUR" -le 30 ] || { echo "Esta prueba admite como máximo 30 s"; exit 1; }

mkdir -p "$OUT_ROOT"
FREE_GB=$(df -BG --output=avail "$OUT_ROOT" | tail -1 | tr -dc '0-9')
[ "$FREE_GB" -ge "$MIN_FREE_GB" ] || { echo "Espacio insuficiente: ${FREE_GB} GB"; exit 1; }

SESSION="$OUT_ROOT/test_$(date +%Y%m%d_%H%M%S)"
echo "Grabando ${DUR}s en $SESSION (solo RGB comprimido + CameraInfo, sin profundidad cruda)"
timeout --signal=INT "$((DUR + 2))" ros2 bag record -o "$SESSION" \
  "$NS/rgb_image/compressed" "$NS/rgb_camera_info" || true

ros2 bag info "$SESSION"
du -sh "$SESSION"
echo "Siguiente paso: extraer fotogramas con scripts/robot/extract_frames.py (en PC2 o en el PC de desarrollo con rosbag2_py)."

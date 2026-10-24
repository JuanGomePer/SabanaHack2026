#!/usr/bin/env bash
# Inspección de SOLO LECTURA de la cámara RGB-D del AgiBot X2 Ultra.
#
# Ejecutar ÚNICAMENTE en PC2 (10.0.1.41), dentro del contenedor de desarrollo
# o con el entorno ROS 2 Humble del SDK cargado. Nunca en PC1.
# No envía comandos, no cambia modos, no graba rosbags.
#
# Uso: bash inspect_rgbd_interfaces.sh [directorio_salida]
set -u

PC1_IPS="10.0.1.40 192.168.88.88"
PC2_IP="10.0.1.41"
NS="/aima/hal/sensor/rgbd_head_front"
OUT_DIR="${1:-$HOME/agrar_vision/inspections}"   # fuera de $HOME/aimdk* (mantenido por el sistema)

LOCAL_IPS="$(hostname -I 2>/dev/null || true)"
for ip in $PC1_IPS; do
  if echo " $LOCAL_IPS " | grep -q " $ip "; then
    echo "ABORTADO: esta máquina tiene la IP $ip de PC1 (control de movimiento). Prohibido." >&2
    exit 2
  fi
done
if ! echo " $LOCAL_IPS " | grep -q " $PC2_IP "; then
  echo "AVISO: no se detecta la IP de PC2 ($PC2_IP). El fabricante desaconseja suscribirse a" >&2
  echo "       la cámara desde otra unidad. Solo se consultará metadatos (CameraInfo, hz breve)." >&2
fi
command -v ros2 >/dev/null || { echo "ros2 no disponible: cargue el entorno del SDK" >&2; exit 3; }

mkdir -p "$OUT_DIR"
REPORT="$OUT_DIR/rgbd_inspection_$(date +%Y%m%d_%H%M%S).txt"
run() { echo -e "\n\$ $*" | tee -a "$REPORT"; timeout 20 "$@" 2>&1 | tee -a "$REPORT"; }

{
  echo "# Inspección RGB-D X2 - $(date -Iseconds)"
  echo "hostname: $(hostname)"; echo "ips: $LOCAL_IPS"
  echo "en contenedor: $([ -f /run/.containerenv ] || [ -f /.dockerenv ] && echo si || echo no)"
  echo "ROS_DISTRO: ${ROS_DISTRO:-?}"
  [ -f /etc/nv_tegra_release ] && echo "L4T: $(head -1 /etc/nv_tegra_release)"
  df -h "$OUT_DIR" | tail -1
} | tee "$REPORT"

run bash -c "ros2 topic list | grep -E '^$NS' || true"
run ros2 topic echo "$NS/rgb_camera_info" --once
run ros2 topic echo "$NS/depth_camera_info" --once
run ros2 topic info "$NS/rgb_image/compressed" -v
run ros2 topic info "$NS/depth_image" -v
run ros2 topic hz "$NS/rgb_image/compressed" --window 30
run ros2 topic echo "$NS/rgb_image/compressed" --once --field format
run ros2 run tf2_ros tf2_echo rgbd_head_front rgbd_depth_head_front

echo -e "\nInforme: $REPORT"
echo "Copie el informe al repositorio solo si no contiene datos sensibles; nunca copie la calibración de fábrica."

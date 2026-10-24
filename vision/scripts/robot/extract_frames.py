"""Extrae fotogramas JPEG y metadatos de un rosbag de la cámara RGB-D del X2.

Requiere un entorno ROS 2 Humble con rosbag2_py (PC2 dentro del contenedor o
un PC de desarrollo con ROS 2). No requiere conexión al robot.

Uso:
    python extract_frames.py <bag_dir> <out_dir> [--every N] [--session-id ID]

Cada fotograma se guarda tal como vino (el payload MJPEG/JPEG, sin
recomprimir) junto con un manifest.csv con marca de tiempo, frame_id y las
dimensiones del último CameraInfo, para conservar la trazabilidad.
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from berryvision.safety import assert_not_pc1  # noqa: E402

RGB = "/aima/hal/sensor/rgbd_head_front/rgb_image/compressed"
INFO = "/aima/hal/sensor/rgbd_head_front/rgb_camera_info"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("bag")
    ap.add_argument("out", type=Path)
    ap.add_argument("--every", type=int, default=10, help="guardar 1 de cada N fotogramas")
    ap.add_argument("--session-id", default=None)
    args = ap.parse_args()
    assert_not_pc1()

    import rosbag2_py  # noqa: import tardío: solo existe en entornos ROS 2
    from rclpy.serialization import deserialize_message
    from sensor_msgs.msg import CameraInfo, CompressedImage

    reader = rosbag2_py.SequentialReader()
    reader.open(rosbag2_py.StorageOptions(uri=args.bag, storage_id=""),
                rosbag2_py.ConverterOptions("cdr", "cdr"))
    session = args.session_id or Path(args.bag).name
    args.out.mkdir(parents=True, exist_ok=True)
    info_wh = (None, None)
    n_seen = n_saved = 0
    with open(args.out / "manifest.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["file", "session_id", "stamp_ns", "frame_id", "format", "info_width", "info_height"])
        while reader.has_next():
            topic, raw, _ = reader.read_next()
            if topic == INFO:
                msg = deserialize_message(raw, CameraInfo)
                info_wh = (msg.width, msg.height)
            elif topic == RGB:
                n_seen += 1
                if (n_seen - 1) % args.every:
                    continue
                msg = deserialize_message(raw, CompressedImage)
                stamp = msg.header.stamp.sec * 10**9 + msg.header.stamp.nanosec
                name = f"{session}_{stamp}.jpg"
                (args.out / name).write_bytes(bytes(msg.data))
                w.writerow([name, session, stamp, msg.header.frame_id, msg.format, *info_wh])
                n_saved += 1
    print(f"{n_saved} fotogramas guardados de {n_seen} en {args.out}")
    print("Valide luego con: python scripts/audit_local_datasets.py --root", args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

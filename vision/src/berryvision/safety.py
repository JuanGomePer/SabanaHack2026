"""Guardia de seguridad: nunca ejecutar código de visión en PC1 del AgiBot X2.

La documentación oficial de AimDK X2 prohíbe usar el computador de control de
movimiento (PC1, 10.0.1.40; 192.168.88.88 por Wi-Fi) como entorno de
compilación o ejecución de desarrollo secundario. PC2 (Jetson Orin NX) usa
10.0.1.41 por cable. Cualquier otra máquina se considera un equipo de
desarrollo externo.

La detección por IP es una salvaguarda adicional, no una garantía: antes de
operar sobre el robot hay que confirmar a mano en qué máquina se está.
"""

from __future__ import annotations

import socket
import subprocess
import sys

PC1_ADDRESSES = frozenset({"10.0.1.40", "192.168.88.88"})
PC2_ADDRESSES = frozenset({"10.0.1.41"})


class ForbiddenHostError(RuntimeError):
    """Se intentó ejecutar en el computador de control de movimiento (PC1)."""


def local_ipv4_addresses() -> set[str]:
    addrs: set[str] = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            addrs.add(info[4][0])
    except OSError:
        pass
    if sys.platform.startswith("linux"):
        try:
            out = subprocess.run(["hostname", "-I"], capture_output=True, text=True, timeout=5).stdout
            addrs.update(a for a in out.split() if a.count(".") == 3)
        except (OSError, subprocess.SubprocessError):
            pass
    return addrs


def classify_host(addresses: set[str] | None = None) -> str:
    """Devuelve 'pc1', 'pc2' o 'external'. PC1 tiene prioridad si hay ambigüedad."""
    addrs = local_ipv4_addresses() if addresses is None else set(addresses)
    if addrs & PC1_ADDRESSES:
        return "pc1"
    if addrs & PC2_ADDRESSES:
        return "pc2"
    return "external"


def assert_not_pc1(addresses: set[str] | None = None) -> str:
    """Lanza ForbiddenHostError si la máquina actual parece ser PC1."""
    role = classify_host(addresses)
    if role == "pc1":
        raise ForbiddenHostError(
            "Esta máquina tiene una IP de PC1 (control de movimiento del X2). "
            "Está prohibido ejecutar desarrollo secundario aquí. Use PC2 (10.0.1.41) "
            "dentro del contenedor o un equipo externo."
        )
    return role

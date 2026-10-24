# configs/

| Ruta | Contenido |
|---|---|
| `x2_vision.yaml` | Robot, topics, QoS, modelo e inferencia (validar con `scripts/validate_config.py`) |
| `audit_targets.example.yaml` | Lista de datasets para `audit_local_datasets.py --config` |
| `experiments/` | Definición de experimentos (E1 bloqueado, E3 planificado). No contienen resultados |
| `experiments/aux_strawberry/` | E4c (fresa, auxiliar): `_base.yaml` + 9 variantes de un factor |
| `experiments/drberry/` | E1 de arándano, bloqueado |
| `splits/` | Manifiestos de particiones por grupo (solo rutas relativas; versionables) |

Nunca se guardan credenciales (API key de Roboflow, etc.): se usan variables de entorno.

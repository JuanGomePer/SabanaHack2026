# Hoja de ruta (por dependencias, sin fechas inventadas)

| Fase | Paso | Depende de | Criterio para avanzar |
|---|---|---|---|
| C | 1. Acceso y licencias: `ROBOFLOW_API_KEY` en la sesión; decidir si se pide Thrip_Leaf; solicitud de imágenes a AGRAR | — | **Hecho en parte**: licencias y URLs en `catalog.yaml` v2; la key sigue pendiente |
| C | 2. Descargar DrBerry original v1 + gen-3-20 v1 (`fetch_roboflow.py`); Afzaal cuando el enlace vuelva | 1 | `ACQUISITION.json` presente; fuera de Git. (PlantVillage y PlantDoc auxiliares: **hecho**) |
| C | 3. Auditar (`audit_local_datasets.py --samples`) + comparar versiones + revisión manual de ~50 img por clase | 2 | Conteos, `box_stats` (¿hoja o lesión?), solapamiento y fugas documentados. (Auxiliares: **hecho**) |
| C | 4. Normalizar a `data/processed/` con manifiesto de procedencia | 3 | Script reproducible + hashes de origen |
| C | 5. Particiones por grupo (`make_group_splits.py`); congelar el test público | 3–4 | Split versionado sin fugas. (Auxiliares: **hecho**) |
| E | 6. Inspección de solo lectura en PC2 (`inspect_rgbd_interfaces.sh`) | Acceso autorizado a PC2 | `CameraInfo`, Hz, QoS, SDK y TensorRT registrados en `docs/02` |
| E | 7. Captura corta de prueba (5 s) + extracción | 6 | Bag legible; `manifest.csv` correcto |
| E | 8. Sesiones de captura según `09_captura_datos_x2.md` + etiquetado con agrónomo | 7 | ≥ 1 sesión etiquetada **congelada como test** |
| D | 9. Baseline E1 + control E1c (equipo de desarrollo) | 5 | Métricas por clase con comando, commit y semilla. **Pipeline validado en fresa (E4c, hecho)**; `configs/experiments/drberry/E1_leaf_cls.yaml` listo, bloqueado por DrBerry |
| D | 10. E3: `imgsz` 640 frente a 1280 o recortes a la densidad del X2 | 9 + 6 | Curva de recall frente a tamaño de lesión; `imgsz` decidido |
| E | 11. E5: evaluar en el test del robot | 8 + 10 | Métricas reales y galería de fallos |
| E | 12. E6: ONNX → TensorRT FP16 **construido en el contenedor de PC2**; medir latencia y memoria | 10 + acceso a PC2 | Mediciones reales; sin afirmar tiempo real antes |
| — | 13. Profundidad / 3D según `10_profundidad_y_localizacion_3d.md` | 11 + calibración verificada | Error de distancia medido en escena de prueba |
| — | 14. Integración con la app (`04`) | Backend del equipo + 11 | Observaciones v0.2.0 válidas consumidas por la app |

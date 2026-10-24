# Protocolo de evaluación

> Todavía no existe ninguna métrica. Este documento define cómo se medirá. Cualquier número que aparezca en el repositorio debe enlazar a la ejecución reproducible que lo produjo (comando, commit, semilla, versión de los datos).

## Particiones

1. Inspeccionar el split original de cada dataset (DrBerry: desconocido; Afzaal: 1450/307/743).
2. Buscar fugas: duplicados exactos (SHA-256, ya implementado), casi-duplicados (hash perceptual, pendiente), aumentaciones de la misma imagen base y fotos de la misma planta o sesión.
3. Siempre que haya metadatos, partir por **grupo** (planta, sesión o fuente), no por imagen.
4. Ninguna imagen aumentada o sintética entra en validación ni test.
5. **Test de dominio real**: imágenes de la RGB-D del X2 Ultra (protocolo `09_captura_datos_x2.md`), separadas **por sesión**, etiquetadas con revisión agronómica y nunca usadas para entrenar ni ajustar umbrales.

## Métricas

Detección: precision, recall, mAP@0.5 y mAP@0.5:0.95 **por clase**, matriz de confusión (incluido el fondo) y recall por tamaño de caja en píxeles.
Segmentación (E4): AP de máscara, IoU y Dice por clase y por tamaño de lesión.
Todas las tareas: falsos positivos por imagen sana, falsos negativos y resolución de entrada; errores por especie, **distancia**, iluminación y **tamaño de lesión en píxeles**.

Rendimiento: latencia por imagen (decodificación + preprocesamiento + inferencia + postproceso), memoria GPU/RAM y FPS **medidos en PC2** (Orin NX 16 GB), dentro del contenedor y con el engine TensorRT construido allí. Medir con el SDK del robot en marcha, porque PC2 comparte recursos. Las cifras del equipo de desarrollo (RTX 4050) no se presentan como rendimiento en el robot.

Para alertas tempranas, el **recall** a un umbral fijo importa más que el mAP: perder una lesión es peor que revisar una falsa alarma. El umbral se fija en validación, nunca en test.

`confidence` no está calibrada. No se presenta como probabilidad de infección.

## Evidencia visual obligatoria por experimento

Guardar en `reports/<experimento>/` (sin imágenes de datasets restringidos):

- aciertos;
- falsas alarmas;
- lesiones no detectadas;
- hojas sanas mal clasificadas;
- imágenes fuera de dominio;
- desglose por fuente y especie.

La demo debe mostrar también los fallos.

# Solicitud de datos a AGRAR — inspección fitosanitaria de arándano

**Para:** equipo de AGRAR Ingeniería y, por su intermedio, sus clientes de arándano
**De:** equipo Sabana Hack 2026 — Berry Good Idea (módulo de visión)
**Fecha:** 2026-10-24

## Por qué lo pedimos

Revisamos 33 fuentes públicas y **no existe un banco de imágenes de Botrytis ni de trips en arándano** con diagnóstico confiable al que podamos acceder. Para Alternaria hay un dataset peruano (DrBerry), pero con fotos de celular de otra región. Un modelo útil para detección **temprana** necesita imágenes de **sus** fincas, con casos confirmados, y también ejemplos sin síntomas tomados en las mismas condiciones. Detalle: `blueberry_image_repository_audit.md`.

## Qué pedimos

1. **Fotografías originales** (sin reescalar ni recortar) de:
   - **Botrytis**: flores, frutos verdes y maduros, cáliz y brotes; casos **tempranos**, claros y ambiguos.
   - **Alternaria**: hojas con manchas pequeñas y frutos afectados.
   - **Trips**: insecto visible en flor u hoja joven, daño compatible y trampas adhesivas.
   - **Parecidos**: otras enfermedades, deficiencias, daño mecánico, quemadura, senescencia.
   - **Sin síntomas visibles**: de **las mismas fincas, camas, fechas y cámara** que los casos positivos.
2. **Diagnóstico**: para cada caso, si fue confirmado y cómo (especialista, cámara húmeda, laboratorio), quién lo hizo y cuándo. Basta con que una parte esté confirmada; el resto se marcará como *sospechado*.
3. **Ubicación y fecha**: finca, bloque, nave, cama, planta o posición, fecha y hora.
4. **Registros ambientales cercanos**: temperatura, humedad relativa, humectación foliar si existe, y estado de la ventilación, con **identificador del sensor, hora y ubicación del sensor**. Lo pedimos solo en lectura; el sistema **nunca** controla ventiladores ni controladores.
5. **Procedencia**: quién tomó cada foto y con qué equipo.
6. **Permisos** (en documento aparte, firmado por quien tenga la titularidad):
   - uso para **investigación y demostración académica** en la hackathon;
   - uso para **entrenar modelos** (autorización separada, si aplica);
   - cualquier otro uso futuro (comercial o publicación) se acordaría por separado.
7. **Confidencialidad**: dónde y cómo almacenarlos. Proponemos almacenamiento local cifrado, fuera de repositorios públicos, acceso restringido al equipo y borrado al terminar si así lo piden.

## Formato sugerido

- Una carpeta por finca y fecha, con las imágenes originales y una hoja de cálculo con una fila por imagen (columnas como en `contracts/agrar_capture_metadata.schema.json`; podemos enviar la plantilla).
- Si es más fácil, fotos con su diagnóstico en el nombre o en un mensaje; nosotros las estructuramos.

## También queremos aclarar

- ¿De dónde provienen las cifras «más del 80 % de los afectados» y «50 % Botrytis»? ¿Qué población, periodo y método las respaldan? (`knowledge/claims_pending_verification.md`)
- ¿Qué es «Trips» en su ecosistema (el insecto o un sistema)?
- ¿Qué APIs o exportaciones existen para los sensores (Azure, Power BI) y con qué permisos?

## Qué devolvemos

Un informe de calidad de los datos; el resultado del modelo **por clase**, incluidos los **falsos negativos** y sus límites; y la aclaración explícita de qué no puede afirmarse todavía.

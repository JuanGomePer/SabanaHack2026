# Guía de anotación — arándano (v1)

Para quien etiquete imágenes de AGRAR o revise fuentes públicas. Taxonomía en `knowledge/datasets/blueberry_taxonomy.yaml`; metadatos en `contracts/agrar_capture_metadata.schema.json`. **Ante la duda, `unknown` o `*_suspected`, nunca `*_confirmed`.**

## 1. Tres decisiones por cada objeto

1. **Condición:** qué se ve (botrytis, alternaria, trips, parecido, sin síntomas).
2. **Evidencia:** cómo se sabe (`lab_confirmed`, `expert_confirmed`, `suspected`, `no_visible_symptoms`, `unknown`). El anotador **no** puede asignar `*_confirmed` sin un informe o experto identificado.
3. **Tarea:** qué geometría corresponde (lesión, órgano o imagen).

## 2. Geometría según la tarea

| Tarea | Qué se delimita | Regla |
|---|---|---|
| `lesion_detection` | **Cada lesión** o insecto | Caja ajustada a la lesión visible (mancha, área necrótica, micelio) o polígono si el contorno es irregular. Varias lesiones separadas = varias cajas. **Nunca** usar la caja de la hoja |
| `organ_classification` | El órgano completo (hoja, fruto, flor) | Una caja o polígono por órgano, con la condición del órgano |
| `image_level` | Nada | Solo para triaje; no sirve para localizar |
| `thrips_insect_on_plant` | El insecto | Solo si el insecto es identificable a la resolución de la imagen. Si no, no se anota |
| `thrips_damage_compatible` | La zona deformada | Siempre `suspected` |
| `thrips_on_sticky_trap` | Cada insecto en la trampa | Tarea de monitoreo; no se mezcla con las anteriores |

## 3. Síntomas de referencia (orientativos; la confirmación la da un especialista)

| Condición | Señales | Se confunde con |
|---|---|---|
| **Botrytis** (*B. cinerea*) | Flor parda y necrótica (tizón); fruto blando y pardo, con esporulación **gris** polvorienta; brotes necróticos; preferentemente en flor y fruto (INIA Chile) | Alternaria (micelio blanco ralo sobre herida que se tupe en 2–3 días; INIA Uruguay 2014), antracnosis (masas salmón), mummy berry (*Monilinia*: fruto momificado gris, hojas pardo-rosadas), senescencia de flor, daño mecánico |
| **Alternaria** | Hoja: manchas pequeñas pardas o necróticas, a veces con halo. Fruto: pudrición con micelio oliváceo a negro | Otras manchas foliares, quemadura por fertilizante, orificios de Heliothis, oídio inicial |
| **Trips** | Flor dañada (*Frankliniella*); hoja joven encrespada o deformada (*Scirtothrips*); el insecto mide ~1–1,5 mm (Rutgers) | Deficiencias nutricionales, herbicida, deformaciones fisiológicas, ácaros |
| **Sin síntomas visibles** | Nada relevante a la resolución de la imagen | No significa sana confirmada |

Referencias visuales (no redistribuibles): Herbario Virtual de la FAUBA, INIA Uruguay 2014, INIA Chile Boletín 48 y Rutgers. Ver `blueberry_image_sources.yaml`.

## 4. Casos que van a `unknown` o a revisión agronómica

- Lesión borrosa, ocluida o demasiado pequeña para juzgar.
- Coexistencia de dos posibles causas.
- Daño sin patrón claro (mecánico frente a enfermedad).
- Cualquier `*_suspected` de Botrytis en flor o fruto: **se envía a revisión** con prioridad.

## 5. Proceso

- **Herramienta:**
  - CVAT, recomendada: cajas y polígonos, flujo de revisión y exportación COCO.
  - Label Studio: si se quieren los campos de evidencia como formulario.
- **Versión maestra** en COCO + `captures.jsonl`. Cada corrección deja un registro (quién, cuándo, qué cambió); nunca se sobrescribe sin historial.
- **Doble anotación** del 10–20 %: medir el acuerdo por clase (kappa de Cohen) y resolver discrepancias con un especialista.
- **Errores de etiqueta sospechados:** se marcan, no se corrigen en silencio.

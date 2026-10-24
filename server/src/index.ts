/**
 * API de Vigía · Monitor de cultivo.
 * Express + datos en memoria. Cumple el contrato de @vigia/shared/tipos.
 */

import cors from 'cors';
import express from 'express';
import {
  DISPOSITIVO_GAFAS,
  NOTA_DATOS_EJEMPLO,
  USUARIO,
  etiquetaPlanta,
} from '@vigia/shared/config';
import type { RevisionHallazgo } from '@vigia/shared/tipos';
import {
  aAlerta,
  anotar,
  configuracion,
  construirCamas,
  construirMapa,
  construirResumen,
  filasRegistro,
  hallazgos,
  listarAlertas,
  plantas,
  registro,
  registroCsv,
  resumenRegistro,
  revisores,
  serieHumedad,
  vecinas,
} from './datos';
import { eventos, listarEquipos } from './equipos';
import { fotoReal, placeholderSvg } from './fotos';
import { arrancarLatido, programarAlertaDemo, reiniciarDemo } from './simulador';
import { emitir, suscribir } from './sse';

const app = express();
const PUERTO = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

// ── Mapa y resumen ──────────────────────────────────────────────────────────
app.get('/api/mapa', (_req, res) => {
  res.json(construirMapa());
});

app.get('/api/resumen', (_req, res) => {
  res.json(construirResumen());
});

app.get('/api/camas', (_req, res) => {
  res.json(construirCamas());
});

app.get('/api/camas/:numero', (req, res) => {
  const numero = Number(req.params.numero);
  const cama = construirCamas().find((c) => c.numero === numero);
  if (!cama) return res.status(404).json({ error: 'Cama no encontrada' });
  res.json(cama);
});

// ── Detalle de planta ───────────────────────────────────────────────────────
app.get('/api/plantas/:id', (req, res) => {
  const planta = plantas.get(req.params.id);
  if (!planta) return res.status(404).json({ error: 'Planta no encontrada' });

  const hallazgo = planta.hallazgoId ? hallazgos.get(planta.hallazgoId) : undefined;

  res.json({
    planta,
    etiqueta: etiquetaPlanta(planta.cama, planta.planta),
    hallazgo: hallazgo ?? null,
    serieHumedad: serieHumedad(planta.id),
    vecinas: vecinas(planta.id).map((v) => ({
      ...v,
      etiqueta: etiquetaPlanta(v.cama, v.planta),
    })),
  });
});

// ── Hallazgos ───────────────────────────────────────────────────────────────
app.get('/api/hallazgos', (_req, res) => {
  res.json([...hallazgos.values()]);
});

app.get('/api/hallazgos/:id', (req, res) => {
  const hallazgo = hallazgos.get(req.params.id);
  if (!hallazgo) return res.status(404).json({ error: 'Hallazgo no encontrado' });
  res.json(hallazgo);
});

/** Confirmar o marcar como falsa alarma. */
app.post('/api/hallazgos/:id/revision', (req, res) => {
  const hallazgo = hallazgos.get(req.params.id);
  if (!hallazgo) return res.status(404).json({ error: 'Hallazgo no encontrado' });

  const revision = req.body?.revision as RevisionHallazgo | undefined;
  if (revision !== 'confirmada' && revision !== 'falsa_alarma') {
    return res.status(400).json({ error: 'revision debe ser "confirmada" o "falsa_alarma"' });
  }

  hallazgo.revision = revision;
  revisores.set(hallazgo.id, USUARIO.firma);

  const planta = plantas.get(hallazgo.plantaId);
  if (planta) {
    if (revision === 'falsa_alarma') {
      // Deja de ser alerta: vuelve a riesgo u ok según su humedad.
      planta.hallazgoId = undefined;
      planta.estado =
        planta.humedad >= configuracion.umbrales.humedadRiesgo ? 'riesgo' : 'ok';
    } else {
      planta.estado = 'alerta';
    }
    emitir({ tipo: 'estado_cambiado', plantaId: planta.id, estado: planta.estado });
  }

  anotar({
    plantaId: hallazgo.plantaId,
    cama: hallazgo.cama,
    accion: revision,
    tipo: hallazgo.tipo,
    usuario: USUARIO.nombre,
    nota:
      typeof req.body?.nota === 'string' && req.body.nota.trim()
        ? req.body.nota.trim()
        : revision === 'confirmada'
          ? `${hallazgo.tipo} confirmada en ${etiquetaPlanta(hallazgo.cama, hallazgo.planta)}.`
          : `Marcada como falsa alarma en ${etiquetaPlanta(hallazgo.cama, hallazgo.planta)}.`,
  });

  res.json({ hallazgo, alerta: aAlerta(hallazgo), resumen: construirResumen() });
});

/**
 * Envío del hallazgo a las gafas.
 * SIMULACIÓN: el servidor solo cambia el estado y responde. No hay ninguna
 * integración real con Meta Quest ni con ningún visor.
 */
app.post('/api/hallazgos/:id/enviar-a-gafas', (req, res) => {
  const hallazgo = hallazgos.get(req.params.id);
  if (!hallazgo) return res.status(404).json({ error: 'Hallazgo no encontrado' });

  hallazgo.gafas = 'enviado';
  const enviadoEn = new Date().toISOString();

  anotar({
    plantaId: hallazgo.plantaId,
    cama: hallazgo.cama,
    accion: 'enviada_a_gafas',
    tipo: hallazgo.tipo,
    usuario: USUARIO.nombre,
    nota: `Hallazgo enviado a ${DISPOSITIVO_GAFAS} para revisar en sitio (simulado).`,
  });

  // El "acuse de recibo" del visor llega poco después.
  setTimeout(() => {
    const actual = hallazgos.get(req.params.id);
    if (actual && actual.gafas === 'enviado') actual.gafas = 'recibido';
  }, 1500);

  res.json({
    hallazgoId: hallazgo.id,
    gafas: hallazgo.gafas,
    dispositivo: DISPOSITIVO_GAFAS,
    enviadoEn,
  });
});

// ── Alertas ─────────────────────────────────────────────────────────────────
app.get('/api/alertas', (req, res) => {
  const revision = req.query.revision as RevisionHallazgo | undefined;
  const alertas = listarAlertas();
  res.json(revision ? alertas.filter((a) => a.revision === revision) : alertas);
});

// ── Registro de incidencias ─────────────────────────────────────────────────
app.get('/api/registro', (_req, res) => {
  res.json({ filas: filasRegistro(), resumen: resumenRegistro() });
});

/** Bitácora de acciones (confirmaciones, envíos a las gafas, alertas nuevas). */
app.get('/api/registro/movimientos', (_req, res) => {
  res.json(registro);
});

app.get('/api/registro.csv', (_req, res) => {
  res.type('text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="registro-vigia.csv"');
  res.send(registroCsv());
});

// ── Configuración ───────────────────────────────────────────────────────────
app.get('/api/configuracion', (_req, res) => {
  res.json(configuracion);
});

app.put('/api/configuracion', (req, res) => {
  const { estructura, umbrales } = req.body ?? {};
  if (estructura) Object.assign(configuracion.estructura, estructura);
  if (umbrales) Object.assign(configuracion.umbrales, umbrales);
  res.json(configuracion);
});

// ── Equipos ─────────────────────────────────────────────────────────────────
app.get('/api/equipos', (_req, res) => {
  res.json({ ...listarEquipos(), nota: NOTA_DATOS_EJEMPLO });
});

app.get('/api/equipos/eventos', (_req, res) => {
  res.json(eventos);
});

/** Mock: "Pedir servicio técnico" y "Ver catálogo técnico". */
app.post('/api/equipos/servicio', (req, res) => {
  const tipo = req.body?.tipo === 'catalogo' ? 'catalogo' : 'servicio';
  res.json({
    ok: true,
    tipo,
    mensaje:
      tipo === 'catalogo'
        ? 'Catálogo técnico solicitado. En el prototipo no se abre ningún catálogo real.'
        : 'Solicitud de servicio técnico registrada en el prototipo. No se envió a nadie.',
  });
});

// ── Fotos del robot ─────────────────────────────────────────────────────────
app.get('/api/fotos/:archivo', (req, res) => {
  const id = req.params.archivo.replace(/\.(svg|png|jpg|jpeg|webp)$/i, '');
  const hallazgo = hallazgos.get(id);
  if (!hallazgo) return res.status(404).json({ error: 'Hallazgo no encontrado' });

  const real = fotoReal(id);
  if (real) return res.sendFile(real);

  res.type('image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(placeholderSvg(hallazgo));
});

// ── Eventos en vivo ─────────────────────────────────────────────────────────
app.get('/api/eventos', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(': conectado\n\n');

  const quitar = suscribir(res);

  // Al entrar al mapa arranca la cuenta atrás de la alerta del demo.
  programarAlertaDemo(configuracion.umbrales.segundosAlertaDemo);

  const latido = setInterval(() => res.write(': latido\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(latido);
    quitar();
  });
});

// ── Utilidades de la demo ───────────────────────────────────────────────────
app.post('/api/demo/reiniciar', (_req, res) => {
  reiniciarDemo();
  res.json({ ok: true, resumen: construirResumen() });
});

app.get('/api/salud', (_req, res) => {
  res.json({ ok: true, plantas: plantas.size, hallazgos: hallazgos.size });
});

arrancarLatido();

app.listen(PUERTO, () => {
  console.log(`[vigía] API escuchando en http://localhost:${PUERTO}`);
});

/**
 * Arranque de la API de Vigía.
 * Carga la configuración desde la base de datos, levanta Express y arranca
 * el simulador (latido de equipos + alerta de la demo al primer cliente SSE).
 */
import { crearApp } from './app.js';
import { cerrarDb, db } from './db.js';
import { env } from './env.js';
import { cargarConfiguracion } from './services/configuracion.js';
import { arrancarLatido } from './services/demo.js';

async function arrancar(): Promise<void> {
  await db.$connect();
  await cargarConfiguracion();

  const app = crearApp();
  const latido = arrancarLatido();

  const servidor = app.listen(env.puerto, () => {
    console.log(`[vigía] API escuchando en http://localhost:${env.puerto}`);
  });

  const apagar = async (señal: string) => {
    console.log(`[vigía] ${señal} recibida, cerrando...`);
    clearInterval(latido);
    servidor.close();
    await cerrarDb();
    process.exit(0);
  };
  process.on('SIGTERM', () => void apagar('SIGTERM'));
  process.on('SIGINT', () => void apagar('SIGINT'));
}

arrancar().catch((error) => {
  console.error('[vigía] no se pudo arrancar:', error);
  process.exit(1);
});

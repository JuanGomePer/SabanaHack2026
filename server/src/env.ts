/** Lee y valida las variables de entorno una sola vez, al arrancar. */
import 'dotenv/config';

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisa .env (copia .env.example).`);
  }
  return valor;
}

export const env = {
  databaseUrl: requerida('DATABASE_URL'),
  /**
   * `PORT` es lo que fijan Render y Railway, así que manda en producción.
   * En local, `API_PORT` tiene prioridad: algunos lanzadores le inyectan un
   * `PORT` al `npm run dev` entero y la API terminaba peleando el puerto con
   * Vite. El proxy del frontend apunta al 3001.
   */
  puerto: Number(process.env.API_PORT ?? process.env.PORT ?? 3001),
  robotApiKey: process.env.ROBOT_API_KEY,
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  esProduccion: process.env.NODE_ENV === 'production',
};

if (env.esProduccion && !env.robotApiKey) {
  // En producción, sin clave cualquiera podría publicar hallazgos falsos.
  console.warn(
    '[env] ROBOT_API_KEY no está configurada: POST /api/observaciones queda sin proteger.',
  );
}

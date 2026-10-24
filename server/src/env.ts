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
  puerto: Number(process.env.PORT ?? 3001),
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

/**
 * Cliente de Prisma de la aplicación.
 *
 * Prisma 7 ya no lee `DATABASE_URL` por sí solo desde el schema: el cliente
 * necesita un adaptador explícito (aquí, `@prisma/adapter-pg` con un pool de
 * `pg`). `prisma.config.ts` usa la misma URL, pero solo para la CLI
 * (migrate, seed) — son dos caminos de configuración separados a propósito.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { env } from './env.js';

const adapter = new PrismaPg({ connectionString: env.databaseUrl });

export const db = new PrismaClient({ adapter });

export async function cerrarDb(): Promise<void> {
  await db.$disconnect();
}

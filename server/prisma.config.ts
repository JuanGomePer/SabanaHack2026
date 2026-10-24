// Configuración de las herramientas de Prisma (migrate, studio, db seed).
// La conexión que usa la aplicación en tiempo de ejecución vive en src/db.ts
// (vía @prisma/adapter-pg), no aquí — esto es solo para la CLI.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

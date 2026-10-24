/*
  Warnings:

  - The primary key for the `EntradaRegistro` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `EntradaRegistro` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `EventoEquipo` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `EventoEquipo` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Hallazgo` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Hallazgo` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "EntradaRegistro" DROP CONSTRAINT "EntradaRegistro_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "EntradaRegistro_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "EventoEquipo" DROP CONSTRAINT "EventoEquipo_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "EventoEquipo_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Hallazgo" DROP CONSTRAINT "Hallazgo_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Hallazgo_pkey" PRIMARY KEY ("id");

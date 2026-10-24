-- DropIndex
DROP INDEX "Hallazgo_observacionId_key";

-- CreateIndex
CREATE INDEX "Hallazgo_observacionId_idx" ON "Hallazgo"("observacionId");

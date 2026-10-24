-- Un equipo se puede desactivar a mano desde la pantalla de Equipos (y desde
-- el protocolo, cuando hay una alerta y hay que apagar la ventilación para que
-- la enfermedad no se propague). Desactivado = el programador no lo vuelve a
-- encender solo.
ALTER TABLE "Equipo" ADD COLUMN "desactivado" BOOLEAN NOT NULL DEFAULT false;

/**
 * Formato visible de los ids correlativos del contrato ("H-0007", "A-0007",
 * "R-0001", "E-0001") a partir del autoincrement interno de Postgres.
 *
 * Usar el autoincrement real (no `count()`) evita que un id se repita si se
 * borra una fila — lo que sí pasa, por ejemplo, al reiniciar la demo.
 */

function formatear(prefijo: string, n: number): string {
  return `${prefijo}-${String(n).padStart(4, '0')}`;
}

function parsear(prefijo: string, id: string): number | null {
  const m = new RegExp(`^${prefijo}-(\\d+)$`).exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) ? n : null;
}

export const formatHallazgoId = (n: number): string => formatear('H', n);
export const parseHallazgoId = (id: string): number | null => parsear('H', id);

export const formatRegistroId = (n: number): string => formatear('R', n);
export const formatEventoEquipoId = (n: number): string => formatear('E', n);

/** "A-0007" sale del mismo número que el hallazgo, como en el prototipo original. */
export const formatAlertaId = (hallazgoNumero: number): string => formatear('A', hallazgoNumero);

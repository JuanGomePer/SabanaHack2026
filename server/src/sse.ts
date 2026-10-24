/** Canal de eventos en vivo (Server-Sent Events). */

import type { Response } from 'express';
import type { EventoVivo } from '@vigia/shared/tipos';

const clientes = new Set<Response>();

export function suscribir(res: Response): () => void {
  clientes.add(res);
  return () => clientes.delete(res);
}

export function emitir(evento: EventoVivo): void {
  const carga = `data: ${JSON.stringify(evento)}\n\n`;
  for (const cliente of clientes) {
    cliente.write(carga);
  }
}

export function hayClientes(): boolean {
  return clientes.size > 0;
}

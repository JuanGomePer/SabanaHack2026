/** Formatos en español de Colombia: 2.345, 14:32, "hace 38 min". */

const NUMERO = new Intl.NumberFormat('es-CO');

export function numero(valor: number): string {
  return NUMERO.format(valor);
}

export function porcentaje(valor: number, decimales = 1): string {
  return `${valor.toFixed(decimales).replace('.', ',')} %`;
}

export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** "23 oct · 14:32" */
export function fechaHora(iso: string): string {
  const fecha = new Date(iso);
  const dia = fecha.getDate();
  const mes = new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(fecha).replace('.', '');
  return `${dia} ${mes} · ${hora(iso)}`;
}

export function haceCuanto(iso: string): string {
  const segundos = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (segundos < 60) return `hace ${segundos} s`;
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} d`;
}

/** "B5-C14-P065" → "C14-P65" */
export function etiquetaDesdeId(plantaId: string): string {
  const coincidencia = /C(\d+)-P(\d+)/.exec(plantaId);
  if (!coincidencia) return plantaId;
  return `C${Number(coincidencia[1])}-P${Number(coincidencia[2])}`;
}

/** "Samuel Rodríguez" → "SR". Se recalcula siempre del nombre, nunca se guarda aparte. */
export function inicialesDe(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '';
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase();
}

/** "C14-P62" o "c14 p62" → "B5-C14-P062", para el buscador. */
export function idDesdeTexto(texto: string, bloque: string): string | undefined {
  const coincidencia = /c\s*(\d{1,2})\D+p\s*(\d{1,3})/i.exec(texto);
  if (!coincidencia) return undefined;
  const cama = Number(coincidencia[1]);
  const planta = Number(coincidencia[2]);
  return `${bloque}-C${cama}-P${String(planta).padStart(3, '0')}`;
}

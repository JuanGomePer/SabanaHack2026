/** Perfil del usuario (nombre/rol), editable desde Configuración · Equipo y accesos. */
import { useCallback, useEffect, useState } from 'react';
import { USUARIO } from '@vigia/shared/config';
import type { PerfilUsuario } from '@vigia/shared/tipos';
import { api } from '../api/cliente';

const PERFIL_POR_DEFECTO: PerfilUsuario = {
  nombre: USUARIO.nombre,
  firma: USUARIO.firma,
  rol: USUARIO.rol,
};

export function usePerfil() {
  const [perfil, setPerfil] = useState<PerfilUsuario>(PERFIL_POR_DEFECTO);

  const cargar = useCallback(async () => {
    const config = await api.configuracion();
    setPerfil(config.perfil);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return { perfil, setPerfil, recargar: cargar };
}

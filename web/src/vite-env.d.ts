/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base de la API en producción, ej. "https://vigia-api.onrender.com/api". Sin fijarla, usa el proxy de dev (`/api`). */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

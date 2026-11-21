// Contratos del catálogo institucional (FastAPI → React). Las coordenadas son opcionales
// para seguir mostrando instituciones antiguas sin ubicación registrada.
export interface Organization {
  id: string;
  code: string;
  name: string;
  timezone: string;
  status: 'active' | 'suspended' | 'archived';
  country_code: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface OrganizationInput {
  code: string;
  name: string;
  timezone: string;
  country_code: string;
  city: string;
  address: string | null;
  latitude: number;
  longitude: number;
}

// Opciones de uso frecuente; el campo país permite cualquier código ISO 3166-1 de 2 letras.
export const COUNTRIES = [
  { code: 'PE', name: 'Perú', tz: 'America/Lima' },
  { code: 'CO', name: 'Colombia', tz: 'America/Bogota' },
  { code: 'MX', name: 'México', tz: 'America/Mexico_City' },
  { code: 'ES', name: 'España', tz: 'Europe/Madrid' },
  { code: 'AR', name: 'Argentina', tz: 'America/Argentina/Buenos_Aires' },
  { code: 'CL', name: 'Chile', tz: 'America/Santiago' },
  { code: 'EC', name: 'Ecuador', tz: 'America/Guayaquil' },
  { code: 'BO', name: 'Bolivia', tz: 'America/La_Paz' },
  { code: 'BR', name: 'Brasil', tz: 'America/Sao_Paulo' },
  { code: 'US', name: 'Estados Unidos', tz: 'America/New_York' },
  { code: 'FR', name: 'Francia', tz: 'Europe/Paris' },
  { code: 'GT', name: 'Guatemala', tz: 'America/Guatemala' },
] as const;

export function countryName(code: string | null): string {
  if (!code) return 'Sin país';
  try { return new Intl.DisplayNames(['es'], { type: 'region' }).of(code) || code; }
  catch { return code; }
}

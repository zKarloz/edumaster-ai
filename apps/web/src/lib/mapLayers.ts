// Preferencia cartográfica independiente del tema de la interfaz.
export const MAP_LAYERS = ['auto', 'light', 'dark', 'satellite'] as const;
export type MapLayer = typeof MAP_LAYERS[number];
export type MapTheme = 'light' | 'dark' | 'black';
export const MAP_LAYER_STORAGE = 'edumaster_institution_map_layer';
export const MAP_STYLES = { light: 'streets-v4-light', dark: 'streets-v4-dark', satellite: 'hybrid-v4' } as const;
export function parseMapLayer(value: string | null): MapLayer {
  return MAP_LAYERS.find(layer => layer === value) ?? 'auto';
}
export function resolveMapLayer(layer: MapLayer, theme: MapTheme): Exclude<MapLayer, 'auto'> {
  return layer === 'auto' ? (theme === 'light' ? 'light' : 'dark') : layer;
}
export function mapTilerUrl(layer: Exclude<MapLayer, 'auto'>, key: string): string {
  // Teselas de 256 px: compatibles con la escala XYZ de Leaflet sin offset.
  return `https://api.maptiler.com/maps/${MAP_STYLES[layer]}/256/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}`;
}

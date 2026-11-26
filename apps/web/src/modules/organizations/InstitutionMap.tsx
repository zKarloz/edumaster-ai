// Visualización geográfica con React Leaflet + MapTiler, con respaldo OpenStreetMap.
// Sin geolocalización del visitante; solo sedes registradas y autorizadas.
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLocale } from '../../i18n';
import { divIcon, latLngBounds } from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import type { Organization } from './types';
import { countryName } from './types';
import 'leaflet/dist/leaflet.css';
import { useSettings } from '../../providers/SettingsProvider';
import { MapLayerControl } from '../../components/shared/MapLayerControl';
import { MAP_LAYER_STORAGE, mapTilerUrl, parseMapLayer, resolveMapLayer, type MapLayer } from '../../lib/mapLayers';

interface Props {
  organizations: Organization[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const markerIcon = divIcon({
  className: 'edumaster-location-marker',
  html: '<span aria-hidden="true"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function MapNavigation({ organizations, selectedId }: Pick<Props, 'organizations' | 'selectedId'>) {
  const map = useMap();
  const { animationsEnabled } = useSettings();
  const selected = organizations.find(org => org.id === selectedId);
  const positions = useMemo(() => organizations
    .filter((item): item is Organization & { latitude: number; longitude: number } =>
      item.latitude !== null && item.longitude !== null), [organizations]);

  useEffect(() => {
    const animate = animationsEnabled && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (selected?.latitude != null && selected.longitude != null) {
      if (animate) map.flyTo([selected.latitude, selected.longitude], 7, { duration: 0.6 });
      else map.setView([selected.latitude, selected.longitude], 7, { animate: false });
    } else if (positions.length) {
      map.fitBounds(latLngBounds(positions.map(item => [item.latitude, item.longitude] as [number, number])),
        { padding: [45, 45], maxZoom: 7, animate });
    } else {
      map.setView([-7, -69], 3, { animate: false });
    }
  }, [map, positions, selected?.id, selected?.latitude, selected?.longitude, animationsEnabled]);
  return null;
}

export function InstitutionMap({ organizations, selectedId, onSelect }: Props) {
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const { theme } = useSettings();
  const apiKey = import.meta.env.VITE_MAPTILER_API_KEY?.trim() ?? '';
  const [layer, setLayer] = useState<MapLayer>(() => {
    try { return parseMapLayer(window.localStorage.getItem(MAP_LAYER_STORAGE)); }
    catch { return 'auto'; }
  });
  const resolved = resolveMapLayer(layer, theme);
  // Vincular el fallo a la capa activa permite reintentar otra cartografía.
  const [failedLayer, setFailedLayer] = useState<string | null>(null);
  const failed = failedLayer === resolved;
  const useMapTiler = Boolean(apiKey) && !failed;
  const changeLayer = (next: MapLayer) => {
    setLayer(next);
    setFailedLayer(null);
    try { window.localStorage.setItem(MAP_LAYER_STORAGE, next); } catch { /* Preferencia no persistente. */ }
  };
  const labels = {
    es: { enrollments: 'Cantidad de matrículas', students: 'Cantidad de alumnos', scope: 'Totales registrados (todos los estados)' },
    en: { enrollments: 'Enrollment count', students: 'Student count', scope: 'Registered totals (all statuses)' },
    pt: { enrollments: 'Quantidade de matrículas', students: 'Quantidade de alunos', scope: 'Totais registrados (todos os estados)' },
  }[locale];
  const format = new Intl.NumberFormat(locale);
  const located = organizations.filter(org => org.latitude !== null && org.longitude !== null);
  return (
    <div className="institution-map relative h-full min-h-[360px] w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-[#23456A]">
      <MapContainer center={[-7, -69]} zoom={3} minZoom={2} zoomControl={false} className="h-full w-full" scrollWheelZoom={true}>
        <ZoomControl position="bottomleft"/>
        {/* Solo se sustituye la capa base; el mapa, zoom y marcadores permanecen montados. */}
        {useMapTiler ? <TileLayer key={resolved} url={mapTilerUrl(resolved, apiKey)} maxNativeZoom={20}
          attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          eventHandlers={{ tileerror: () => setFailedLayer(resolved) }}/>
          : <TileLayer key="osm" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />}
        <MapNavigation organizations={organizations} selectedId={selectedId}/>
        {located.map(org => <Marker key={org.id} position={[org.latitude!, org.longitude!]}
          icon={markerIcon} eventHandlers={{ click: () => onSelect(org.id) }}>
          <Popup className="institution-statistics-popup">
            <div className="min-w-[190px] space-y-1">
              <strong>{org.name}</strong>
              <div>{org.city}, {countryName(org.country_code)}</div>
              <div className="text-xs">{t('legacy.k943f7c6233')} {org.code}</div>
              {/* No confundir cero registros con estadísticas no autorizadas o aún no disponibles. */}
              {org.enrollment_count != null && org.student_count != null && (
                <div className="mt-2 border-t pt-2" style={{ borderColor: 'var(--app-panel-border)' }}>
                  <dl className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-4">
                      <dt>{labels.enrollments}</dt><dd className="font-semibold tabular-nums">{format.format(org.enrollment_count)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt>{labels.students}</dt><dd className="font-semibold tabular-nums">{format.format(org.student_count)}</dd>
                    </div>
                  </dl>
                  <div className="mt-2 text-[10px] opacity-75">{labels.scope}</div>
                </div>
              )}
            </div>
          </Popup>
        </Marker>)}
      </MapContainer>
      {useMapTiler && <a href="https://www.maptiler.com/" target="_blank" rel="noopener noreferrer" className="absolute bottom-5 left-14 z-[400] rounded bg-white/90 p-1" aria-label="MapTiler"><img src="https://api.maptiler.com/resources/logo.svg" alt="MapTiler" className="h-5 w-auto"/></a>}
      <MapLayerControl value={layer} onChange={changeLayer} locale={locale} configured={Boolean(apiKey)} failed={failed} onRetry={() => setFailedLayer(null)}/>
      {located.length === 0 && <div className="pointer-events-none absolute left-4 right-4 bottom-20 z-[400] rounded-lg border border-slate-200 bg-white/95 px-4 py-3 text-sm font-medium text-slate-700 shadow-md sm:left-auto sm:max-w-sm">
        {t('legacy.k22a4df9911')}
      </div>}
    </div>
  );
}

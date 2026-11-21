// Visualización geográfica con React Leaflet + OpenStreetMap.
// Sin geolocalización del visitante; solo sedes registradas y autorizadas.
import { useEffect, useMemo } from 'react';
import { divIcon, latLngBounds } from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import type { Organization } from './types';
import { countryName } from './types';
import 'leaflet/dist/leaflet.css';
import { useSettings } from '../../providers/SettingsProvider';

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
  const located = organizations.filter(org => org.latitude !== null && org.longitude !== null);
  return (
    <div className="institution-map relative h-full min-h-[360px] w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-[#23456A]">
      <MapContainer center={[-7, -69]} zoom={3} minZoom={2} zoomControl={false} className="h-full w-full" scrollWheelZoom={true}>
        <ZoomControl position="bottomleft"/>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        <MapNavigation organizations={organizations} selectedId={selectedId}/>
        {located.map(org => <Marker key={org.id} position={[org.latitude!, org.longitude!]}
          icon={markerIcon} eventHandlers={{ click: () => onSelect(org.id) }}>
          <Popup>
            <div className="space-y-1 text-slate-800">
              <strong>{org.name}</strong>
              <div>{org.city}, {countryName(org.country_code)}</div>
              <div className="text-xs">Código: {org.code}</div>
              <button className="text-sm font-semibold text-blue-700 underline" type="button" onClick={() => onSelect(org.id)}>
                Ver institución
              </button>
            </div>
          </Popup>
        </Marker>)}
      </MapContainer>
      {located.length === 0 && <div className="pointer-events-none absolute left-4 right-4 top-4 z-[400] rounded-lg border border-slate-200 bg-white/95 px-4 py-3 text-sm font-medium text-slate-700 shadow-md sm:left-auto sm:max-w-sm">
        No hay instituciones con coordenadas en este filtro. Registra una sede para colocar el primer marcador.
      </div>}
    </div>
  );
}

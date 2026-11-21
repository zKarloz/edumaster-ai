// Avatar compartido: indicador de carga hasta verificar Storage; imagen con entrada suave.
// La paleta es seudoaleatoria, pero estable para una identidad entre sesiones.
import { Spinner } from './Spinner';
import { useState } from 'react';

const COLORS = ['#0369a1', '#4338ca', '#7e22ce', '#a21caf', '#be123c', '#0f766e', '#047857', '#92400e'];
export function UserAvatar({ userId, name, photo, large = false, loading = false }: {
  userId: string; name: string; photo: string | null; large?: boolean; loading?: boolean;
}) {
  const [loadedPhoto, setLoadedPhoto] = useState<string | null>(null);
  const initials = Array.from(name.trim()).slice(0, 2).join('').toLocaleUpperCase('es') || 'US';
  const hash = Array.from(userId).reduce((acc, ch) => (Math.imul(acc, 31) + ch.charCodeAt(0)) >>> 0, 0);
  const showSpinner = loading || (Boolean(photo) && loadedPhoto !== photo);
  return <span role="img" aria-label={loading ? 'Cargando fotografía de perfil' : `Avatar de ${name}`}
    className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ${large ? 'size-24 text-3xl' : 'size-10 text-sm'}`}
    style={{ backgroundColor: COLORS[hash % COLORS.length] ?? '#0369a1' }}>
    {!showSpinner && !photo && initials}
    {showSpinner && <Spinner compact size={large ? 30 : 18} label="Cargando fotografía de perfil"/>}
    {photo && <img key={photo} src={photo} alt="" onLoad={() => setLoadedPhoto(photo)} onError={() => setLoadedPhoto(photo)}
      className={`absolute inset-0 size-full object-cover ${loadedPhoto === photo && !loading ? 'app-avatar-image' : 'opacity-0'}`}/>}
  </span>;
}

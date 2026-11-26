// Selector reutilizable: no solicita teselas adicionales para las miniaturas.
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Layers, Moon, Satellite, Sun, SunMoon } from 'lucide-react';
import { MAP_LAYERS, type MapLayer } from '../../lib/mapLayers';
import type { Locale } from '../../i18n';
const copy = {
  es: { title: 'Capas', auto: 'Automático', light: 'Claro', dark: 'Oscuro', satellite: 'Satélite híbrido', missing: 'MapTiler no configurado. Mapa de respaldo activo.', error: 'MapTiler no disponible. Mapa de respaldo activo.', retry: 'Reintentar' },
  en: { title: 'Layers', auto: 'Automatic', light: 'Light', dark: 'Dark', satellite: 'Satellite hybrid', missing: 'MapTiler not configured. Backup map active.', error: 'MapTiler unavailable. Backup map active.', retry: 'Retry' },
  pt: { title: 'Camadas', auto: 'Automático', light: 'Claro', dark: 'Escuro', satellite: 'Satélite híbrido', missing: 'MapTiler não configurado. Mapa alternativo ativo.', error: 'MapTiler indisponível. Mapa alternativo ativo.', retry: 'Tentar novamente' },
};
const icons = { auto: SunMoon, light: Sun, dark: Moon, satellite: Satellite };
interface Props { value: MapLayer; onChange: (value: MapLayer) => void; locale: Locale; configured: boolean; failed: boolean; onRetry: () => void }
export function MapLayerControl({ value, onChange, locale, configured, failed, onRetry }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const c = copy[locale];
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div ref={root} className="absolute right-3 top-3 z-[500] flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2 text-sm" style={{color:'var(--app-text)'}}>
    <button ref={trigger} type="button" aria-expanded={open} onClick={() => setOpen(v => !v)} className="flex items-center gap-2 rounded-xl border px-3 py-2 font-semibold shadow-md transition-colors" style={{background:'var(--app-panel-bg)',borderColor:'var(--app-panel-border)'}}>
      <Layers size={17}/>{c.title}<ChevronDown size={14}/>
    </button>
    {open && <div className="w-60 max-w-full rounded-xl border p-2 shadow-lg" style={{background:'var(--app-panel-bg)',borderColor:'var(--app-panel-border)'}}>
      <div role="group" aria-label={c.title} className="grid grid-cols-2 gap-2">
        {MAP_LAYERS.map(layer => { const Icon = icons[layer]; return <button key={layer} type="button" aria-pressed={value === layer} disabled={!configured} onClick={() => {onChange(layer);setOpen(false);trigger.current?.focus();}} className="rounded-lg border p-1.5 text-left transition-colors disabled:opacity-50" style={{borderColor:value === layer?'#0ea5e9':'var(--app-panel-border)'}}>
          <span aria-hidden="true" className={`mb-1 flex h-11 items-center justify-center rounded-md ${layer === 'light'?'bg-slate-100 text-slate-600':layer === 'satellite'?'bg-emerald-950 text-emerald-200':layer === 'auto'?'bg-gradient-to-r from-slate-100 to-slate-800 text-sky-500':'bg-slate-900 text-sky-200'}`}><Icon size={22}/></span>
          <span className="flex items-center justify-between gap-1 text-xs">{c[layer]}{value === layer && <Check size={13} className="shrink-0 text-sky-500"/>}</span>
        </button>; })}
      </div>
    </div>}
    {(!configured || failed) && <div role="status" className="max-w-60 rounded-lg border px-3 py-2 text-xs shadow-md" style={{background:'var(--app-panel-bg)',borderColor:'var(--app-panel-border)'}}>{configured?c.error:c.missing}{configured && <button type="button" className="ml-1 underline" onClick={onRetry}>{c.retry}</button>}</div>}
  </div>;
}

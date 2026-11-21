// Página de gestión institucional: opción A (listado lateral + mapa grande).
// El frontend filtra únicamente instituciones que la API ya autorizó.
import { useMemo, useState } from 'react';
import { Building2, Edit3, Globe2, MapPin, Plus, RefreshCcw, Search, SlidersHorizontal } from 'lucide-react';
import { Modal } from '../../components/shared/Modal';
import { OptionSelect } from '../../components/shared/OptionSelect';
import { Spinner } from '../../components/shared/Spinner';
import { InstitutionMap } from './InstitutionMap';
import { OrganizationForm } from './OrganizationForm';
import type { Organization, OrganizationInput } from './types';
import { countryName } from './types';

interface Props {
  organizations: Organization[];
  loading: boolean;
  error: string;
  canManage: boolean;
  onRefresh: () => void;
  onSave: (input: OrganizationInput, id?: string) => Promise<void>;
}

export function OrganizationsPage({ organizations, loading, error, canManage, onRefresh, onSave }: Props) {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Organization | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');

  const countries = useMemo(() => [...new Set(organizations.map(org => org.country_code).filter((code): code is string => Boolean(code)))].sort(), [organizations]);
  const filtered = useMemo(() => organizations.filter(org => {
    const matchCountry = country === 'all' || org.country_code === country;
    const needle = search.trim().toLocaleLowerCase('es');
    const matchText = [org.name, org.code, org.city, org.country_code, org.address]
      .some(value => (value ?? '').toLocaleLowerCase('es').includes(needle));
    return matchCountry && matchText;
  }), [organizations, country, search]);
  const selected = filtered.find(item => item.id === selectedId) ?? null;
  const located = filtered.filter(org => org.latitude !== null && org.longitude !== null).length;

  const submit = async (data: OrganizationInput): Promise<boolean> => {
    setBusy(true); setSaveError('');
    try {
      await onSave(data, editing?.id);
      setEditing(undefined);
      return true;
    } catch (cause: unknown) {
      setSaveError(cause instanceof Error ? cause.message : 'No se pudo guardar la institución.');
      return false;
    } finally { setBusy(false); }
  };

  return <div className="space-y-5">
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        { value: organizations.length, label: 'Instituciones accesibles', icon: Building2 },
        { value: countries.length, label: 'Países registrados', icon: Globe2 },
        { value: organizations.filter(item => item.latitude !== null && item.longitude !== null).length, label: 'Sedes localizadas', icon: MapPin },
        { value: filtered.length, label: 'Resultados del filtro', icon: SlidersHorizontal },
      ].map(card => <div key={card.label} className="app-panel rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#23456A] dark:bg-[#0A1F3D]">
        <div className="flex items-center justify-between gap-2 text-xs app-muted">{card.label}<card.icon size={17}/></div>
        <p className="mt-2 text-2xl font-bold tabular-nums">{card.value}</p>
      </div>)}
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-lg font-bold">Instituciones registradas</h3>
        <p className="mt-1 text-sm app-muted">Directorio institucional internacional · datos provenientes de PostgreSQL.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onRefresh} className="app-secondary-button inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-[#345578]" aria-label="Actualizar instituciones">
          <RefreshCcw size={16}/> <span className="hidden sm:inline">Actualizar</span>
        </button>
        {canManage && <button type="button" onClick={() => { setEditing(null); setSaveError(''); }} className="app-primary-button inline-flex items-center gap-2 rounded-xl bg-[#087FE5] px-4 py-2.5 text-sm font-semibold text-white">
          <Plus size={17}/> Nueva institución
        </button>}
      </div>
    </div>
    {error && <p role="alert" className="app-warning rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
    <div className="grid min-h-[620px] gap-4 lg:grid-cols-[minmax(280px,350px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
      <div className="app-panel flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-[#23456A] dark:bg-[#0A1F3D]">
        <div className="institution-filter-header space-y-3 border-b border-slate-200 p-4 dark:border-[#345578]">
          <label className="search-control flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-[#345578]">
            <Search size={16} className="app-muted"/>
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 w-full bg-transparent outline-none"
              placeholder="Buscar institución o ciudad" aria-label="Buscar instituciones"/>
          </label>
          <OptionSelect ariaLabel="Filtrar instituciones por país" value={country} onChange={setCountry}
            options={[{ value: 'all', label: 'Todos los países' },
              ...countries.map(code => ({ value: code, label: countryName(code), suffix: code }))]}/>
          <p className="text-xs app-muted">{filtered.length} instituciones · {located} ubicadas en el mapa</p>
        </div>
        {loading && <div className="p-4"><Spinner label="Cargando instituciones..."/></div>}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 lg:max-h-[540px]">
          {!loading && filtered.length === 0 && <p className="px-3 py-9 text-center text-sm app-muted">
            {organizations.length === 0 ? 'Aún no hay instituciones. Registra la primera para verla en el mapa.' : 'No hay instituciones que coincidan con los filtros.'}
          </p>}
          {filtered.map(org => <button type="button" key={org.id} onClick={() => setSelectedId(org.id)}
            aria-pressed={selectedId === org.id}
            className={`institution-list-row w-full rounded-xl border p-3 text-left transition-colors ${selectedId === org.id
              ? 'border-blue-400 bg-blue-50 dark:border-cyan-500/60 dark:bg-[#123455]'
              : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-[#345578] dark:bg-[#0D2542] dark:hover:bg-[#173658]'}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold">{org.name}</span>
              <span className="mt-0.5 shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Activa</span>
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs app-muted"><MapPin size={13}/>{org.city || 'Sin ciudad'}, {countryName(org.country_code)}</div>
            <div className="mt-1 text-xs app-meta-text">{org.code}</div>
            {org.latitude === null && <p className="mt-1 text-xs text-amber-600">Ubicación pendiente</p>}
          </button>)}
        </div>
        {selected && <div className="institution-selection-details border-t border-slate-200 p-4 dark:border-[#345578]">
          <p className="text-sm font-bold">{selected.name}</p>
          <p className="mt-1 text-xs app-muted">{selected.address || selected.city || 'Ubicación sin dirección'} · {countryName(selected.country_code)}</p>
          <p className="mt-1 text-xs app-muted">Zona horaria: {selected.timezone}</p>
          {canManage && <button type="button" onClick={() => { setEditing(selected); setSaveError(''); }}
            className="app-secondary-button mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-[#345578]">
            <Edit3 size={14}/> Editar sede
          </button>}
        </div>}
      </div>
      <div className="min-h-[420px] overflow-hidden rounded-2xl lg:min-h-[620px]">
        <InstitutionMap organizations={filtered} selectedId={selected?.id ?? null} onSelect={setSelectedId}/>
      </div>
    </div>
    <p className="text-xs app-muted">Mapa interactivo: OpenStreetMap · marcadores de instituciones autorizadas. La ubicación es la sede principal declarada, no geolocalización de estudiantes.</p>
    <Modal open={editing !== undefined} title={editing ? 'Editar institución' : 'Registrar institución'} onClose={() => { if (!busy) setEditing(undefined); }}>
      <OrganizationForm key={editing?.id ?? 'new'} initial={editing} busy={busy} error={saveError} onSave={submit} onCancel={() => setEditing(undefined)}/>
    </Modal>
  </div>;
}

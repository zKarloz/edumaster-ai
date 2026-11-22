// Formulario compartido de alta/edición institucional. Las coordenadas pueden
// escribirse o elegirse sobre el mapa, sin depender de geocodificadores externos.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';
import { Building2, MapPin } from 'lucide-react';
import { OptionSelect } from '../../components/shared/OptionSelect';
import { HelpPopover } from '../../components/shared/HelpPopover';
import { useSettings } from '../../providers/SettingsProvider';
import type { Organization, OrganizationInput } from './types';
import { COUNTRIES } from './types';

interface Props {
  initial?: Organization | null;
  busy: boolean;
  error: string;
  onSave: (data: OrganizationInput) => Promise<boolean>;
  onCancel: () => void;
}

type FormDraft = Omit<OrganizationInput, 'latitude' | 'longitude'> & {
  latitude: string;
  longitude: string;
};

// No fijamos Lima como ubicación predeterminada; la persona debe marcar la sede.
const EMPTY: FormDraft = {
  code: '', name: '', timezone: 'America/Lima', country_code: 'PE', city: '',
  address: null, latitude: '', longitude: '',
};

// Puntos de referencia para facilitar navegación; NO se guardan como sedes.
const COUNTRY_CENTERS: Record<string, [number, number]> = {
  PE: [-12.0464, -77.0428], CO: [4.711, -74.072], MX: [19.4326, -99.1332],
  ES: [40.4168, -3.7038], AR: [-34.6037, -58.3816], CL: [-33.4489, -70.6693],
  EC: [-0.1807, -78.4678], BO: [-16.5, -68.15], BR: [-15.7939, -47.8828],
  US: [38.9072, -77.0369], FR: [48.8566, 2.3522], GT: [14.6349, -90.5069],
};
const draftMarkerIcon = divIcon({
  className: 'edumaster-location-marker', html: '<span aria-hidden="true"></span>',
  iconSize: [24, 24], iconAnchor: [12, 12],
});

function CountryFocus({ code }: { code: string }) {
  const map = useMap();
  const first = useRef(true);
  const { animationsEnabled } = useSettings();
  useEffect(() => {
    // En edición se respeta inicialmente la ubicación guardada.
    if (first.current) { first.current = false; return; }
    const center = COUNTRY_CENTERS[code];
    const animate = animationsEnabled && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (center) {
      if (animate) map.flyTo(center, 6, { duration: 0.5 });
      else map.setView(center, 6, { animate: false });
    } else map.setView([15, -20], 2, { animate: false });
  }, [code, map, animationsEnabled]);
  return null;
}

function CoordinatePicker({ value, onChange }: {
  value: [number, number] | null; onChange: (value: [number, number]) => void;
}) {
  useMapEvents({
    click: event => onChange([Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6))]),
  });
  return value ? <Marker position={value} icon={draftMarkerIcon}/> : null;
}

export function OrganizationForm({ initial, busy, error, onSave, onCancel }: Props) {
  const { t } = useTranslation();
  const [values, setValues] = useState<FormDraft>(() => initial ? {
    code: initial.code, name: initial.name, timezone: initial.timezone,
    country_code: initial.country_code ?? 'PE', city: initial.city ?? '', address: initial.address,
    latitude: initial.latitude?.toString() ?? '', longitude: initial.longitude?.toString() ?? '',
  } : EMPTY);
  const [formError, setFormError] = useState('');
  // Si la sede está fuera del catálogo frecuente, permitimos un código ISO manual.
  const [customCountry, setCustomCountry] = useState(() => Boolean(initial?.country_code && !COUNTRIES.some(country => country.code === initial.country_code)));
  const change = (field: keyof FormDraft, value: string | null) =>
    setValues(current => ({ ...current, [field]: value }));

  // La selección de país propone una zona horaria, editable para instituciones
  // con varias zonas dentro de un mismo país (México, Estados Unidos, etc.).
  const changeCountry = (code: string) => {
    const found = COUNTRIES.find(country => country.code === code);
    setValues(current => ({ ...current, country_code: code.toUpperCase(),
      timezone: found?.tz ?? current.timezone }));
  };

  useEffect(() => { setFormError(''); }, [values]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Formato único para las ALTAS: cc-identificador, con cc igual al país.
    // En EDICIÓN, el código anterior es inmutable y no debe invalidar una sede
    // antigua que se registró con las reglas anteriores.
    const code = values.code.trim().toLowerCase();
    if (!/^[A-Z]{2}$/.test(values.country_code)) {
      setFormError('El país debe tener un código ISO de dos letras (PE, CO, MX...).'); return;
    }
    if (!initial && !/^[a-z]{2}-[a-z0-9][a-z0-9_-]{0,35}[a-z0-9]$/.test(code)) {
      setFormError('Usa el formato país-identificador, por ejemplo pe-unmsm o co-unal (5 a 40 caracteres, sin tildes).'); return;
    }
    if (!initial && !code.startsWith(`${values.country_code.toLowerCase()}-`)) {
      setFormError(`El código debe empezar por ${values.country_code.toLowerCase()}- porque seleccionaste ese país.`); return;
    }
    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);
    if (values.latitude.trim() === '' || values.longitude.trim() === '' ||
        !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setFormError('Las coordenadas deben ser válidas (latitud -90 a 90, longitud -180 a 180).'); return;
    }
    await onSave({ ...values, code, name: values.name.trim(),
      country_code: values.country_code.toUpperCase(), address: values.address?.trim() || null,
      latitude, longitude });
  }

  const initialCenter: [number, number] = initial?.latitude != null && initial.longitude != null
    ? [initial.latitude, initial.longitude]
    : COUNTRY_CENTERS[values.country_code] ?? [10, -20];
  const inputCls = 'app-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-[#345578] dark:bg-[#112A48] dark:text-white';
  return <form onSubmit={event => void submit(event)} className="space-y-4">
    <div className="flex items-center gap-2 text-sm app-muted"><Building2 size={17}/> {t('legacy.k3bd06cdaf3')}</div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="app-form-field flex flex-col gap-1.5 text-xs font-medium">
        <HelpPopover htmlFor="institution-code" label={t('labels.k37374b1c58')} title={t('labels.k36e2ee823f')}>
          <p className="app-muted">{t('legacy.kbfb84ce8fb')} <code>pe-unmsm</code> {t('legacy.kf7c221b81c')} <code>co-unal</code> {t('legacy.k2443ea008c')} <code>mx-unam</code> {t('legacy.k44afb063a7')} <code>es-ucm</code> {t('legacy.kc809946067')}</p>
          <p className="app-muted mt-2">{t('legacy.kf8b0960e8c')}</p>
        </HelpPopover>
        <input id="institution-code" required minLength={5} maxLength={40}
          pattern={initial ? undefined : '[a-z]{2}-[a-z0-9](?:[a-z0-9]|_|-){0,35}[a-z0-9]'}
          value={values.code} onChange={event => change('code', event.target.value.toLowerCase())}
          disabled={!!initial}
          placeholder={`${values.country_code.toLowerCase() || 'pe'}-institucion`} className={`${inputCls} app-institution-code`}/>
        {initial && <p className="app-muted text-xs font-normal">{t('legacy.k617377bc89')}</p>}
      </div>
      <label className="app-form-field flex flex-col gap-1.5 text-xs font-medium"><span>{t('legacy.ke68491e91c')}</span>
        <input required minLength={3} maxLength={180} value={values.name} onChange={event => change('name', event.target.value)}
          placeholder={t('labels.kb62a93c40a')} className={inputCls}/>
      </label>
      <div className="app-form-field flex flex-col gap-1.5 text-xs font-medium">
        <span className="block">{t('legacy.k51ac74d937')}</span>
        <OptionSelect ariaLabel={t('labels.k52c9a77343')} value={customCountry ? '__other__' : values.country_code}
          options={[...COUNTRIES.map(country => ({ value: country.code, label: country.name, suffix: country.code })),
            { value: '__other__', label: 'Otro país (código ISO)' }]}
          onChange={code => {
            const other = code === '__other__';
            setCustomCountry(other);
            changeCountry(other ? '' : code);
          }}/>
        {customCountry && <input required maxLength={2} minLength={2} pattern="[A-Za-z]{2}"
          aria-label={t('labels.k27f1417bcf')} value={values.country_code}
          onChange={event => changeCountry(event.target.value.replace(/[^a-z]/gi, '').toUpperCase())}
          placeholder={t('labels.kec9ad843bd')} className={`${inputCls} mt-2`}/>}
      </div>
      <label className="app-form-field flex flex-col gap-1.5 text-xs font-medium"><span>{t('legacy.kc6fbe2dcbc')}</span>
        <input required minLength={2} maxLength={120} value={values.city}
          onChange={event => change('city', event.target.value)} placeholder="Lima" className={inputCls}/>
      </label>
      <label className="app-form-field flex flex-col gap-1.5 text-xs font-medium"><span>{t('legacy.kfd6921f766')}</span>
        <input required maxLength={80} value={values.timezone} onChange={event => change('timezone', event.target.value)}
          placeholder="America/Lima" className={inputCls}/>
      </label>
      <label className="app-form-field flex flex-col gap-1.5 text-xs font-medium"><span>{t('legacy.kd21e62fe18')}</span>
        <input maxLength={240} value={values.address ?? ''} onChange={event => change('address', event.target.value)}
          placeholder="Av. Principal 123" className={inputCls}/>
      </label>
      <label className="app-form-field flex flex-col gap-1.5 text-xs font-medium"><span>{t('legacy.k04f17257f3')}</span>
        <input type="number" required min={-90} max={90} step="any" value={values.latitude}
          onChange={event => change('latitude', event.target.value)} className={inputCls}/>
      </label>
      <label className="app-form-field flex flex-col gap-1.5 text-xs font-medium"><span>{t('legacy.k9b102372ba')}</span>
        <input type="number" required min={-180} max={180} step="any" value={values.longitude}
          onChange={event => change('longitude', event.target.value)} className={inputCls}/>
      </label>
    </div>
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs app-muted"><MapPin size={15}/> {t('legacy.k5baf038a37')}</p>
      <div className="institution-form-map h-48 overflow-hidden rounded-xl border border-slate-200 dark:border-[#345578]">
        <MapContainer center={initialCenter} zoom={initial ? 10 : 5} className="h-full w-full" scrollWheelZoom={true}>
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'/>
          <CountryFocus code={values.country_code}/>
          <CoordinatePicker value={values.latitude.trim() !== '' && values.longitude.trim() !== '' &&
            Number.isFinite(Number(values.latitude)) && Number.isFinite(Number(values.longitude))
              ? [Number(values.latitude), Number(values.longitude)] : null}
            onChange={coords => setValues(current => ({ ...current, latitude: String(coords[0]!), longitude: String(coords[1]!) }))}/>
        </MapContainer>
      </div>
    </div>
    {(error || formError) && <p role="alert" className="app-warning rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{formError || error}</p>}
    <div className="institution-form-actions flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-[#345578]">
      <button type="button" onClick={onCancel} className="app-secondary-button rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-600">{t('legacy.kc111e0ab9d')}</button>
      <button disabled={busy} type="submit" className="app-primary-button rounded-xl bg-[#087FE5] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? 'Guardando...' : initial ? 'Guardar cambios' : 'Registrar institución'}
      </button>
    </div>
  </form>;
}

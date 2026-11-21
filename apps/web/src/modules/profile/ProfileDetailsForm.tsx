// Datos opcionales editables por el titular. No se exponen íntegros en el directorio.
import { useEffect, useState, type FormEvent } from 'react';
import { Globe2, Save, ShieldCheck } from 'lucide-react';
import { OptionSelect } from '../../components/shared/OptionSelect';
import { Spinner } from '../../components/shared/Spinner';
import { useToast } from '../../components/shared/Toast';
import { COUNTRIES } from '../organizations/types';

interface Details {
  language_code: string | null; country_code: string | null; birth_date: string | null;
  sex: 'female' | 'male' | 'non_binary' | 'prefer_not_to_say' | null;
  share_locale_with_staff: boolean;
}
const EMPTY: Details = { language_code: null, country_code: null, birth_date: null, sex: null, share_locale_with_staff: false };
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const input = 'app-input w-full rounded-xl border px-3 py-2.5 text-sm';
const primary = 'app-primary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50';

export function ProfileDetailsForm({ token }: { token: string }) {
  const { notify } = useToast();
  const [data, setData] = useState<Details>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [otherCountry, setOtherCountry] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    void fetch(`${API}/api/v1/me/details`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('No se pudieron recuperar los datos personales. Comprueba la migración 004.');
        return response.json() as Promise<Details>;
      }).then(result => { if (!controller.signal.aborted) {
        setData(result);
        setOtherCountry(Boolean(result.country_code && !COUNTRIES.some(country => country.code === result.country_code)));
      } })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Error de conexión'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const response = await fetch(`${API}/api/v1/me/details`, { method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(data) });
      if (!response.ok) throw new Error('No se pudieron guardar los datos. Comprueba tu sesión y la migración 004.');
      setData(await response.json() as Details);
      notify('Datos personales actualizados.', 'success');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Error al guardar'); }
    finally { setSaving(false); }
  }
  return <section className="app-panel mt-5 rounded-2xl border p-5 sm:p-6">
    <div className="flex items-center gap-3"><Globe2 size={21}/><div><h3 className="text-lg font-semibold">Datos personales adicionales</h3>
      <p className="app-muted mt-1 text-sm">Campos opcionales que podrás actualizar en cualquier momento.</p></div></div>
    {loading ? <div className="py-6"><Spinner label="Consultando datos personales..."/></div> :
      <form onSubmit={event => void save(event)} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><label className="text-sm font-medium">Idioma preferido</label>
            <OptionSelect ariaLabel="Idioma preferido" value={data.language_code ?? ''} onChange={value => setData(d => ({ ...d, language_code: value || null }))} options={[
              { value: '', label: 'Sin especificar' }, { value: 'es', label: 'Español', suffix: 'es' },
              { value: 'en', label: 'Inglés', suffix: 'en' }, { value: 'pt', label: 'Portugués', suffix: 'pt' },
              { value: 'fr', label: 'Francés', suffix: 'fr' },
            ]}/></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">País</label>
            <OptionSelect ariaLabel="País de residencia" value={otherCountry ? 'OTHER' : data.country_code ?? ''}
              onChange={value => { setOtherCountry(value === 'OTHER'); setData(d => ({ ...d, country_code: value === 'OTHER' ? null : value || null })); }}
              options={[{ value: '', label: 'Sin especificar' }, ...COUNTRIES.map(c => ({ value: c.code, label: c.name, suffix: c.code })), { value: 'OTHER', label: 'Otro país (código ISO)' }]}/>
            {otherCountry && <input className={input} aria-label="Código ISO del país" maxLength={2} pattern="[A-Za-z]{2}" placeholder="Ej.: JP"
              value={data.country_code ?? ''} onChange={e => setData(d => ({ ...d, country_code: e.target.value.toUpperCase() || null }))}/>}
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium">Fecha de nacimiento (privada)
            <input type="date" className={input} max={new Date().toISOString().slice(0,10)} value={data.birth_date ?? ''} onChange={e => setData(d => ({ ...d, birth_date: e.target.value || null }))}/></label>
          <div className="space-y-1.5"><label className="text-sm font-medium">Sexo (privado y opcional)</label>
            <OptionSelect ariaLabel="Sexo" value={data.sex ?? ''} onChange={value => setData(d => ({ ...d, sex: value as Details['sex'] || null }))}
              options={[{ value: '', label: 'Sin especificar' }, { value: 'female', label: 'Femenino' },
                { value: 'male', label: 'Masculino' }, { value: 'non_binary', label: 'No binario' },
                { value: 'prefer_not_to_say', label: 'Prefiero no decirlo' }]}/></div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" checked={data.share_locale_with_staff} onChange={e => setData(d => ({ ...d, share_locale_with_staff: e.target.checked }))} className="mt-1 size-4 accent-sky-600"/>
          <span><span className="font-medium">Compartir mi país e idioma con administradores autorizados</span><span className="app-muted mt-1 block text-xs">No se comparten fecha de nacimiento ni sexo. Puedes desactivar esta opción cuando quieras.</span></span></label>
        <div className="flex items-center gap-2"><ShieldCheck size={17} className="app-muted"/><p className="app-muted text-xs">Estos atributos no modifican tus permisos institucionales.</p></div>
        {error && <p role="alert" className="app-warning rounded-xl border p-3 text-sm">{error}</p>}
        <button type="submit" disabled={saving} className={primary}><Save size={17}/>{saving ? 'Guardando...' : 'Guardar datos personales'}</button>
      </form>}
    {loading && error && <p className="app-warning mt-3 rounded-xl border p-3 text-sm">{error}</p>}
  </section>;
}

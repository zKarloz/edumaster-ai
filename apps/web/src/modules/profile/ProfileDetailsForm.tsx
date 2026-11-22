// Datos opcionales editables por el titular. No se exponen íntegros en el directorio.
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../providers/SettingsProvider';
import { normalizeLocale } from '../../i18n';
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
  const { t } = useTranslation();
  const { setLocale } = useSettings();
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
      const updated = await response.json() as Details;
      setData(updated);
      if (updated.language_code && ['es','en','pt'].includes(updated.language_code.split('-')[0] || '')) setLocale(normalizeLocale(updated.language_code));
      notify(t('profile.updated'), 'success');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Error al guardar'); }
    finally { setSaving(false); }
  }
  return <section className="app-panel mt-5 rounded-2xl border p-5 sm:p-6">
    <div className="flex items-center gap-3"><Globe2 size={21}/><div><h3 className="text-lg font-semibold">{t('profile.additional')}</h3>
      <p className="app-muted mt-1 text-sm">{t('profile.additionalHint')}</p></div></div>
    {loading ? <div className="py-6"><Spinner label="Consultando datos personales..."/></div> :
      <form onSubmit={event => void save(event)} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><label className="text-sm font-medium">{t('profile.preferredLanguage')}</label>
            <OptionSelect ariaLabel={t('profile.preferredLanguage')} value={data.language_code ?? ''} onChange={value => setData(d => ({ ...d, language_code: value || null }))} options={[
              { value: '', label: t('profile.notSpecified') }, { value: 'es', label: 'Español', suffix: 'es' },
              { value: 'en', label: 'English', suffix: 'en' }, { value: 'pt', label: 'Português', suffix: 'pt' },
            ]}/></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">{t('profile.country')}</label>
            <OptionSelect ariaLabel={t('profile.country')} value={otherCountry ? 'OTHER' : data.country_code ?? ''}
              onChange={value => { setOtherCountry(value === 'OTHER'); setData(d => ({ ...d, country_code: value === 'OTHER' ? null : value || null })); }}
              options={[{ value: '', label: t('profile.notSpecified') }, ...COUNTRIES.map(c => ({ value: c.code, label: c.name, suffix: c.code })), { value: 'OTHER', label: t('profile.otherCountry') }]}/>
            {otherCountry && <input className={input} aria-label={t('labels.k07a7725079')} maxLength={2} pattern="[A-Za-z]{2}" placeholder="Ej.: JP"
              value={data.country_code ?? ''} onChange={e => setData(d => ({ ...d, country_code: e.target.value.toUpperCase() || null }))}/>}
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium">{t('profile.birthDate')}
            <input type="date" className={input} max={new Date().toISOString().slice(0,10)} value={data.birth_date ?? ''} onChange={e => setData(d => ({ ...d, birth_date: e.target.value || null }))}/></label>
          <div className="space-y-1.5"><label className="text-sm font-medium">{t('profile.sex')}</label>
            <OptionSelect ariaLabel={t('profile.sex')} value={data.sex ?? ''} onChange={value => setData(d => ({ ...d, sex: value as Details['sex'] || null }))}
              options={[{ value: '', label: t('profile.notSpecified') }, { value: 'female', label: t('profile.female') },
                { value: 'male', label: t('profile.male') }, { value: 'non_binary', label: t('profile.nonBinary') },
                { value: 'prefer_not_to_say', label: t('profile.preferNot') }]}/></div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm"><input type="checkbox" checked={data.share_locale_with_staff} onChange={e => setData(d => ({ ...d, share_locale_with_staff: e.target.checked }))} className="mt-1 size-4 accent-sky-600"/>
          <span><span className="font-medium">{t('profile.share')}</span><span className="app-muted mt-1 block text-xs">{t('profile.shareHint')}</span></span></label>
        <div className="flex items-center gap-2"><ShieldCheck size={17} className="app-muted"/><p className="app-muted text-xs">{t('profile.rolesHint')}</p></div>
        {error && <p role="alert" className="app-warning rounded-xl border p-3 text-sm">{error}</p>}
        <button type="submit" disabled={saving} className={primary}><Save size={17}/>{t(saving ? 'profile.saving' : 'profile.savePersonal')}</button>
      </form>}
    {loading && error && <p className="app-warning mt-3 rounded-xl border p-3 text-sm">{error}</p>}
  </section>;
}

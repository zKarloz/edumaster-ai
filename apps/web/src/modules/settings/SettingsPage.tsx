// Opciones de apariencia y notificaciones. Nuevas preferencias se agregarán aquí.
import { Bell, Check, Clapperboard, Eye, Globe2, Layers3, MonitorCog, RefreshCw, Send, Server, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLocale, type Locale } from '../../i18n';
import { useSettings, type ModalBackdropStyle, type ThemeName, type ToastPosition } from '../../providers/SettingsProvider';
import { useToast } from '../../components/shared/Toast';

const themes: { id: ThemeName; label: string; hint: string; swatch: string }[] = [
  { id: 'light', label: 'Claro', hint: 'Superficies luminosas', swatch: 'bg-[#f5f7fb] border-slate-300' },
  { id: 'dark', label: 'Oscuro', hint: 'Azul marino EduMaster', swatch: 'bg-[#06152B] border-[#20C8F5]' },
  { id: 'black', label: 'Negro', hint: 'Escala de grises', swatch: 'bg-[#090909] border-[#777777]' },
];
const positions: { id: ToastPosition; label: string }[] = [
  { id: 'bottom-right', label: 'Abajo a la derecha' },
  { id: 'top-right', label: 'Arriba a la derecha' },
  { id: 'top-center', label: 'Arriba al centro' },
  { id: 'bottom-center', label: 'Abajo al centro' },
];

export function SettingsPage({ token, apiStatus, onCheckApi }: {
  token: string; apiStatus: 'checking' | 'online' | 'offline'; onCheckApi: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [savingLocale, setSavingLocale] = useState(false);
  const { theme, toastPosition, modalBackdrop, animationsEnabled, blurEnabled, locale, setLocale, setTheme, setToastPosition, setModalBackdrop, setAnimationsEnabled, setBlurEnabled } = useSettings();
  // El idioma es un dato del perfil propio; este endpoint solo cambia language_code.
  async function changeLocale(next: Locale) {
    const previous = locale;
    setLocale(next);
    setSavingLocale(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/me/language`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ language_code: next }),
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      notify(t('settings.languageSaved'), 'success');
    } catch {
      // El usuario conserva el idioma local, pero no afirmamos sincronización remota.
      notify(t('settings.languageError'), 'info');
      if (!token) setLocale(previous);
    } finally { setSavingLocale(false); }
  }
  const { notify } = useToast();
  return <div className="grid gap-5 xl:grid-cols-2">
    <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#23456A] dark:bg-[#0A1F3D]">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><MonitorCog size={21}/> {t('settings.appearance')}</h3>
      <p className="app-muted mb-5 mt-2 text-sm text-slate-500 dark:text-slate-300">{t('settings.appearanceHint')}</p>
      <fieldset className="grid gap-3">
        <legend className="sr-only">{t('settings.colorTheme')}</legend>
        {themes.map(option => <label key={option.id} className={`app-choice flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${theme === option.id ? 'app-choice-selected' : 'border-slate-200 dark:border-[#23456A]'}`}>
          <input className="sr-only" type="radio" name="theme" value={option.id} checked={theme === option.id} onChange={() => setTheme(option.id)}/>
          <span aria-hidden="true" className={`size-10 shrink-0 rounded-lg border-2 ${option.swatch}`}/>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{t(`account.${option.id}`)}</span><span className="app-muted block text-xs text-slate-500 dark:text-slate-300">{t(`settings.${option.id}Hint`)}</span></span>
          {theme === option.id && <Check aria-label="Seleccionado" size={18} className="app-choice-check text-sky-500"/>}
        </label>)}
      </fieldset>
    </section>
    <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#23456A] dark:bg-[#0A1F3D]">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><Bell size={21}/> {t('settings.notifications')}</h3>
      <p className="app-muted mb-5 mt-2 text-sm text-slate-500 dark:text-slate-300">{t('settings.notificationsHint')}</p>
      <fieldset className="space-y-2">
        <legend className="sr-only">{t('settings.notificationPosition')}</legend>
        {positions.map(option => <label key={option.id} className="app-choice flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-[#23456A]">
          <input type="radio" name="toast-position" value={option.id} checked={toastPosition === option.id} onChange={() => setToastPosition(option.id)} className="app-preference-radio accent-sky-500"/>
          {t(`settings.${option.id === 'bottom-right' ? 'bottomRight' : option.id === 'top-right' ? 'topRight' : option.id === 'top-center' ? 'topCenter' : 'bottomCenter'}`)}
        </label>)}
      </fieldset>
      <button type="button" className="app-secondary-button mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium dark:border-[#23456A]" onClick={() => notify(t('settings.testMessage'), 'success')}><Send size={16}/> {t('settings.testNotification')}</button>
    </section>
    <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#23456A] dark:bg-[#0A1F3D] xl:col-span-2">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><Layers3 size={21}/> {t('settings.backdrop')}</h3>
      <p className="app-muted mb-5 mt-2 text-sm text-slate-500 dark:text-slate-300">{t('settings.backdropHint')}</p>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">{t('legacy.k277c698393')}</legend>
        {([
          { id: 'blur', label: 'Desenfoque suave', detail: 'Sombreado y fondo ligeramente difuminado.' },
          { id: 'dim', label: 'Sombreado básico', detail: 'Oscurece el fondo, sin desenfocarlo.' },
        ] satisfies { id: ModalBackdropStyle; label: string; detail: string }[]).map(option =>
          <label key={option.id} className={`app-choice flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${modalBackdrop === option.id ? 'app-choice-selected' : 'border-slate-200 dark:border-[#23456A]'}`}>
            <input type="radio" name="modal-backdrop" value={option.id} checked={modalBackdrop === option.id}
              onChange={() => setModalBackdrop(option.id)} className="app-preference-radio accent-sky-500"/>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{t(`settings.${option.id}`)}</span><span className="app-muted mt-1 block text-xs">{t(`settings.${option.id}Hint`)}</span></span>
          </label>)}
      </fieldset>
    </section>
    <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#23456A] dark:bg-[#0A1F3D] xl:col-span-2">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><Clapperboard size={21}/> {t('settings.animations')}</h3>
      <p className="app-muted mb-5 mt-2 text-sm text-slate-500 dark:text-slate-300">{t('settings.animationsHint')}</p>
      <label className={`app-choice flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${animationsEnabled ? 'app-choice-selected' : 'border-slate-200 dark:border-[#23456A]'}`}>
        <input type="checkbox" role="switch" checked={animationsEnabled} onChange={event => setAnimationsEnabled(event.target.checked)}
          className="app-preference-radio mt-0.5 size-5 shrink-0 accent-sky-500"/>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{t('settings.enableAnimations')}</span>
          <span className="app-muted mt-1 block text-xs">{t(animationsEnabled ? 'settings.on' : 'settings.off')} {t('settings.reduced')}</span>
        </span>
        {animationsEnabled && <Check className="app-choice-check shrink-0" size={18} aria-hidden="true"/>}
      </label>
    </section>

    {/* La opción global afecta superficies translúcidas y blur de modales;
        la preferencia particular del velo sigue guardada para cuando se reactive. */}
    <section className="app-panel rounded-2xl border p-5 sm:p-6 xl:col-span-2">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><Eye size={21}/> {t('settings.blurEffects')}</h3>
      <p className="app-muted mb-4 mt-2 text-sm">{t('settings.blurEffectsHint')}</p>
      <label className={`app-choice flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${blurEnabled ? 'app-choice-selected' : 'border-slate-200 dark:border-[#23456A]'}`}>
        <input type="checkbox" role="switch" checked={blurEnabled} onChange={event => setBlurEnabled(event.target.checked)}
          className="app-preference-radio mt-0.5 size-5 shrink-0 accent-sky-500"/>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{t('settings.enableBlur')}</span>
          <span className="app-muted mt-1 block text-xs">{t(blurEnabled ? 'settings.blurOn' : 'settings.blurOff')}</span>
        </span>
        {blurEnabled && <Check className="app-choice-check shrink-0" size={18} aria-hidden="true"/>}
      </label>
    </section>

    <section className="app-panel rounded-2xl border p-5 sm:p-6 xl:col-span-2">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><Globe2 size={21}/> {t('settings.language')}</h3>
      <p className="app-muted mb-4 mt-2 text-sm">{t('settings.languageHint')}</p>
      <fieldset className="grid gap-2 sm:grid-cols-3" disabled={savingLocale}>
        <legend className="sr-only">{t('settings.language')}</legend>
        {([{value:'es',label:'Español'},{value:'en',label:'English'},{value:'pt',label:'Português (Brasil)'}] as const).map(option =>
          <label key={option.value} className={`app-choice flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm ${locale === option.value ? 'app-choice-selected' : ''}`}>
            <span className="flex items-center gap-2"><input type="radio" name="interface-language" className="accent-sky-500"
              checked={normalizeLocale(locale) === option.value} onChange={() => void changeLocale(option.value)}/>{option.label}</span>
            {locale === option.value && <Check size={17} aria-hidden="true"/>}
          </label>)}
      </fieldset>
      {savingLocale && <p className="app-muted mt-2 text-xs" aria-live="polite">{t('settings.savingLanguage')}</p>}
    </section>
    <section className="app-panel rounded-2xl border p-5 sm:p-6 xl:col-span-2">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><Server size={21}/> {t('settings.system')}</h3>
      <p className="app-muted mt-2 text-sm">{t('settings.systemHint')}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs ${apiStatus==='online'?'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400':'app-warning'}`}>
          {t(apiStatus==='online'?'settings.systemOnline':apiStatus==='offline'?'settings.systemOffline':'settings.systemChecking')}
        </span>
        <button type="button" onClick={() => void onCheckApi()} className="app-secondary-button inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"><RefreshCw size={16}/> {t('common.testApi')}</button>
      </div>
    </section>
    <section className="app-panel rounded-2xl border border-dashed border-slate-200 bg-white p-5 dark:border-[#23456A] dark:bg-[#0A1F3D] xl:col-span-2">
      <p className="flex items-center gap-2 text-sm font-medium"><SlidersHorizontal size={17}/> {t('settings.local')}</p>
      <p className="app-muted mt-2 text-sm text-slate-500 dark:text-slate-300">{t('settings.localHint')}</p>
    </section>
  </div>;
}

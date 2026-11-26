// Pantalla privada de acceso: sin enlaces hacia módulos antes de iniciar sesión.
// Autenticación delegada a Supabase Auth; ningún secreto del servidor se usa aquí.
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSettings } from './providers/SettingsProvider';
import { ArrowRight, BookOpen, BrainCircuit, Building2, GraduationCap, LockKeyhole, Moon, ShieldCheck, Sun, Contrast } from 'lucide-react';
import type { ThemeName } from './providers/SettingsProvider';
import { landingCopy } from './modules/landing/landingCopy';
import { PasswordInput } from './components/shared/PasswordInput';

type Props = {
  email: string;
  password: string;
  busy: boolean;
  error: string;
  theme: ThemeName;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onThemeChange: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function LoginScreen({ email, password, busy, error, theme,
  onEmailChange, onPasswordChange, onThemeChange, onSubmit }: Props) {
  const { t } = useTranslation();
  const { locale, setLocale } = useSettings();
  return <main className="app-shell flex min-h-screen flex-col bg-[#F5F7FB] text-slate-900 dark:bg-[#06152B] dark:text-slate-100">
    <header className="app-header flex items-center justify-between border-b border-slate-200 bg-white/90 px-5 py-4 dark:border-[#23456A] dark:bg-[#081B35]/95 sm:px-9">
      <div className="flex items-center gap-3">
        <span className="app-brand-symbol rounded-xl bg-[#087FE5] p-2.5 text-white"><GraduationCap size={24}/></span>
        <div><strong className="text-lg tracking-tight">EduMaster<span className="app-brand-accent text-[#20C8F5]">.ai</span></strong>
          <p className="app-muted text-xs text-slate-500 dark:text-slate-300">{t('login.slogan')}</p></div>
      </div>
      <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="login-language">{t('settings.language')}</label>
      <select id="login-language" aria-label={t('settings.language')} className="app-input rounded-xl border px-2 py-2 text-sm"
        value={locale} onChange={event => setLocale(event.target.value as 'es'|'en'|'pt')}>
        <option value="es">ES</option><option value="en">EN</option><option value="pt">PT</option>
      </select>
      <button type="button" onClick={onThemeChange} aria-label={`${t('login.theme')}: ${theme}`} title={t('login.theme')}
        className="app-secondary-button rounded-xl border border-slate-200 bg-white p-2.5 dark:border-[#23456A] dark:bg-[#0A1F3D]">
        {theme === 'light' ? <Moon size={18}/> : theme === 'dark' ? <Contrast size={18}/> : <Sun size={18}/>}
      </button></div>
    </header>

    <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 py-10 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
      <section className="space-y-6">
        <span className="app-status-chip inline-flex rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">{t('login.badge')}</span>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{t('login.hero')}</h1>
        <p className="app-muted max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">{t('login.description')}</p>
        <div className="grid max-w-xl gap-3 sm:grid-cols-3">
          {[
            { Icon: Building2, text: t('login.multi') },
            { Icon: BookOpen, text: t('login.academics') },
            { Icon: BrainCircuit, text: t('login.ai') },
          ].map(({ Icon, text }) => <div key={text} className="app-panel flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-[#23456A] dark:bg-[#0A1F3D]">
            <Icon className="app-accent shrink-0 text-[#087FE5] dark:text-[#20C8F5]" size={18}/><span>{text}</span>
          </div>)}
        </div>
      </section>

      <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 dark:border-[#23456A] dark:bg-[#0A1F3D] sm:p-8" aria-labelledby="login-heading">
        <div className="app-status-chip mb-5 inline-flex rounded-xl bg-sky-500/10 p-3 text-sky-600 dark:text-sky-300"><LockKeyhole size={23}/></div>
        <h2 id="login-heading" className="text-2xl font-bold">{t('login.title')}</h2>
        <p className="app-muted mt-2 text-sm text-slate-600 dark:text-slate-300">{t('login.subtitle')}</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-2 text-sm font-medium">{t('login.email')}
            <input autoComplete="email" type="email" required value={email} onChange={e=>onEmailChange(e.target.value)} placeholder="correo@institucion.edu"
              className="app-input min-h-11 w-full rounded-xl border px-3 py-2.5 text-sm font-normal outline-offset-2 focus:border-sky-500"/>
          </label>
          <label className="block space-y-2 text-sm font-medium">{t('login.password')}
            <PasswordInput value={password} onChange={onPasswordChange} autoComplete="current-password" placeholder={t('login.passwordPlaceholder')} disabled={busy}/>
          </label>
          {error && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
          <button type="submit" disabled={busy} className="app-primary-button flex w-full items-center justify-center gap-2 rounded-xl bg-[#087FE5] px-4 py-3 font-semibold text-white hover:bg-[#0669BD] disabled:opacity-60">
            {t(busy ? 'login.busy' : 'login.submit')}{!busy && <ArrowRight size={18}/>}
          </button>
        </form>
        <Link to="/" className="mt-5 inline-block text-sm font-medium text-sky-700 dark:text-sky-300">{landingCopy[locale].home}</Link>
        <p className="app-muted mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500 dark:text-slate-300"><ShieldCheck size={16} className="mt-0.5 shrink-0"/> {t('login.protected')}</p>
      </section>
    </div>
    <footer className="app-page-footer border-t border-slate-200 px-5 py-4 text-center text-xs text-slate-500 dark:border-[#23456A] dark:text-slate-400">EduMaster.ai · {t('common.development')}</footer>
  </main>;
}

// Pantalla privada de acceso: sin enlaces hacia módulos antes de iniciar sesión.
// Autenticación delegada a Supabase Auth; ningún secreto del servidor se usa aquí.
import type { FormEvent } from 'react';
import { ArrowRight, BookOpen, BrainCircuit, Building2, GraduationCap, LockKeyhole, Moon, ShieldCheck, Sun, Contrast } from 'lucide-react';
import type { ThemeName } from './providers/SettingsProvider';

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
  return <main className="app-shell flex min-h-screen flex-col bg-[#F5F7FB] text-slate-900 dark:bg-[#06152B] dark:text-slate-100">
    <header className="app-header flex items-center justify-between border-b border-slate-200 bg-white/90 px-5 py-4 dark:border-[#23456A] dark:bg-[#081B35]/95 sm:px-9">
      <div className="flex items-center gap-3">
        <span className="app-brand-symbol rounded-xl bg-[#087FE5] p-2.5 text-white"><GraduationCap size={24}/></span>
        <div><strong className="text-lg tracking-tight">EduMaster<span className="app-brand-accent text-[#20C8F5]">.ai</span></strong>
          <p className="app-muted text-xs text-slate-500 dark:text-slate-300">Aprende · Practica · Destaca</p></div>
      </div>
      <button type="button" onClick={onThemeChange} aria-label={`Cambiar tema. Tema actual: ${theme}`} title="Cambiar tema"
        className="app-secondary-button rounded-xl border border-slate-200 bg-white p-2.5 dark:border-[#23456A] dark:bg-[#0A1F3D]">
        {theme === 'light' ? <Moon size={18}/> : theme === 'dark' ? <Contrast size={18}/> : <Sun size={18}/>}
      </button>
    </header>

    <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 py-10 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
      <section className="space-y-6">
        <span className="app-status-chip inline-flex rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300">Plataforma de aprendizaje inteligente</span>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Una plataforma para gestionar y comprender el aprendizaje.</h1>
        <p className="app-muted max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">Gestiona instituciones, cursos y progreso académico desde un entorno seguro. La analítica y la inteligencia artificial se integrarán progresivamente.</p>
        <div className="grid max-w-xl gap-3 sm:grid-cols-3">
          {[
            { Icon: Building2, text: 'Multiinstitución' },
            { Icon: BookOpen, text: 'Gestión académica' },
            { Icon: BrainCircuit, text: 'IA en desarrollo' },
          ].map(({ Icon, text }) => <div key={text} className="app-panel flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-[#23456A] dark:bg-[#0A1F3D]">
            <Icon className="app-accent shrink-0 text-[#087FE5] dark:text-[#20C8F5]" size={18}/><span>{text}</span>
          </div>)}
        </div>
      </section>

      <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 dark:border-[#23456A] dark:bg-[#0A1F3D] sm:p-8" aria-labelledby="login-heading">
        <div className="app-status-chip mb-5 inline-flex rounded-xl bg-sky-500/10 p-3 text-sky-600 dark:text-sky-300"><LockKeyhole size={23}/></div>
        <h2 id="login-heading" className="text-2xl font-bold">Iniciar sesión</h2>
        <p className="app-muted mt-2 text-sm text-slate-600 dark:text-slate-300">Accede con tu cuenta autorizada de EduMaster.ai.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-2 text-sm font-medium">Correo electrónico
            <input autoComplete="email" type="email" required value={email} onChange={e=>onEmailChange(e.target.value)} placeholder="correo@institucion.edu"
              className="app-secondary-button w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900 outline-offset-2 focus:border-sky-500 dark:border-[#315578] dark:bg-[#071C37] dark:text-slate-100"/>
          </label>
          <label className="block space-y-2 text-sm font-medium">Contraseña
            <input autoComplete="current-password" type="password" required value={password} onChange={e=>onPasswordChange(e.target.value)} placeholder="Tu contraseña"
              className="app-secondary-button w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900 outline-offset-2 focus:border-sky-500 dark:border-[#315578] dark:bg-[#071C37] dark:text-slate-100"/>
          </label>
          {error && <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
          <button type="submit" disabled={busy} className="app-primary-button flex w-full items-center justify-center gap-2 rounded-xl bg-[#087FE5] px-4 py-3 font-semibold text-white hover:bg-[#0669BD] disabled:opacity-60">
            {busy ? 'Verificando...' : 'Acceder a la plataforma'}{!busy && <ArrowRight size={18}/>}
          </button>
        </form>
        <p className="app-muted mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500 dark:text-slate-300"><ShieldCheck size={16} className="mt-0.5 shrink-0"/> El acceso requiere una cuenta creada en Supabase Auth y habilitada por el administrador de EduMaster.ai.</p>
      </section>
    </div>
    <footer className="app-page-footer border-t border-slate-200 px-5 py-4 text-center text-xs text-slate-500 dark:border-[#23456A] dark:text-slate-400">EduMaster.ai · Entorno de desarrollo · 2026</footer>
  </main>;
}

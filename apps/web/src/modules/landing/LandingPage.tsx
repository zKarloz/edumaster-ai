// Página pública: no consulta datos académicos ni expone rutas privadas.
import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, BookOpen, BrainCircuit, Building2, GraduationCap, ShieldCheck, Moon, Sun, Contrast, Menu, X, MessagesSquare, Lightbulb, ChartNoAxesCombined } from 'lucide-react';
import { useSettings } from '../../providers/SettingsProvider';
import { landingCopy } from './landingCopy';

// Si todavía no se han instalado las fotografías, el panel conserva su diseño.
function Photo({ name, alt, eager = false }: { name: string; alt: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className="relative flex aspect-[3/2] items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#174a7c] to-[#07172e]">
    {failed ? <GraduationCap aria-hidden="true" className="h-24 w-24 text-sky-200/60"/> : <img src={`/images/landing/${name}.jpg`} alt={alt} loading={eager?'eager':'lazy'} width={1200} height={800} onError={()=>setFailed(true)} className="absolute inset-0 h-full w-full object-cover"/>}
  </div>;
}
const featureIcons = [Building2, BookOpen, BrainCircuit, MessagesSquare, ChartNoAxesCombined, Lightbulb];
export function LandingPage({ authenticated }: { authenticated: boolean }) {
  const { locale, setLocale, theme, setTheme } = useSettings();
  const c = landingCopy[locale];
  const [menu, setMenu] = useState(false);
  const destination = authenticated ? '/inicio' : '/login';
  const access = <Link to={destination} className="app-primary-button inline-flex items-center justify-center gap-2 rounded-xl bg-[#087FE5] px-5 py-3 font-semibold text-white hover:bg-[#0669BD]">{c.access}<ArrowRight size={18}/></Link>;
  const links = [[ '#features', c.nav[0]], ['#community',c.nav[1]], ['#intelligence',c.nav[2]], ['#security',c.nav[3]]] as const;
  return <main className="app-shell min-h-screen bg-[#F5F7FB] text-slate-900 dark:bg-[#06152B] dark:text-slate-100">
    <header className="app-header sticky top-0 z-40 border-b border-slate-200 bg-white dark:border-[#23456A] dark:bg-[#081B35]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl"><span className="rounded-xl bg-[#087FE5] p-2 text-white"><GraduationCap size={24}/></span>EduMaster<span className="app-brand-accent text-[#087FE5] dark:text-sky-300">.ai</span></Link>
        <nav aria-label={c.navigation} className={`${menu?'flex':'hidden'} order-last w-full flex-col gap-4 py-3 lg:order-none lg:flex lg:w-auto lg:flex-row lg:py-0`}>{links.map(([href,label])=><a key={href} href={href} onClick={()=>setMenu(false)} className="text-sm font-medium hover:underline">{label}</a>)}</nav>
        <div className="flex items-center gap-2"><select aria-label={c.language} value={locale} onChange={e=>setLocale(e.target.value as typeof locale)} className="app-input rounded-lg border p-2 text-sm"><option value="es">ES</option><option value="en">EN</option><option value="pt">PT</option></select>
          <button type="button" aria-label={c.theme} title={c.theme} onClick={()=>setTheme(theme==='light'?'dark':theme==='dark'?'black':'light')} className="app-secondary-button rounded-lg border p-2">{theme==='light'?<Moon size={18}/>:theme==='dark'?<Contrast size={18}/>:<Sun size={18}/>}</button>
          <button type="button" aria-label={c.navigation} aria-expanded={menu} onClick={()=>setMenu(v=>!v)} className="rounded-lg p-2 lg:hidden">{menu?<X/>:<Menu/>}</button><div className="hidden sm:block">{access}</div></div>
      </div>
    </header>
    <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 lg:grid-cols-2 lg:px-8 lg:py-24">
      <div className="space-y-6"><span className="app-status-chip inline-flex rounded-full bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-700 dark:text-sky-300">{c.badge}</span><h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">{c.hero}<span className="block text-[#087FE5] dark:text-sky-300">{c.heroAccent}</span></h1><p className="app-muted max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">{c.description}</p>{access}</div>
      <Photo name="hero-students" alt={c.photoAlt[0]} eager/>
    </section>
    <section id="features" className="scroll-mt-28 mx-auto max-w-7xl px-5 py-12 lg:px-8"><h2 className="mb-3 text-center text-3xl font-bold">{c.featuresTitle}</h2><p className="app-muted mb-8 text-center">{c.featuresDescription}</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{c.features.map(([title,description],i)=>{const Icon=featureIcons[i]!;return <article key={title} className="app-panel rounded-2xl border p-6"><Icon className="mb-4 text-[#087FE5] dark:text-sky-300" size={30}/><h3 className="mb-2 text-lg font-semibold">{title}</h3><p className="app-muted text-sm leading-6">{description}</p></article>;})}</div></section>
    <section id="community" className="scroll-mt-28 mx-auto max-w-7xl px-5 py-12 lg:px-8"><h2 className="mb-8 text-3xl font-bold">{c.communityTitle}</h2><div className="grid gap-5 md:grid-cols-3">{c.audience.map(([title,description],i)=><article key={title} className="app-panel overflow-hidden rounded-2xl border p-4">{i<2?<Photo name={i===0?'student-learning':'teacher-classroom'} alt={c.photoAlt[i+1]!}/>:<div className="flex aspect-[3/2] items-center justify-center rounded-2xl bg-gradient-to-br from-[#174a7c] to-[#07172e]"><Building2 size={72} className="text-sky-200"/></div>}<h3 className="mt-4 text-xl font-semibold">{title}</h3><p className="app-muted mt-2 text-sm leading-6">{description}</p></article>)}</div></section>
    <section id="intelligence" className="scroll-mt-28 mx-auto max-w-7xl px-5 py-12 lg:px-8"><div className="rounded-3xl bg-[#102e50] p-7 text-white sm:p-12"><div className="grid items-center gap-8 md:grid-cols-2"><div><BrainCircuit size={42} className="mb-4 text-sky-300"/><h2 className="text-3xl font-bold">{c.aiTitle}</h2><p className="mt-4 leading-7 text-sky-100">{c.aiDescription}</p><p className="mt-4 text-sm text-sky-200">{c.aiDisclaimer}</p></div><div className="grid grid-cols-3 gap-3 text-center">{['13','153','250'].map((v,i)=><div key={v} className="rounded-xl bg-white/10 p-4"><strong className="block text-3xl text-sky-300">{v}</strong><span className="text-xs">{c.aiLabels[i]}</span></div>)}</div></div></div></section>
    <section id="security" className="scroll-mt-28 mx-auto max-w-7xl px-5 py-12 lg:px-8"><div className="app-panel rounded-2xl border p-8"><ShieldCheck size={36} className="mb-3 text-[#087FE5] dark:text-sky-300"/><h2 className="text-2xl font-bold">{c.securityTitle}</h2><p className="app-muted mt-3 max-w-3xl leading-7">{c.securityDescription}</p></div></section>
    <section className="mx-auto max-w-7xl px-5 py-10 text-center lg:px-8"><h2 className="mb-5 text-3xl font-bold">{c.cta}</h2>{access}</section>
    <footer className="app-page-footer border-t border-slate-200 px-5 py-7 text-center text-sm dark:border-[#23456A]">EduMaster.ai · © {new Date().getFullYear()} · {c.footer}</footer>
  </main>;
}

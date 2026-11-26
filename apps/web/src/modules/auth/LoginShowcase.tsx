// Presentación pública: no accede a credenciales ni a servicios privados.
import { useState } from 'react';
import { BookOpen, BrainCircuit, Building2, MessagesSquare, BellRing, ShieldCheck, Pause, Play } from 'lucide-react';
import { useSettings } from '../../providers/SettingsProvider';
import { landingCopy } from '../landing/landingCopy';

const copy = {
  es: { pause:'Pausar tarjetas', play:'Reanudar tarjetas', notifications:['Notificaciones académicas','Consulta novedades de tareas y recomendaciones.'] },
  en: { pause:'Pause cards', play:'Resume cards', notifications:['Academic notifications','Review assignment and recommendation updates.'] },
  pt: { pause:'Pausar cartões', play:'Retomar cartões', notifications:['Notificações acadêmicas','Consulte novidades de tarefas e recomendações.'] },
} as const;
const icons = [Building2, BookOpen, BrainCircuit, MessagesSquare, BellRing, ShieldCheck];

export function LoginShowcase() {
  const { locale, animationsEnabled } = useSettings();
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const c = landingCopy[locale];
  const l = copy[locale];
  const features = [c.features[0], c.features[1], c.features[2], c.features[3], l.notifications, [c.securityTitle, c.securityDescription]];
  // Dos grupos idénticos permiten un ciclo continuo sin saltos. Solo uno es accesible.
  return <section className="login-showcase relative isolate flex min-w-0 flex-col justify-end overflow-hidden text-white lg:min-h-[620px]" aria-labelledby="login-showcase-title">
    {/* Fondo independiente: el degradado no reduce la opacidad de los textos. */}
    <div aria-hidden="true" className="login-showcase-background absolute inset-0 -z-10 bg-[#123f70]">
    {!failed && <img src="/images/landing/hero-students.jpg" alt="" aria-hidden="true" onError={()=>setFailed(true)} className="absolute inset-0 h-full w-full object-cover"/>}
    <div className="absolute inset-0 bg-gradient-to-t from-[#06152B] via-[#07172e]/90 to-[#07172e]/35"/>
    </div>
    <div className="px-6 pb-6 pt-16 sm:px-10 lg:pl-12 lg:pr-[clamp(5rem,12vw,11rem)] lg:pt-32">
      <span className="inline-flex rounded-full border border-white/30 bg-[#07172e]/70 px-3 py-1 text-xs font-semibold text-sky-100">{c.badge}</span>
      <h1 id="login-showcase-title" className="mt-5 max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">{c.hero}<span className="block text-sky-300">{c.heroAccent}</span></h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-sky-100 sm:text-base">{c.description}</p>
    </div>
    <div className="hidden pb-8 lg:block">
      <div className="flex justify-end px-10 pb-3">
        <button type="button" disabled={!animationsEnabled} onClick={()=>setPaused(v=>!v)} aria-label={paused?l.play:l.pause} className="login-carousel-toggle inline-flex items-center gap-2 rounded-lg border border-white/30 bg-[#07172e]/90 px-3 py-2 text-xs text-white disabled:hidden">{paused?<Play size={15}/>:<Pause size={15}/>} {paused?l.play:l.pause}</button>
      </div>
      <div className={`login-carousel-window ${!animationsEnabled?'login-carousel-static':''}`}>
        <div className={`login-carousel-track ${paused?'login-carousel-paused':''}`}>
          {[0,1].map(group=><div key={group} aria-hidden={group===1?true:undefined} className={`login-carousel-group ${group===1?'login-carousel-clone':''}`}>
            {features.map(([title,description],i)=>{const Icon=icons[i]!;return <article key={i} className="login-feature-card rounded-2xl border border-white/25 bg-[#102e50]/95 p-5 text-white"><Icon aria-hidden="true" size={26} className="mb-3 text-sky-300"/><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm leading-5 text-sky-100">{description}</p></article>;})}
          </div>)}
        </div>
      </div>
    </div>
  </section>;
}

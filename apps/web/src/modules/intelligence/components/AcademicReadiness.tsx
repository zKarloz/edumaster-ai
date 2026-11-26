/** Inventario institucional agregado. Nunca alimenta el laboratorio DEMO. */
import { useEffect, useRef, useState } from 'react';
import { Database, Search } from 'lucide-react';
import { Accordion } from '../../../components/shared/Accordion';
import { Spinner } from '../../../components/shared/Spinner';
import { useToast } from '../../../components/shared/Toast';
import type { Locale } from '../../../i18n';

const keys = ['enrollments','offerings','events','activities','attempts','progress','submissions','grades','skills'] as const;
type Counts = Record<typeof keys[number], number>;
const copy = {
 es: {title:'Disponibilidad de datos académicos', note:'Diagnóstico agregado por institución. No exporta estudiantes ni habilita entrenamiento real.', select:'Selecciona una institución', run:'Consultar fuentes', error:'No se pudo consultar la disponibilidad.', labels:['Matrículas','Ofertas','Eventos de aprendizaje','Actividades vigentes','Intentos de evaluación','Registros de progreso','Entregas','Notas oficiales de tareas','Evidencias de competencias'], warning:'Los recuentos no demuestran calidad, cobertura temporal ni suficiencia para entrenar. El laboratorio sigue siendo sintético.'},
 en: {title:'Academic data availability', note:'Aggregate institutional diagnostic. No student export or real training.', select:'Select an institution', run:'Check sources', error:'Could not check availability.', labels:['Enrollments','Offerings','Learning events','Valid activities','Assessment attempts','Progress records','Submissions','Official task grades','Skill evidence'], warning:'Counts do not establish quality, temporal coverage or training suitability. The lab remains synthetic.'},
 pt: {title:'Disponibilidade de dados acadêmicos', note:'Diagnóstico agregado por instituição. Não exporta estudantes nem habilita treinamento real.', select:'Selecione uma instituição', run:'Consultar fontes', error:'Não foi possível consultar a disponibilidade.', labels:['Matrículas','Ofertas','Eventos de aprendizagem','Atividades válidas','Tentativas de avaliação','Registros de progresso','Entregas','Notas oficiais de tarefas','Evidências de competências'], warning:'As contagens não demonstram qualidade, cobertura temporal ou suficiência para treinar. O laboratório continua sintético.'},
} as const;

export function AcademicReadiness({locale,token,organizations}:{locale:Locale;token:string;organizations:{id:string;name:string}[]}) {
 const t=copy[locale];
 const {notify}=useToast();
 const [open,setOpen]=useState(false);
 const [org,setOrg]=useState('');
 const [counts,setCounts]=useState<Counts|null>(null);
 const [busy,setBusy]=useState(false);
 const request=useRef<AbortController|null>(null);
 // Cancela solicitudes al salir de la pestaña o cambiar de sesión.
 useEffect(()=>{setCounts(null);setBusy(false);setOrg('');return()=>request.current?.abort();},[token]);
 async function load(){
  if(busy||!organizations.some(o=>o.id===org))return;
  request.current?.abort();
  const controller=new AbortController();request.current=controller;
  setBusy(true);setCounts(null);
  try{
   const response=await fetch(`${import.meta.env.VITE_API_URL||'http://localhost:8000'}/api/v1/neural-academic/organizations/${encodeURIComponent(org)}/readiness`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal,cache:'no-store'});
   if(!response.ok)throw new Error('readiness');
   const data=await response.json();
   if(data.organization_id!==org||data.training_authorized!==false||data.classification!=='AGGREGATE_ONLY'||!keys.every(k=>Number.isSafeInteger(data.counts?.[k])&&data.counts[k]>=0))throw new Error('contract');
   if(!controller.signal.aborted)setCounts(data.counts);
  }catch{if(!controller.signal.aborted)notify(t.error,'info');}
  finally{if(!controller.signal.aborted)setBusy(false);}
 }
 return <Accordion open={open} onToggle={()=>setOpen(v=>!v)} title={t.title} icon={<Database size={18}/>} className="border-[var(--app-panel-border)]">
  <p className="app-muted text-sm">{t.note}</p>
  <div className="flex flex-wrap items-center gap-2">
   <select aria-label={t.select} className="app-secondary-button min-w-0 max-w-full rounded-lg border border-[var(--app-control-border)] p-2 text-sm" value={org} disabled={busy} onChange={e=>{setOrg(e.target.value);setCounts(null);}}>
    <option value="">{t.select}</option>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
   </select>
   <button type="button" disabled={busy||!organizations.some(o=>o.id===org)} onClick={()=>void load()} className="app-secondary-button inline-flex items-center gap-2 rounded-lg border border-[var(--app-control-border)] px-3 py-2 text-sm">{busy?<Spinner compact/>:<Search size={16}/>} {t.run}</button>
  </div>
  {counts&&<dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{keys.map((k,i)=><div key={k} className="rounded-lg border border-[var(--app-control-border)] p-3"><dt className="app-muted text-xs">{t.labels[i]}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{counts[k].toLocaleString(locale)}</dd></div>)}</dl>}
  <p className="app-muted text-xs">{t.warning}</p>
 </Accordion>;
}

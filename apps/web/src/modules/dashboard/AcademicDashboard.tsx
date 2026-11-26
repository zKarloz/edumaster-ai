/** Inicio académico: muestras acotadas, sin inferir progreso ni confundir avisos con entregas. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { BookOpen, ClipboardList, Lightbulb, Users, ArrowRight } from 'lucide-react';
import { Stat } from './DashboardComponents';
import { Spinner } from '../../components/shared/Spinner';
import { courseIcon, courseColor } from '../academic/courseAppearance';
import { courseOfferingPath, courseTaskPath, taskSubmissionsPath, sectionPaths } from '../../routes';
const API=import.meta.env.VITE_API_URL||'http://localhost:8000';
const words={
 es:{courses:'Mis cursos',enrollments:'Matrículas activas en ofertas consultadas',pending:'Tareas próximas a vencer',grading:'Tareas por calificar',recommendations:'Recomendaciones pendientes',open:'Abrir curso',continue:'Continuar aprendiendo',empty:'Sin registros disponibles',failed:'No se pudieron consultar algunos datos.',sample:'Vista de hasta 6 cursos; recomendaciones hasta 200 por curso.',limit:'Hasta 200 recordatorios vigentes consultados.',progress:'Sin progreso registrado.',recorded:'Progreso registrado',community:'Comunidad',all:'Ver todos los cursos',loading:'Consultando actividad académica…'},
 en:{courses:'My courses',enrollments:'Active enrollments in retrieved offerings',pending:'Assignments due soon',grading:'Assignments awaiting grading',recommendations:'Pending recommendations',open:'Open course',continue:'Continue learning',empty:'No records available',failed:'Some data could not be retrieved.',sample:'Up to 6 courses; up to 200 recommendations per course.',limit:'Up to 200 current reminders retrieved.',progress:'No recorded progress.',recorded:'Recorded progress',community:'Community',all:'View all courses',loading:'Loading academic activity…'},
 pt:{courses:'Meus cursos',enrollments:'Matrículas ativas nas ofertas consultadas',pending:'Tarefas próximas do prazo',grading:'Tarefas aguardando avaliação',recommendations:'Recomendações pendentes',open:'Abrir curso',continue:'Continuar aprendendo',empty:'Sem registros disponíveis',failed:'Não foi possível consultar alguns dados.',sample:'Até 6 cursos; até 200 recomendações por curso.',limit:'Até 200 lembretes vigentes consultados.',progress:'Sem progresso registrado.',recorded:'Progresso registrado',community:'Comunidade',all:'Ver todos os cursos',loading:'Consultando atividade acadêmica…'}
};
type Course={id:string;title:string;period:string;appearance_icon?:string;appearance_color?:string;active_enrollments?:number;progress_percent?:number|null};
type Reminder={event_type:string;offering_id:string;target_id:string;title:string;course_title:string;due_at:string|null};
type Recommendation={id:string;title:string;completed_at:string|null;offeringId:string};
type Snapshot={courses:Course[]|null;total:number|null;enrollments:number|null;reminders:Reminder[]|null;recommendations:Recommendation[]|null;failed:boolean};
const empty:Snapshot={courses:null,total:null,enrollments:null,reminders:null,recommendations:null,failed:false};
export function AcademicDashboard({organizationId,token,role}:{organizationId:string;token:string;role:'student'|'instructor'}){
 const {i18n}=useTranslation();const c=words[i18n.language.startsWith('pt')?'pt':i18n.language.startsWith('en')?'en':'es'];
 const navigate=useNavigate();const student=role==='student';const [data,setData]=useState<Snapshot>(empty);const [busy,setBusy]=useState(true);
 useEffect(()=>{
  const ctrl=new AbortController();setData(empty);setBusy(true);
  const get=async<T,>(path:string):Promise<T>=>{const res=await fetch(API+path,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:ctrl.signal});if(!res.ok)throw new Error(String(res.status));return res.json() as Promise<T>;};
  const root=`/api/v1/academic/organizations/${encodeURIComponent(organizationId)}`;
  // La vista docente solicita exclusivamente asignaciones propias, incluso para cuentas gestoras.
  async function load(){
   const [catalog,reminders]=await Promise.allSettled([student?get<{items:(Omit<Course,'id'>&{offering_id:string})[];total:number}>(root+'/my-courses?current=true&limit=6').then(r=>({courses:r.items.map(o=>({...o,id:o.offering_id})),total:r.total,enrollments:null})):get<{items:(Omit<Course,'title'>&{course_title:string})[]}>(root+'/activity/offerings?own=true').then(r=>({courses:r.items.slice(0,6).map(o=>({...o,title:o.course_title})),total:r.items.length,enrollments:r.items.reduce((s,o)=>s+(o.active_enrollments??0),0)})),get<{items:Reminder[]}>(`/api/v1/notifications/academic-pending?organization_id=${encodeURIComponent(organizationId)}`)]);
   if(ctrl.signal.aborted)return;
   const result:Snapshot={...empty,failed:catalog.status==='rejected'||reminders.status==='rejected'};
   if(catalog.status==='fulfilled')Object.assign(result,catalog.value);
   if(reminders.status==='fulfilled')result.reminders=reminders.value.items.filter(r=>r.event_type===(student?'task_due_soon':'task_grading_pending'));
   if(student&&result.courses){
    const recs=await Promise.allSettled(result.courses.map(async o=>{const r=await get<{editor:boolean;items:Omit<Recommendation,'offeringId'>[]}>(`${root}/course-offerings/${o.id}/recommendations?own=true`);if(r.editor)throw new Error('Not a student-only response');return r.items.filter(x=>!x.completed_at).map(x=>({...x,offeringId:o.id}));}));
    if(recs.every(r=>r.status==='fulfilled'))result.recommendations=recs.flatMap(r=>r.status==='fulfilled'?r.value:[]);else result.failed=true;
   }
   if(!ctrl.signal.aborted){setData(result);setBusy(false);}
  }
  void load();return()=>ctrl.abort();
 },[organizationId,token,student]);
 const base=(id:string)=>courseOfferingPath(organizationId,id);
 const metrics=[{title:c.courses,value:data.total,Icon:BookOpen},{title:student?c.pending:c.grading,value:data.reminders?.length,Icon:ClipboardList},{title:student?c.recommendations:c.enrollments,value:student?data.recommendations?.length:data.enrollments,Icon:student?Lightbulb:Users}];
 return <div className="space-y-5">{busy&&<Spinner label={c.loading}/>} {data.failed&&<p role="alert" className="app-warning rounded-xl border p-3 text-sm">{c.failed}</p>}
 <div className="grid gap-3 sm:grid-cols-3">{metrics.map(({title,value,Icon})=><Stat key={title} title={title} value={value} Icon={Icon}/>) }</div>
 <p className="app-muted text-xs">{c.limit} {student?c.sample:'(200 max.)'}</p>
 <section className="app-panel rounded-2xl border p-5 space-y-4"><h3 className="font-semibold">{student?c.continue:c.courses}</h3><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.courses?.map(o=>{const Icon=courseIcon(o.appearance_icon);return <article key={o.id} className="app-panel overflow-hidden rounded-xl border"><div className="flex items-center gap-3 p-4 text-white" style={{background:courseColor(o.appearance_color)}}><Icon size={30}/><div><h4 className="font-semibold">{o.title}</h4><p className="text-xs opacity-90">{o.period}</p></div></div><div className="space-y-3 p-4">{student&&(o.progress_percent==null?<p className="app-muted text-xs">{c.progress}</p>:<div className="space-y-1"><div className="flex justify-between gap-2 text-xs"><span className="app-muted">{c.recorded}</span><span>{Number(o.progress_percent).toFixed(1)}%</span></div><div className="h-2 rounded-full" style={{background:'var(--app-control-hover)'}}><div className="h-full rounded-full bg-emerald-500" style={{width:`${Math.max(0,Math.min(100,Number(o.progress_percent)))}%`}}/></div></div>)}<button className="app-primary-button w-full rounded-lg px-3 py-2 text-sm" onClick={()=>navigate(base(o.id)+(student?'?tab=content':''))}>{student?c.continue:c.open}</button><button className="app-accent flex items-center gap-2 text-sm" onClick={()=>navigate(base(o.id)+'?tab=community')}>{c.community}<ArrowRight size={14}/></button></div></article>})}</div>{data.courses?.length===0&&<p className="app-muted text-sm">{c.empty}</p>}<button className="app-accent text-sm" onClick={()=>navigate(sectionPaths.courses)}>{c.all}</button></section>
 <section className="app-panel rounded-2xl border p-5 space-y-3"><h3 className="font-semibold">{student?c.pending:c.grading}</h3>{data.reminders?.slice(0,6).map(r=><button key={r.target_id} className="app-secondary-button flex w-full items-center gap-3 rounded-xl border p-3 text-left" onClick={()=>navigate(student?courseTaskPath(organizationId,r.offering_id,r.target_id):taskSubmissionsPath(organizationId,r.offering_id,r.target_id))}><ClipboardList className="app-accent shrink-0"/><span className="flex-1 text-sm">{r.title}<span className="app-muted block text-xs">{r.course_title}{student&&r.due_at?` · ${new Intl.DateTimeFormat(i18n.language,{dateStyle:'medium',timeStyle:'short'}).format(new Date(r.due_at))}`:''}</span></span><ArrowRight size={16}/></button>)}{data.reminders?.length===0&&<p className="app-muted text-sm">{c.empty}</p>}</section>
 {student&&<section className="app-panel rounded-2xl border p-5 space-y-3"><h3 className="font-semibold">{c.recommendations}</h3>{data.recommendations?.slice(0,6).map(r=><button key={r.id} className="app-secondary-button flex w-full items-center gap-3 rounded-xl border p-3 text-left" onClick={()=>navigate(`${base(r.offeringId)}?tab=recommendations&recommendation=${encodeURIComponent(r.id)}`)}><Lightbulb className="app-accent shrink-0"/><span className="flex-1 text-sm">{r.title}</span><ArrowRight size={16}/></button>)}{data.recommendations?.length===0&&<p className="app-muted text-sm">{c.empty}</p>}</section>}
 </div>;
}

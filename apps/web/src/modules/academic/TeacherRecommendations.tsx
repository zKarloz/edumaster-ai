/** Recomendaciones humanas; los permisos definitivos siempre se verifican en FastAPI. */
import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Lightbulb, Plus, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';
import { remainingTime } from './recommendationDeadline';
import { courseTaskPath } from '../../routes';
import { useTranslation } from 'react-i18next';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { Modal } from '../../components/shared/Modal';
import { Spinner } from '../../components/shared/Spinner';
import { useToast } from '../../components/shared/Toast';

type Item = {id:string;title:string;body:string;priority:'normal'|'high';created_at:string;completed_at:string|null;author:string;recipient:string};
type Result = {editor:boolean;recipients:{id:string;full_name:string}[];items:Item[]};
const copy = {
 es:{title:'Recomendaciones académicas',note:'Orientaciones humanas del equipo docente. No modifican las notas.',add:'Nueva recomendación',refresh:'Actualizar',recipient:'Estudiante',subject:'Título',body:'Recomendación',priority:'Prioridad',normal:'Media',high:'Alta',pending:'Pendiente',done:'Completada',author:'Docente',status:'Estado',action:'Acción',view:'Ver',complete:'Marcar como completada',save:'Enviar',cancel:'Cancelar',saved:'Recomendación enviada.',completed:'Recomendación completada.',error:'No se pudo completar la operación.',empty:'No hay recomendaciones todavía.',noRecipients:'No hay matrículas activas disponibles.'},
 en:{title:'Academic recommendations',note:'Human guidance from teaching staff. Does not change grades.',add:'New recommendation',refresh:'Refresh',recipient:'Student',subject:'Title',body:'Recommendation',priority:'Priority',normal:'Medium',high:'High',pending:'Pending',done:'Completed',author:'Teacher',status:'Status',action:'Action',view:'View',complete:'Mark as completed',save:'Send',cancel:'Cancel',saved:'Recommendation sent.',completed:'Recommendation completed.',error:'Could not complete the operation.',empty:'No recommendations yet.',noRecipients:'No active enrollments available.'},
 pt:{title:'Recomendações acadêmicas',note:'Orientações humanas da equipe docente. Não alteram as notas.',add:'Nova recomendação',refresh:'Atualizar',recipient:'Estudante',subject:'Título',body:'Recomendação',priority:'Prioridade',normal:'Média',high:'Alta',pending:'Pendente',done:'Concluída',author:'Docente',status:'Estado',action:'Ação',view:'Ver',complete:'Marcar como concluída',save:'Enviar',cancel:'Cancelar',saved:'Recomendação enviada.',completed:'Recomendação concluída.',error:'Não foi possível concluir a operação.',empty:'Ainda não há recomendações.',noRecipients:'Não há matrículas ativas disponíveis.'},
} as const;
// Las insignias reutilizan la paleta semántica de tareas en los tres temas.
function RecommendationBadge({label,tone}:{label:string;tone:'high'|'pending'|'done'}) {
 return <span className={`app-workspace-state ${tone==='high'?'app-recommendation-high':tone==='done'?'app-workspace-published':'app-workspace-archived'} rounded-lg border px-2 py-1 text-xs font-semibold`}>{label}</span>;
}
type Suggestion={task_id:string;title:string;due_at:string|null;priority:'normal'|'high'};
const ruleCopy={
 es:{heading:'Sugerencias automáticas',note:'Reglas académicas: no son predicciones neuronales.',pending:'Realiza la tarea pendiente.',urgent:'Prioriza esta tarea.',open:'Abrir tarea',empty:'No hay tareas pendientes detectadas por estas reglas.',error:'No se pudieron consultar las sugerencias.',due:'Fecha límite',remaining:'Tiempo restante'},
 en:{heading:'Automatic suggestions',note:'Academic rules, not neural predictions.',pending:'Complete the pending assignment.',urgent:'Prioritize this assignment.',open:'Open assignment',empty:'No pending assignments detected by these rules.',error:'Could not load suggestions.',due:'Deadline',remaining:'Time remaining'},
 pt:{heading:'Sugestões automáticas',note:'Regras acadêmicas, não previsões neurais.',pending:'Realize a tarefa pendente.',urgent:'Priorize esta tarefa.',open:'Abrir tarefa',empty:'Nenhuma tarefa pendente detectada por estas regras.',error:'Não foi possível consultar as sugestões.',due:'Prazo',remaining:'Tempo restante'},
} as const;
const secondary='app-secondary-button inline-flex items-center gap-2 rounded-xl border border-[var(--app-control-border)] px-3 py-2 text-sm disabled:opacity-50';
const primary='app-primary-button inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50';
const control='app-input w-full rounded-xl border border-[var(--app-control-border)] px-3 py-2 text-sm';

export function TeacherRecommendations({organizationId,offeringId,token}:{organizationId:string;offeringId:string;token:string}) {
 const {i18n}=useTranslation(); const t=copy[i18n.language.startsWith('pt')?'pt':i18n.language.startsWith('en')?'en':'es'];
 const rules=ruleCopy[i18n.language.startsWith('pt')?'pt':i18n.language.startsWith('en')?'en':'es'];
 const {notify}=useToast();
 const [suggestions,setSuggestions]=useState<Suggestion[]>([]),[rulesLoading,setRulesLoading]=useState(false),[rulesError,setRulesError]=useState(false);
 const [data,setData]=useState<Result|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 const [busy,setBusy]=useState(false),[create,setCreate]=useState(false),[selected,setSelected]=useState<Item|null>(null);
 const [recipient,setRecipient]=useState(''),[title,setTitle]=useState(''),[body,setBody]=useState(''),[priority,setPriority]=useState<'normal'|'high'>('normal');
 const url=`${import.meta.env.VITE_API_URL||'http://localhost:8000'}/api/v1/academic/organizations/${organizationId}/course-offerings/${offeringId}/recommendations`;
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError(false);setData(null);
  void fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal})
   .then(async response=>{if(!response.ok)throw new Error('load');return await response.json() as Result;})
   .then(result=>{if(!controller.signal.aborted)setData(result);})
   .catch(()=>{if(!controller.signal.aborted)setError(true);})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[url,token,revision]);
 // Consulta independiente: un fallo de las reglas no oculta recomendaciones docentes.
 const studentView=data?.editor===false;
 const [now,setNow]=useState(Date.now);
 // Actualiza la cuenta regresiva sin consultas adicionales al servidor.
 useEffect(()=>{if(!studentView)return;setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),15000);return()=>window.clearInterval(timer);},[studentView]);
 const visibleSuggestions=suggestions.flatMap(item=>{
  const deadline=remainingTime(item.due_at,now,i18n.language);
  if(deadline?.expired)return [];
  return [{...item,priority:deadline?(deadline.high?'high':'normal') as Suggestion['priority']:item.priority,remaining:deadline?.label}];
 });
 useEffect(()=>{
  setSuggestions([]);setRulesError(false);setRulesLoading(false);
  if(!studentView)return;
  const controller=new AbortController();setRulesLoading(true);
  void fetch(url+'/suggestions',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal})
   .then(async response=>{if(!response.ok)throw new Error('suggestions');return await response.json() as {items:Suggestion[]};})
   .then(result=>{if(!controller.signal.aborted)setSuggestions(result.items);})
   .catch(()=>{if(!controller.signal.aborted)setRulesError(true);})
   .finally(()=>{if(!controller.signal.aborted)setRulesLoading(false);});
  return()=>controller.abort();
 },[studentView,url,token,revision]);
 async function mutate(path:string,method:'POST'|'PATCH',payload?:unknown){
  if(busy)return;setBusy(true);
  try{
   const response=await fetch(url+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)});
   if(!response.ok)throw new Error('mutation');
   notify(method==='POST'?t.saved:t.completed,'success');setCreate(false);setSelected(null);setRevision(v=>v+1);
  }catch{notify(t.error,'info');}finally{setBusy(false);}
 }
 function submit(e:FormEvent){e.preventDefault();if(!recipient||title.trim().length<3||body.trim().length<5)return;void mutate('','POST',{enrollment_id:recipient,title,body,priority});}
 const columns:Column<Item>[]=[...(data?.editor?[{header:t.recipient,key:'recipient' as const}]:[]),{header:t.subject,key:'title'},{header:t.author,key:'author'},{header:t.priority,key:'priority',render:r=><RecommendationBadge label={t[r.priority]} tone={r.priority==='high'?'high':'pending'}/>},{header:t.status,key:'completed_at',render:r=><RecommendationBadge label={r.completed_at?t.done:t.pending} tone={r.completed_at?'done':'pending'}/>},{header:t.action,key:'id',render:r=><button type="button" className={secondary} onClick={()=>setSelected(r)}>{t.view}</button>}];
 return <section role="tabpanel" className="min-w-0 space-y-4">
  <div className="app-panel rounded-2xl border border-[var(--app-panel-border)] p-4 space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><Lightbulb size={20}/>{t.title}</h2><button className={secondary} disabled={loading||busy} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={16}/>{t.refresh}</button></div>
   <p className="app-muted text-sm">{t.note}</p>
   {data&&<div className="grid grid-cols-2 gap-2">{[[t.pending,data.items.filter(r=>!r.completed_at).length],[t.done,data.items.filter(r=>r.completed_at).length]].map(([label,count])=><div key={label} className="rounded-xl border border-[var(--app-panel-border)] p-3"><RecommendationBadge label={String(label)} tone={label===t.done?'done':'pending'}/><p className="text-xl font-semibold tabular-nums">{count}</p></div>)}</div>}
   {data?.editor&&<><button className={primary} disabled={busy||!data.recipients.length} onClick={()=>{setRecipient('');setTitle('');setBody('');setPriority('normal');setCreate(true);}}><Plus size={17}/>{t.add}</button>{!data.recipients.length&&<p className="app-muted text-sm">{t.noRecipients}</p>}</>}
  </div>
  {loading&&<Spinner/>}{error&&<p role="alert" className="app-warning rounded-xl border p-3">{t.error}</p>}
  {data&&(data.items.length?<DataTable rows={data.items} columns={columns} label={t.title}/>:<p className="app-panel app-muted rounded-xl border p-4">{t.empty}</p>)}
  {studentView&&<div className="app-panel rounded-2xl border border-[var(--app-panel-border)] p-4 space-y-3">
   <h3 className="flex items-center gap-2 font-semibold"><Lightbulb size={18}/>{rules.heading}</h3><p className="app-muted text-sm">{rules.note}</p>
   {rulesLoading?<Spinner/>:rulesError?<p role="alert" className="app-warning rounded-xl border p-3">{rules.error}</p>:visibleSuggestions.length===0?<p className="app-muted text-sm">{rules.empty}</p>:visibleSuggestions.map(item=><article key={item.task_id} className="rounded-xl border border-[var(--app-panel-border)] p-3 space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold break-words">{item.title}</h4><RecommendationBadge label={t[item.priority]} tone={item.priority==='high'?'high':'pending'}/></div>
    <p className="text-sm">{item.priority==='high'?rules.urgent:rules.pending}</p>{item.remaining&&<p className="text-sm font-medium tabular-nums">{rules.remaining}: {item.remaining}</p>}{item.due_at&&<p className="app-muted text-xs">{rules.due}: {new Date(item.due_at).toLocaleString(i18n.language)}</p>}
    <Link className={secondary} to={courseTaskPath(organizationId,offeringId,item.task_id)}>{rules.open}</Link>
   </article>)}
  </div>}
  <Modal open={create} title={t.add} onClose={()=>{if(!busy)setCreate(false);}} mobileSheet>
   <form onSubmit={submit} className="space-y-3"><label className="block text-sm">{t.recipient}<select required className={control} value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="">—</option>{data?.recipients.map(r=><option key={r.id} value={r.id}>{r.full_name}</option>)}</select></label>
    <label className="block text-sm">{t.subject}<input required minLength={3} maxLength={150} className={control} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label className="block text-sm">{t.body}<textarea required minLength={5} maxLength={3000} rows={5} className={control} value={body} onChange={e=>setBody(e.target.value)}/></label>
    <label className="block text-sm">{t.priority}<select className={control} value={priority} onChange={e=>setPriority(e.target.value==='high'?'high':'normal')}><option value="normal">{t.normal}</option><option value="high">{t.high}</option></select></label>
    <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} className={secondary} onClick={()=>setCreate(false)}>{t.cancel}</button><button disabled={busy} className={primary} type="submit">{busy&&<Spinner compact/>}{t.save}</button></div>
   </form>
  </Modal>
  <Modal open={!!selected} title={selected?.title||t.title} onClose={()=>{if(!busy)setSelected(null);}} mobileSheet>
   {selected&&<div className="space-y-3"><p className="app-muted text-sm">{t.author}: {selected.author}</p><div className="flex flex-wrap gap-2"><RecommendationBadge label={t[selected.priority]} tone={selected.priority==='high'?'high':'pending'}/><RecommendationBadge label={selected.completed_at?t.done:t.pending} tone={selected.completed_at?'done':'pending'}/></div><p className="whitespace-pre-wrap break-words text-sm">{selected.body}</p>{!data?.editor&&!selected.completed_at&&<button className={primary} disabled={busy} onClick={()=>void mutate(`/${selected.id}/complete`,'PATCH')}><CheckCircle2 size={17}/>{t.complete}</button>}</div>}
  </Modal>
 </section>;
}

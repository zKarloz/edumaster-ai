/** Recomendaciones humanas; los permisos definitivos siempre se verifican en FastAPI. */
import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Lightbulb, Plus, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { Modal } from '../../components/shared/Modal';
import { Spinner } from '../../components/shared/Spinner';
import { useToast } from '../../components/shared/Toast';

type Item = {id:string;title:string;body:string;priority:'normal'|'high';created_at:string;completed_at:string|null;author:string;recipient:string};
type Result = {editor:boolean;recipients:{id:string;full_name:string}[];items:Item[]};
const copy = {
 es:{title:'Recomendaciones académicas',note:'Orientaciones humanas del equipo docente. No modifican las notas.',add:'Nueva recomendación',refresh:'Actualizar',recipient:'Estudiante',subject:'Título',body:'Recomendación',priority:'Prioridad',normal:'Normal',high:'Alta',pending:'Pendiente',done:'Completada',author:'Autor',status:'Estado',action:'Acción',view:'Ver',complete:'Marcar como completada',save:'Enviar',cancel:'Cancelar',saved:'Recomendación enviada.',completed:'Recomendación completada.',error:'No se pudo completar la operación.',empty:'No hay recomendaciones todavía.',noRecipients:'No hay matrículas activas disponibles.'},
 en:{title:'Academic recommendations',note:'Human guidance from teaching staff. Does not change grades.',add:'New recommendation',refresh:'Refresh',recipient:'Student',subject:'Title',body:'Recommendation',priority:'Priority',normal:'Normal',high:'High',pending:'Pending',done:'Completed',author:'Author',status:'Status',action:'Action',view:'View',complete:'Mark as completed',save:'Send',cancel:'Cancel',saved:'Recommendation sent.',completed:'Recommendation completed.',error:'Could not complete the operation.',empty:'No recommendations yet.',noRecipients:'No active enrollments available.'},
 pt:{title:'Recomendações acadêmicas',note:'Orientações humanas da equipe docente. Não alteram as notas.',add:'Nova recomendação',refresh:'Atualizar',recipient:'Estudante',subject:'Título',body:'Recomendação',priority:'Prioridade',normal:'Normal',high:'Alta',pending:'Pendente',done:'Concluída',author:'Autor',status:'Estado',action:'Ação',view:'Ver',complete:'Marcar como concluída',save:'Enviar',cancel:'Cancelar',saved:'Recomendação enviada.',completed:'Recomendação concluída.',error:'Não foi possível concluir a operação.',empty:'Ainda não há recomendações.',noRecipients:'Não há matrículas ativas disponíveis.'},
} as const;
const secondary='app-secondary-button inline-flex items-center gap-2 rounded-xl border border-[var(--app-control-border)] px-3 py-2 text-sm disabled:opacity-50';
const primary='app-primary-button inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50';
const control='app-input w-full rounded-xl border border-[var(--app-control-border)] px-3 py-2 text-sm';

export function TeacherRecommendations({organizationId,offeringId,token}:{organizationId:string;offeringId:string;token:string}) {
 const {i18n}=useTranslation(); const t=copy[i18n.language.startsWith('pt')?'pt':i18n.language.startsWith('en')?'en':'es'];
 const {notify}=useToast();
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
 async function mutate(path:string,method:'POST'|'PATCH',payload?:unknown){
  if(busy)return;setBusy(true);
  try{
   const response=await fetch(url+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)});
   if(!response.ok)throw new Error('mutation');
   notify(method==='POST'?t.saved:t.completed,'success');setCreate(false);setSelected(null);setRevision(v=>v+1);
  }catch{notify(t.error,'info');}finally{setBusy(false);}
 }
 function submit(e:FormEvent){e.preventDefault();if(!recipient||title.trim().length<3||body.trim().length<5)return;void mutate('','POST',{enrollment_id:recipient,title,body,priority});}
 const columns:Column<Item>[]=[...(data?.editor?[{header:t.recipient,key:'recipient' as const}]:[]),{header:t.subject,key:'title'},{header:t.author,key:'author'},{header:t.priority,key:'priority',render:r=>t[r.priority]},{header:t.status,key:'completed_at',render:r=>r.completed_at?t.done:t.pending},{header:t.action,key:'id',render:r=><button type="button" className={secondary} onClick={()=>setSelected(r)}>{t.view}</button>}];
 return <section role="tabpanel" className="min-w-0 space-y-4">
  <div className="app-panel rounded-2xl border border-[var(--app-panel-border)] p-4 space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><Lightbulb size={20}/>{t.title}</h2><button className={secondary} disabled={loading||busy} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={16}/>{t.refresh}</button></div>
   <p className="app-muted text-sm">{t.note}</p>
   {data&&<div className="grid grid-cols-2 gap-2">{[[t.pending,data.items.filter(r=>!r.completed_at).length],[t.done,data.items.filter(r=>r.completed_at).length]].map(([label,count])=><div key={label} className="rounded-xl border border-[var(--app-panel-border)] p-3"><p className="app-muted text-xs">{label}</p><p className="text-xl font-semibold tabular-nums">{count}</p></div>)}</div>}
   {data?.editor&&<><button className={primary} disabled={busy||!data.recipients.length} onClick={()=>{setRecipient('');setTitle('');setBody('');setPriority('normal');setCreate(true);}}><Plus size={17}/>{t.add}</button>{!data.recipients.length&&<p className="app-muted text-sm">{t.noRecipients}</p>}</>}
  </div>
  {loading&&<Spinner/>}{error&&<p role="alert" className="app-warning rounded-xl border p-3">{t.error}</p>}
  {data&&(data.items.length?<DataTable rows={data.items} columns={columns} label={t.title}/>:<p className="app-panel app-muted rounded-xl border p-4">{t.empty}</p>)}
  <Modal open={create} title={t.add} onClose={()=>{if(!busy)setCreate(false);}} mobileSheet>
   <form onSubmit={submit} className="space-y-3"><label className="block text-sm">{t.recipient}<select required className={control} value={recipient} onChange={e=>setRecipient(e.target.value)}><option value="">—</option>{data?.recipients.map(r=><option key={r.id} value={r.id}>{r.full_name}</option>)}</select></label>
    <label className="block text-sm">{t.subject}<input required minLength={3} maxLength={150} className={control} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label className="block text-sm">{t.body}<textarea required minLength={5} maxLength={3000} rows={5} className={control} value={body} onChange={e=>setBody(e.target.value)}/></label>
    <label className="block text-sm">{t.priority}<select className={control} value={priority} onChange={e=>setPriority(e.target.value==='high'?'high':'normal')}><option value="normal">{t.normal}</option><option value="high">{t.high}</option></select></label>
    <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} className={secondary} onClick={()=>setCreate(false)}>{t.cancel}</button><button disabled={busy} className={primary} type="submit">{busy&&<Spinner compact/>}{t.save}</button></div>
   </form>
  </Modal>
  <Modal open={!!selected} title={selected?.title||t.title} onClose={()=>{if(!busy)setSelected(null);}} mobileSheet>
   {selected&&<div className="space-y-3"><p className="app-muted text-sm">{t.author}: {selected.author} · {t[selected.priority]}</p><p className="whitespace-pre-wrap break-words text-sm">{selected.body}</p><p className="app-muted text-sm">{selected.completed_at?t.done:t.pending}</p>{!data?.editor&&!selected.completed_at&&<button className={primary} disabled={busy} onClick={()=>void mutate(`/${selected.id}/complete`,'PATCH')}><CheckCircle2 size={17}/>{t.complete}</button>}</div>}
  </Modal>
 </section>;
}

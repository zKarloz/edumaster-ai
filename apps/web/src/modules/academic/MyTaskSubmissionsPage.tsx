/** CAMBIOS 21 v30.2.4 · Historial de entregas del estudiante como página.
 * La URL solo identifica la oferta y la tarea. FastAPI determina la matrícula
 * desde el JWT y devuelve únicamente los intentos del estudiante autenticado.
 */
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, Eye } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { Spinner } from '../../components/shared/Spinner';
import { normalizeLocale } from '../../i18n';
import { courseOfferingPath } from '../../routes';
import { TaskSubmissionFileList } from './TaskSubmissionFiles';

interface Props { organizationId:string; offeringId:string; taskId:string; token:string }
interface Task { id:string; title:string; instructions:string; status:'published'|'closed'|'draft' }
interface Submission {
  id:string; attempt_number:number; answer_text:string; status:'submitted'|'reviewed';
  submitted_at:string; review_notes:string|null; reviewed_at:string|null;
}
const API=import.meta.env.VITE_API_URL || 'http://localhost:8000';
const secondary='app-secondary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-50';
const messages={
  es:{back:'Volver a tareas',task:'Tarea',attempt:'Intento',date:'Fecha de envío',status:'Estado',actions:'Acciones',
    mine:'Mis entregas',detail:'Ver detalle',hide:'Cerrar detalle',answer:'Mi respuesta',onlyFiles:'Esta entrega contiene únicamente archivos.',
    notes:'Observaciones del docente',submitted:'Enviada',reviewed:'Revisada',noNotes:'Aún no hay observaciones del docente.',
    empty:'Todavía no has realizado entregas para esta tarea.',loading:'Consultando mis entregas...',error:'No se pudieron consultar tus entregas.',refresh:'Actualizar',restricted:'Este historial solo está disponible para estudiantes matriculados.'},
  en:{back:'Back to assignments',task:'Assignment',attempt:'Attempt',date:'Submitted',status:'Status',actions:'Actions',
    mine:'My submissions',detail:'View details',hide:'Close details',answer:'My answer',onlyFiles:'This submission contains files only.',
    notes:'Teacher feedback',submitted:'Submitted',reviewed:'Reviewed',noNotes:'No teacher feedback yet.',
    empty:'You have not submitted work for this assignment.',loading:'Loading my submissions...',error:'Could not load your submissions.',refresh:'Refresh',restricted:'This history is available to enrolled students only.'},
  pt:{back:'Voltar às tarefas',task:'Tarefa',attempt:'Tentativa',date:'Data de envio',status:'Estado',actions:'Ações',
    mine:'Minhas entregas',detail:'Ver detalhes',hide:'Fechar detalhes',answer:'Minha resposta',onlyFiles:'Esta entrega contém apenas anexos.',
    notes:'Comentários do docente',submitted:'Enviada',reviewed:'Revisada',noNotes:'Ainda não há comentários do docente.',
    empty:'Você ainda não enviou uma resposta para esta tarefa.',loading:'Carregando minhas entregas...',error:'Não foi possível consultar suas entregas.',refresh:'Atualizar',restricted:'Este histórico é exclusivo de estudantes matriculados.'},
} as const;

async function get<T>(endpoint:string,token:string,signal:AbortSignal):Promise<T>{
  const response=await fetch(`${API}${endpoint}`,{headers:{Authorization:`Bearer ${token}`},signal});
  if(!response.ok){
    const body=await response.json().catch(()=>({})) as {detail?:unknown};
    throw new Error(typeof body.detail==='string'?body.detail:`HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function MyTaskSubmissionsPage({organizationId,offeringId,taskId,token}:Props){
  const {i18n}=useTranslation();const locale=normalizeLocale(i18n.language);const t=messages[locale];
  const navigate=useNavigate();const location=useLocation();
  const [task,setTask]=useState<Task|null>(null);
  const [rows,setRows]=useState<Submission[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const root=`/api/v1/academic/organizations/${organizationId}/course-offerings/${offeringId}/tasks`;
  const selectedId=new URLSearchParams(location.search).get('intento');
  // Un ID arbitrario no sirve para ver entregas de otro alumno: solo se puede
  // seleccionar algo que haya devuelto el endpoint /my-submissions.
  const selected=rows.find(item=>item.id===selectedId)??null;
  const back=()=>navigate(`${courseOfferingPath(organizationId,offeringId)}?tab=tasks`);
  const toggle=(id:string)=>navigate(`${location.pathname}${selectedId===id?'':`?intento=${id}`}`);
  const formatDate=(stamp:string)=>new Date(stamp).toLocaleString(locale==='en'?'en-US':locale==='pt'?'pt-BR':'es-PE');

  const load=useCallback(async(signal:AbortSignal)=>{
    setLoading(true);setError('');
    try{
      const data=await get<{role:'editor'|'student';items:Task[]}>(root,token,signal);
      if(data.role!=='student')throw new Error(t.restricted);
      const visible=data.items.find(item=>item.id===taskId&&item.status!=='draft');
      if(!visible)throw new Error('HTTP 404');
      const history=await get<{items:Submission[]}>(`${root}/${taskId}/my-submissions`,token,signal);
      if(!signal.aborted){setTask(visible);setRows(history.items);}
    }catch(reason){if(!signal.aborted){setTask(null);setRows([]);setError(reason instanceof Error?reason.message:t.error);}}
    finally{if(!signal.aborted)setLoading(false);}
  },[root,taskId,token,t.error,t.restricted]);
  useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]);
  const columns:Column<Submission>[]= [
    {header:t.attempt,key:'attempt_number'},
    {header:t.date,key:'submitted_at',render:item=>formatDate(item.submitted_at)},
    {header:t.status,key:'status',render:item=><span className={`app-task-submission-state app-task-submission-${item.status} rounded-lg border px-2 py-1 text-xs font-semibold`}>{t[item.status]}</span>},
    {header:t.actions,key:'id',render:item=><button type="button" className={secondary} aria-expanded={selectedId===item.id} onClick={()=>toggle(item.id)}>
      <Eye size={16}/>{selectedId===item.id?t.hide:t.detail}
    </button>},
  ];

  return <section className="space-y-5" aria-label={t.mine}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" className={secondary} onClick={back}><ArrowLeft size={17}/>{t.back}</button>
    </div>
    {loading&&<Spinner label={t.loading}/>}
    {!loading&&error&&<div className="app-warning rounded-2xl border p-5" role="alert"><strong>{t.error}</strong><p className="mt-2 text-sm">{error}</p></div>}
    {!loading&&task&&<>
      <header className="app-panel app-task-review-header rounded-2xl border p-5 sm:p-6">
        <p className="app-muted inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"><ClipboardList size={16}/>{t.task}</p>
        <h2 className="mt-2 text-xl font-bold">{task.title}</h2>
        <p className="app-muted mt-2 whitespace-pre-wrap text-sm">{task.instructions}</p>
      </header>
      <DataTable<Submission> rows={rows} columns={columns} label={t.mine}/>
      {rows.length===0&&<p className="app-muted text-sm">{t.empty}</p>}
      {selected&&<article className="app-panel app-task-card space-y-4 rounded-2xl border p-5" aria-label={`${t.attempt} ${selected.attempt_number}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">{t.attempt} {selected.attempt_number}</h3>
          <span className={`app-task-submission-state app-task-submission-${selected.status} rounded-lg border px-2 py-1 text-xs font-semibold`}>{t[selected.status]}</span>
        </div>
        <p className="app-muted inline-flex items-center gap-2 text-sm"><CalendarClock size={16}/>{formatDate(selected.submitted_at)}</p>
        <div className="app-task-file-panel space-y-2 rounded-xl border p-4">
          <h4 className="text-sm font-semibold">{t.answer}</h4>
          <p className="whitespace-pre-wrap text-sm">{selected.answer_text||t.onlyFiles}</p>
          <TaskSubmissionFileList root={root} taskId={taskId} submissionId={selected.id} token={token} locale={locale}/>
        </div>
        <div className="app-task-file-panel space-y-2 rounded-xl border p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 size={16}/>{t.notes}</h4>
          <p className="whitespace-pre-wrap text-sm">{selected.review_notes||t.noNotes}</p>
        </div>
      </article>}
    </>}
  </section>;
}

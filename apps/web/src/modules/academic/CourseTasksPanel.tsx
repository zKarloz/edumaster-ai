/** CAMBIOS 21 v30.1 · Tareas y entregas textuales por oferta.
 * Los controles de la interfaz no son seguridad: FastAPI revalida cada acción.
 * La revisión docente no crea una calificación oficial.
 */
import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, ClipboardList, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Spinner } from '../../components/shared/Spinner';
import { normalizeLocale, type Locale } from '../../i18n';
import { courseTaskPath, newCourseTaskPath } from '../../routes';

interface Task {
  id: string; title: string; instructions: string; due_at: string | null;
  max_attempts: number; status: 'draft'|'published'|'closed';
  published_at: string|null; my_attempts: number; total_submissions: number|null;
}
interface Props { organizationId:string; offeringId:string; token:string }
const API=import.meta.env.VITE_API_URL || 'http://localhost:8000';
const primary='app-primary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50';

// Texto compartido por catálogo; la edición y los envíos viven en su propia página.
const messages={
  es:{title:'Tareas y entregas',create:'Nueva tarea',view:'Abrir tarea',instructions:'Instrucciones',
    draft:'Borrador',published:'Publicada',closed:'Cerrada',
    description:'Selecciona una tarea para consultar sus instrucciones y las entregas.',
    empty:'Todavía no hay tareas disponibles.',due:'Fecha límite',attempts:'Intentos',total:'Entregas',
    remaining:'Intentos utilizados',loading:'Consultando tareas...',error:'No se pudo consultar las tareas.'},
  en:{title:'Assignments and submissions',create:'New assignment',view:'Open assignment',instructions:'Instructions',
    draft:'Draft',published:'Published',closed:'Closed',
    description:'Select an assignment to view instructions and submissions.',
    empty:'No assignments available yet.',due:'Deadline',attempts:'Attempts',total:'Submissions',
    remaining:'Attempts used',loading:'Loading assignments...',error:'Could not load assignments.'},
  pt:{title:'Tarefas e entregas',create:'Nova tarefa',view:'Abrir tarefa',instructions:'Instruções',
    draft:'Rascunho',published:'Publicada',closed:'Encerrada',
    description:'Selecione uma tarefa para consultar instruções e entregas.',
    empty:'Ainda não há tarefas disponíveis.',due:'Prazo',attempts:'Tentativas',total:'Entregas',
    remaining:'Tentativas utilizadas',loading:'Carregando tarefas...',error:'Não foi possível consultar as tarefas.'},
} as const;

async function request<T>(path:string,token:string,options:RequestInit={}):Promise<T> {
  const res=await fetch(`${API}${path}`,{...options,headers:{Authorization:`Bearer ${token}`,...options.headers}});
  if(!res.ok){
    const data=await res.json().catch(()=>({})) as {detail?:string};
    throw new Error(typeof data.detail==='string'?data.detail:`HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function CourseTasksPanel({organizationId,offeringId,token}:Props){
  const {i18n}=useTranslation();const language:Locale=normalizeLocale(i18n.language);
  const navigate=useNavigate();
  const t=messages[language];
  const root=`/api/v1/academic/organizations/${organizationId}/course-offerings/${offeringId}/tasks`;
  const [tasks,setTasks]=useState<Task[]>([]);
  const [editor,setEditor]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=useCallback(async(signal:AbortSignal)=>{
    setLoading(true);setError('');
    try{
      const data=await request<{items:Task[];role:'editor'|'student'}>(root,token,{signal});
      if(!signal.aborted){setTasks(data.items);setEditor(data.role==='editor');}
    }catch(reason){if(!signal.aborted)setError(reason instanceof Error?reason.message:t.error);}
    finally{if(!signal.aborted)setLoading(false);}
  },[root,token,t.error]);
  useEffect(()=>{const ctrl=new AbortController();void load(ctrl.signal);return()=>ctrl.abort();},[load]);
  const fmt=(value:string|null)=>value?new Date(value).toLocaleString(language==='pt'?'pt-BR':language==='en'?'en-US':'es-PE'):'—';

  return <section className="space-y-4" role="tabpanel">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-lg font-bold"><ClipboardList size={20}/>{t.title}</h2><p className="app-muted mt-1 text-sm">{t.description}</p></div>
      {editor&&<button className={primary} type="button" onClick={()=>navigate(newCourseTaskPath(organizationId,offeringId))}><Plus size={16}/>{t.create}</button>}
    </header>
    {loading&&<Spinner label={t.loading}/>}
    {error&&<div role="alert" className="app-warning rounded-xl border p-4 text-sm">{error}</div>}
    {!loading&&!error&&tasks.length===0&&<div className="app-panel rounded-2xl border p-7 text-center app-muted">{t.empty}</div>}
    {!loading&&!error&&tasks.map(task=><button key={task.id} type="button"
      className="app-panel app-task-card group block w-full cursor-pointer space-y-3 rounded-2xl border p-4 text-left transition-colors hover:border-[var(--app-primary-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-primary-bg)] sm:p-5"
      aria-label={`${task.title} · ${editor?t.view:t.instructions}`}
      onClick={()=>navigate(courseTaskPath(organizationId,offeringId,task.id))}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1"><h3 className="font-semibold group-hover:underline">{task.title}</h3><p className="app-muted mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed">{task.instructions}</p></div>
        <span className={`app-workspace-state app-workspace-${task.status==='closed'?'archived':task.status} rounded-lg border px-2 py-1 text-xs font-semibold`}>{t[task.status]}</span>
      </div>
      <div className="app-task-meta flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1"><CalendarClock size={14}/>{t.due}: {fmt(task.due_at)}</span>
        <span>{t.attempts}: {task.max_attempts}</span>
        {editor?<span>{t.total}: {task.total_submissions??0}</span>:<span>{t.remaining}: {task.my_attempts}/{task.max_attempts}</span>}
      </div>
    </button>)}
  </section>;
}

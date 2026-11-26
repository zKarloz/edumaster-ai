import { FavoriteStar } from '../favorites/Favorites';
import { matchingScopes, type FavoriteScope } from '../favorites/favoriteRules';
/** CAMBIOS 21 v30.2.3 · Lista de entregas de una tarea como página enlazable.
 * La ruta no autoriza por sí sola: FastAPI verifica rol y alcance institucional
 * para ambas consultas. La tabla compartida delega la paginación al backend.
 */
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpenCheck, CalendarClock, ClipboardList, Eye } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { Spinner } from '../../components/shared/Spinner';
import { normalizeLocale } from '../../i18n';
import { courseTaskPath, taskReviewPath } from '../../routes';

interface Props {organizationId:string;offeringId:string;taskId:string;token:string;embedded?:boolean;favoriteScopes?:FavoriteScope[]}
interface Assignment {id:string;title:string;status:'draft'|'published'|'closed';instructions:string}
interface Submission {
  id:string;attempt_number:number;student_name:string;submitted_at:string;
  status:'submitted'|'reviewed';is_latest_attempt:boolean;official_score:number|null;official_max_score:number|null;
}
const API=import.meta.env.VITE_API_URL || 'http://localhost:8000';
const pageSize=10;
const secondary='app-secondary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-40';
const labels={
  es:{back:'Volver a tareas',task:'Tarea',date:'Fecha',student:'Estudiante',attempt:'Intento',grade:'Nota oficial',state:'Estado',actions:'Acciones',review:'Revisar entrega',see:'Ver revisión',gradeAction:'Calificar con rúbrica',gradeCorrect:'Rectificar nota',gradeHelp:'Para calificar: cierra la tarea y guarda la revisión del último intento.',submitted:'Enviada',reviewed:'Revisada',empty:'Aún no hay entregas de esta tarea.',loading:'Consultando entregas...',error:'No se pudieron consultar las entregas.',refresh:'Actualizar',prev:'Anterior',next:'Siguiente',page:'Página',of:'de',onlyEditor:'Esta lista está disponible únicamente para docentes autorizados.'},
  en:{back:'Back to assignments',task:'Assignment',date:'Date',student:'Student',attempt:'Attempt',grade:'Official grade',state:'Status',actions:'Actions',review:'Review submission',see:'View review',gradeAction:'Grade with rubric',gradeCorrect:'Correct grade',gradeHelp:'To grade: close the assignment and review the latest attempt.',submitted:'Submitted',reviewed:'Reviewed',empty:'No submissions for this assignment.',loading:'Loading submissions...',error:'Could not load submissions.',refresh:'Refresh',prev:'Previous',next:'Next',page:'Page',of:'of',onlyEditor:'Only authorized teachers may access this list.'},
  pt:{back:'Voltar às tarefas',task:'Tarefa',date:'Data',student:'Estudante',attempt:'Tentativa',grade:'Nota oficial',state:'Estado',actions:'Ações',review:'Revisar entrega',see:'Ver revisão',gradeAction:'Avaliar com rubrica',gradeCorrect:'Corrigir nota',gradeHelp:'Para avaliar: encerre a tarefa e revise a última tentativa.',submitted:'Enviada',reviewed:'Revisada',empty:'Ainda não há entregas desta tarefa.',loading:'Consultando entregas...',error:'Não foi possível consultar as entregas.',refresh:'Atualizar',prev:'Anterior',next:'Próxima',page:'Página',of:'de',onlyEditor:'Esta lista é restrita a docentes autorizados.'},
} as const;

/** Ignorar parámetros alterados o demasiado grandes para evitar peticiones costosas. */
function safePage(search:string):number {
  const value=Number(new URLSearchParams(search).get('page')??'0');
  return Number.isSafeInteger(value)&&value>=0&&value<=100000?value:0;
}
async function get<T>(path:string,token:string,signal:AbortSignal):Promise<T>{
  const response=await fetch(`${API}${path}`,{headers:{Authorization:`Bearer ${token}`},signal});
  if(!response.ok){
    const body=await response.json().catch(()=>({})) as {detail?:unknown};
    throw new Error(typeof body.detail==='string'?body.detail:`HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function TaskSubmissionsPage({organizationId,offeringId,taskId,token,embedded=false,favoriteScopes=[]}:Props){
  const {i18n}=useTranslation();const locale=normalizeLocale(i18n.language);const t=labels[locale];
  const navigate=useNavigate();const location=useLocation();
  const page=safePage(location.search);
  const [assignment,setAssignment]=useState<Assignment|null>(null);
  const [rows,setRows]=useState<Submission[]>([]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const root=`/api/v1/academic/organizations/${organizationId}/course-offerings/${offeringId}/tasks`;
  const url=`${root}/${taskId}/submissions?limit=${pageSize}&offset=${page*pageSize}`;
  const back=()=>navigate(courseTaskPath(organizationId,offeringId,taskId));
  const changePage=(next:number)=>navigate(`${location.pathname}?page=${next}`);
  const date=(stamp:string)=>new Date(stamp).toLocaleString(locale==='en'?'en-US':locale==='pt'?'pt-BR':'es-PE');
  const load=useCallback(async(signal:AbortSignal)=>{
    setLoading(true);setError('');
    try{
      const scope=await get<{role:'editor'|'student';items:Assignment[]}>(root,token,signal);
      if(scope.role!=='editor')throw new Error(t.onlyEditor);
      const task=scope.items.find(item=>item.id===taskId&&item.status!=='draft');
      if(!task)throw new Error('HTTP 404');
      const data=await get<{items:Submission[];total:number}>(url,token,signal);
      if(!signal.aborted){setAssignment(task);setRows(data.items);setTotal(data.total);}
    }catch(reason){if(!signal.aborted){setAssignment(null);setRows([]);setError(reason instanceof Error?reason.message:t.error);}}
    finally{if(!signal.aborted)setLoading(false);}
  },[root,token,taskId,url,t.error,t.onlyEditor]);
  useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]);
  const columns:Column<Submission>[]=[
    {header:t.student,key:'student_name'},
    {header:t.attempt,key:'attempt_number'},
    {header:t.date,key:'submitted_at',render:item=>date(item.submitted_at)},
    {header:t.state,key:'status',render:item=><span className={`app-task-submission-state app-task-submission-${item.status} rounded-lg border px-2 py-1 text-xs font-semibold`}>{t[item.status]}</span>},
    {header:t.grade,key:'official_score',render:item=>item.official_score===null?'—':`${item.official_score} / ${item.official_max_score}`},
    {header:t.actions,key:'id',render:item=><div className="flex flex-wrap gap-2">
      <button className={secondary} type="button" onClick={()=>navigate(`${taskReviewPath(organizationId,offeringId,taskId,item.id)}?page=${page}`)}>
        <Eye size={16}/>{item.status==='submitted'?t.review:t.see}
      </button>
      {/* Solo la entrega revisada más reciente de una tarea cerrada puede calificarse. */}
      {assignment?.status==='closed' && item.status==='reviewed' && item.is_latest_attempt &&
        <button type="button" className={secondary} onClick={()=>navigate(`${taskReviewPath(organizationId,offeringId,taskId,item.id)}?page=${page}#calificacion-oficial`)}>
          <BookOpenCheck size={16}/>{item.official_score===null?t.gradeAction:t.gradeCorrect}
        </button>}
    </div>},
  ];
  return <section className="space-y-5" aria-label={t.review}>
    {!embedded&&<div className="flex flex-wrap items-center justify-between gap-2">
      <button className={secondary} type="button" onClick={back}><ArrowLeft size={17}/>{t.back}</button>
    </div>}
    {loading&&<Spinner label={t.loading}/>}
    {error&&!loading&&<div className="app-warning rounded-2xl border p-5" role="alert"><p className="font-semibold">{t.error}</p><p className="mt-2 text-sm">{error}</p></div>}
    {assignment&&!loading&&<>
      {!embedded&&<header className="app-panel app-task-review-header rounded-2xl border p-5 sm:p-6">
        <p className="app-muted flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"><ClipboardList size={16}/>{t.task}</p>
        <h2 className="mt-1 text-xl font-bold">{assignment.title}</h2>
        <FavoriteStar token={token} key={taskId} scopes={matchingScopes(favoriteScopes,'editor')} item={{offeringId,taskId,kind:'submissions',title:assignment.title}}/>
        <p className="app-muted mt-2 whitespace-pre-wrap text-sm">{assignment.instructions}</p>
      </header>}
      {embedded&&<div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-lg font-bold"><ClipboardList size={19}/>{t.review}</h3><FavoriteStar token={token} key={taskId} scopes={matchingScopes(favoriteScopes,'editor')} item={{offeringId,taskId,kind:'submissions',title:assignment.title}}/></div>}
      {assignment.status!=='closed' && <p className="app-muted text-sm">{t.gradeHelp}</p>}
      <DataTable<Submission> rows={rows} columns={columns} label={t.review} manualMode/>
      {rows.length===0&&<p className="app-muted text-sm">{t.empty}</p>}
      <nav className="app-panel flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm" aria-label={t.page}>
        <span className="app-muted inline-flex items-center gap-2"><CalendarClock size={16}/>{t.page} {page+1} {t.of} {Math.max(1,Math.ceil(total/pageSize))}</span>
        <div className="flex gap-2">
          <button className={secondary} type="button" disabled={page===0} onClick={()=>changePage(page-1)}>{t.prev}</button>
          <button className={secondary} type="button" disabled={(page+1)*pageSize>=total} onClick={()=>changePage(page+1)}>{t.next}</button>
        </div>
      </nav>
    </>}
  </section>;
}

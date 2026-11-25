/** CAMBIOS 21 v30.2.2 · Revisión docente en página independiente.
 * La URL contiene IDs para el contexto, pero FastAPI valida institución,
 * oferta, asignación del docente y pertenencia de la entrega en cada GET/POST.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, BookOpenCheck, CalendarClock, CheckCircle2, FileText, Send } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Spinner } from '../../components/shared/Spinner';
import { useToast } from '../../components/shared/Toast';
import { normalizeLocale } from '../../i18n';
import { courseTaskPath } from '../../routes';
import { TaskSubmissionFileList } from './TaskSubmissionFiles';
import { TaskGradePanel } from './TaskRubricPanel';

interface Props { organizationId:string;offeringId:string;taskId:string;submissionId:string;token:string }
interface Task { id:string;title:string;instructions:string;due_at:string|null;status:'draft'|'published'|'closed' }
interface Submission {
  id:string;attempt_number:number;answer_text:string;status:'submitted'|'reviewed';
  submitted_at:string;review_notes:string|null;reviewed_at:string|null;student_name:string;is_latest_attempt:boolean;
}
const API=import.meta.env.VITE_API_URL || 'http://localhost:8000';
const copy={
  es:{breadcrumb:'Cursos / Actividades y tareas / Revisar entrega',back:'Volver a entregas',title:'Revisar entrega',
    assignment:'Tarea',student:'Estudiante',attempt:'Intento',date:'Entregada',answer:'Respuesta del estudiante',
    empty:'El estudiante entregó únicamente archivos.',notes:'Observaciones docentes',placeholder:'Escribe observaciones concretas para el estudiante...',
    save:'Guardar revisión',saved:'Revisión registrada.',already:'Esta entrega ya fue revisada.',loading:'Cargando revisión...',
    retry:'Reintentar',error:'No se pudo consultar la entrega.',gradeAction:'Calificar con rúbrica',gradeClosed:'Para calificar, primero cierra la tarea.',gradeReviewed:'Para calificar, guarda primero la revisión docente.',gradeLatest:'Solo se puede calificar el último intento.',limit:'Tras revisar la entrega y cerrar la tarea podrás registrar su nota oficial.'},
  en:{breadcrumb:'Courses / Assignments / Review submission',back:'Back to submissions',title:'Review submission',
    assignment:'Assignment',student:'Student',attempt:'Attempt',date:'Submitted',answer:'Student response',
    empty:'The student submitted files only.',notes:'Teacher feedback',placeholder:'Write specific feedback for the student...',
    save:'Save review',saved:'Review saved.',already:'This submission has already been reviewed.',loading:'Loading review...',
    retry:'Retry',error:'Could not retrieve the submission.',gradeAction:'Grade with rubric',gradeClosed:'Close the assignment before grading.',gradeReviewed:'Save the teacher review before grading.',gradeLatest:'Only the latest attempt can be graded.',limit:'After reviewing and closing the assignment, you can issue an official grade.'},
  pt:{breadcrumb:'Cursos / Tarefas / Revisar entrega',back:'Voltar às entregas',title:'Revisar entrega',
    assignment:'Tarefa',student:'Estudante',attempt:'Tentativa',date:'Enviada',answer:'Resposta do estudante',
    empty:'O estudante enviou apenas arquivos.',notes:'Comentários do docente',placeholder:'Escreva comentários específicos para o estudante...',
    save:'Salvar revisão',saved:'Revisão registrada.',already:'Esta entrega já foi revisada.',loading:'Carregando revisão...',
    retry:'Tentar novamente',error:'Não foi possível consultar a entrega.',gradeAction:'Avaliar com rubrica',gradeClosed:'Encerre a tarefa antes de avaliar.',gradeReviewed:'Salve a revisão docente antes de avaliar.',gradeLatest:'Somente a última tentativa pode ser avaliada.',limit:'Após revisar e encerrar a tarefa, poderá registrar a nota oficial.'},
} as const;

async function fetchReview(path:string,token:string,signal?:AbortSignal):Promise<{task:Task;submission:Submission}>{
  const response=await fetch(`${API}${path}`,{headers:{Authorization:`Bearer ${token}`},signal});
  if(!response.ok){
    const error=await response.json().catch(()=>({})) as {detail?:string};
    throw new Error(typeof error.detail==='string'?error.detail:`HTTP ${response.status}`);
  }
  return response.json() as Promise<{task:Task;submission:Submission}>;
}

export function TaskSubmissionReviewPage({organizationId,offeringId,taskId,submissionId,token}:Props){
  const {i18n}=useTranslation();const locale=normalizeLocale(i18n.language);const t=copy[locale];
  const {notify}=useToast();const navigate=useNavigate();const location=useLocation();
  const [record,setRecord]=useState<{task:Task;submission:Submission}|null>(null);
  const [notes,setNotes]=useState('');const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const [reload,setReload]=useState(0);
  const root=`/api/v1/academic/organizations/${organizationId}/course-offerings/${offeringId}/tasks`;
  const endpoint=`${root}/${taskId}/submissions/${submissionId}`;
  const rawPage=Number(new URLSearchParams(location.search).get('page')??'0');
  const page=Number.isSafeInteger(rawPage)&&rawPage>=0&&rawPage<=100000?rawPage:0;
  const back=()=>navigate(`${courseTaskPath(organizationId,offeringId,taskId)}?page=${page}`);
  const gradeReason = !record ? '' : record.task.status !== 'closed' ? t.gradeClosed
    : !record.submission.is_latest_attempt ? t.gradeLatest
    : record.submission.status !== 'reviewed' ? t.gradeReviewed : '';
  const jumpToGrade = () => document.getElementById('calificacion-oficial')?.scrollIntoView({behavior:'smooth',block:'start'});
  const stamp=(value:string)=>new Date(value).toLocaleString(locale==='en'?'en-US':locale==='pt'?'pt-BR':'es-PE');
  const load=useCallback(async(signal?:AbortSignal)=>{
    setLoading(true);setError('');
    try{
      const payload=await fetchReview(endpoint,token,signal);
      if(!signal?.aborted){setRecord(payload);setNotes(payload.submission.review_notes??'');}
    }catch(reason){if(!signal?.aborted){setRecord(null);setError(reason instanceof Error?reason.message:t.error);}}
    finally{if(!signal?.aborted)setLoading(false);}
  },[endpoint,token,t.error]);
  useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load,reload]);
  // Respeta el enlace directo desde la tabla incluso tras cargar el registro asíncronamente.
  useEffect(()=>{
    if(location.hash==='#calificacion-oficial' && record && !loading){
      const frame=requestAnimationFrame(jumpToGrade);
      return ()=>cancelAnimationFrame(frame);
    }
  },[location.hash,record,loading]);

  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||record?.submission.status!=='submitted'||notes.trim().length<2)return;
    setBusy(true);
    try{
      const response=await fetch(`${API}${endpoint}/review`,{
        method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({review_notes:notes.trim()}),
      });
      if(!response.ok){const body=await response.json().catch(()=>({})) as {detail?:string};throw new Error(typeof body.detail==='string'?body.detail:t.error);}
      notify(t.saved,'success');setReload(value=>value+1);
    }catch(reason){notify(reason instanceof Error?reason.message:t.error);}
    finally{setBusy(false);}
  }

  return <section className="space-y-5" aria-label={t.title}>
    {/* La cabecera/título de página pertenecen al topbar global. Navegación a la izquierda. */}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" className="app-secondary-button inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm" onClick={back}>
        <ArrowLeft size={17}/>{t.back}
      </button>
      {/* La acción está visible; se deshabilita hasta completar los requisitos académicos. */}
      {record&&!loading&&<button type="button" className="app-primary-button inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
        disabled={Boolean(gradeReason)} title={gradeReason || t.gradeAction} onClick={jumpToGrade}>
        <BookOpenCheck size={17}/>{t.gradeAction}
      </button>}
    </div>
    {record&&!loading&&gradeReason&&<p className="app-muted text-sm" role="status">{gradeReason}</p>}
    {loading&&<Spinner label={t.loading}/>}
    {error&&!loading&&<div role="alert" className="app-warning rounded-2xl border p-5"><p className="font-semibold">{t.error}</p><p className="mt-1 text-sm">{error}</p><button type="button" className="app-secondary-button mt-4 rounded-xl border px-4 py-2 text-sm" onClick={()=>setReload(value=>value+1)}>{t.retry}</button></div>}
    {record&&!loading&&<>
      <div className="app-panel app-task-review-header rounded-2xl border p-5 sm:p-6">
        <p className="app-muted text-xs font-semibold uppercase tracking-wide">{t.assignment}</p>
        <h3 className="mt-1 text-lg font-bold">{record.task.title}</h3>
        <p className="app-muted mt-2 whitespace-pre-wrap text-sm leading-relaxed">{record.task.instructions}</p>
        <div className="app-task-meta mt-4 flex flex-wrap gap-2 text-xs">
          <span>{t.student}: <strong>{record.submission.student_name}</strong></span>
          <span>{t.attempt}: <strong>{record.submission.attempt_number}</strong></span>
          <span><CalendarClock size={14}/>{t.date}: {stamp(record.submission.submitted_at)}</span>
          <span className={`app-task-submission-state app-task-submission-${record.submission.status} rounded-lg border px-2 py-1 font-semibold`}>
            {record.submission.status==='reviewed'?<CheckCircle2 size={14}/>:null}
            {record.submission.status==='reviewed'?t.already:t.title}
          </span>
        </div>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,1fr)]">
        <article className="app-panel app-task-review-section min-w-0 space-y-4 rounded-2xl border p-5 sm:p-6">
          <h3 className="flex items-center gap-2 font-bold"><FileText size={19}/>{t.answer}</h3>
          {record.submission.answer_text
            ?<div className="app-task-answer whitespace-pre-wrap break-words rounded-xl border p-4 text-sm leading-7">{record.submission.answer_text}</div>
            :<p className="app-muted text-sm">{t.empty}</p>}
          <TaskSubmissionFileList root={root} taskId={taskId} submissionId={submissionId} token={token} locale={locale}/>
        </article>
        <article className="app-panel app-task-review-section min-w-0 space-y-4 rounded-2xl border p-5 sm:p-6">
          <h3 className="font-bold">{t.notes}</h3>
          {record.submission.status==='submitted'?<form onSubmit={event=>void save(event)} className="app-task-form space-y-4">
            <label className="block text-sm font-medium"><span className="sr-only">{t.notes}</span>
              <textarea rows={11} className="app-input mt-1 w-full resize-y rounded-xl border p-3 text-sm" required minLength={2} maxLength={3000}
                placeholder={t.placeholder} value={notes} onChange={event=>setNotes(event.target.value)}/>
            </label>
            <p className="app-muted text-xs">{t.limit}</p>
            <button type="submit" className="app-primary-button inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              disabled={busy||notes.trim().length<2}><Send size={16}/>{t.save}</button>
          </form>:<><div className="app-task-answer whitespace-pre-wrap break-words rounded-xl border p-4 text-sm">{record.submission.review_notes||t.already}</div>
            {record.submission.reviewed_at&&<p className="app-muted text-xs">{stamp(record.submission.reviewed_at)}</p>}</>}
        </article>
      </div>
      <TaskGradePanel root={root} taskId={taskId} submissionId={submissionId} token={token}
        status={record.task.status} reviewStatus={record.submission.status}
        isLatest={record.submission.is_latest_attempt} revision={reload}/>
    </>}
  </section>;
}

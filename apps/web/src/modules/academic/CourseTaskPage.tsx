/** CAMBIOS 21 v30.2.5 · Detalle de tarea y envíos sin modales.
 * La ruta es solo un identificador: FastAPI valida institución, oferta,
 * matrícula, docente y fecha límite en todas las mutaciones y consultas.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowLeft, BookOpenCheck, CalendarClock, CheckCircle2, ClipboardList, Eye, Send, XCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { Spinner } from '../../components/shared/Spinner';
import { Modal } from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';
import { normalizeLocale } from '../../i18n';
import { courseOfferingPath, courseTaskPath } from '../../routes';
import { canSendTextSubmission, hasSubmissionContent, taskLocalDateToISO } from './courseTaskRules';
import { TaskStagedFiles, TaskSubmissionFileList } from './TaskSubmissionFiles';
import { TaskSubmissionsPage } from './TaskSubmissionsPage';
import { TaskRubricPanel } from './TaskRubricPanel';

type TaskState='draft'|'published'|'closed';
interface Task {
  id:string;title:string;instructions:string;status:TaskState;due_at:string|null;
  max_attempts:number;my_attempts:number;total_submissions:number|null;
}
interface Submission {
  id:string;attempt_number:number;answer_text:string;status:'submitted'|'reviewed';
  submitted_at:string;review_notes:string|null;reviewed_at:string|null;
}
interface Props {organizationId:string;offeringId:string;taskId:string;token:string}
const API=import.meta.env.VITE_API_URL || 'http://localhost:8000';
const primary='app-primary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50';
const secondary='app-secondary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-50';
const field='app-input mt-1 w-full rounded-xl border px-3 py-2.5 text-sm';
const copy={
  es:{back:'Volver a tareas',new:'Nueva tarea',title:'Tarea',description:'Instrucciones',due:'Fecha límite (opcional)',dueTime:'Hora límite',noDue:'Si no eliges fecha, la tarea no tendrá plazo.',attempts:'Intentos permitidos',
    used:'Intentos utilizados',draft:'Borrador',published:'Publicada',closed:'Cerrada',save:'Guardar borrador',saved:'Tarea guardada.',
    publish:'Publicar tarea',close:'Cerrar tarea',publishConfirm:'¿Confirmas publicar esta tarea?',closeConfirm:'¿Confirmas cerrar esta tarea?',
    cancel:'Cancelar',publishOk:'Tarea publicada.',closeOk:'Tarea cerrada.',review:'Revisar entregas',mine:'Mis entregas',
    send:'Enviar entrega',confirmSend:'Confirmar envío',sendConfirmTitle:'Confirmar entrega',sendConfirm:'¿Confirmas el envío definitivo de esta tarea? Se registrará un intento y no podrás modificar esta entrega después de enviarla.',sendAttempt:'Intento que se registrará',attachedCount:'Archivos adjuntos',answer:'Tu respuesta',onlyFiles:'Este intento contiene únicamente archivos.',
    pending:'Prepara una respuesta o adjunta archivos para enviar.',sent:'Entrega enviada.',notes:'Observaciones docentes',
    noNotes:'Todavía no hay observaciones.',none:'Todavía no has enviado esta tarea.',attempt:'Intento',date:'Fecha de envío',
    status:'Estado',actions:'Acciones',view:'Ver detalle',hide:'Ocultar detalle',submitted:'Enviada',reviewed:'Revisada',
    blocked:'Esta tarea no admite nuevos envíos.',loading:'Cargando tarea...',error:'No se pudo consultar la tarea.',
    invalid:'Esta tarea no existe o no tienes permiso para verla.',onlyEditor:'Solo un docente autorizado puede crear tareas.',
    limit:'El docente podrá registrar la nota oficial tras cerrar la tarea y revisar la entrega.'},
  en:{back:'Back to assignments',new:'New assignment',title:'Assignment',description:'Instructions',due:'Deadline (optional)',dueTime:'Deadline time',noDue:'Without a date, the assignment has no deadline.',attempts:'Allowed attempts',
    used:'Attempts used',draft:'Draft',published:'Published',closed:'Closed',save:'Save draft',saved:'Assignment saved.',
    publish:'Publish assignment',close:'Close assignment',publishConfirm:'Confirm publishing this assignment?',closeConfirm:'Confirm closing this assignment?',
    cancel:'Cancel',publishOk:'Assignment published.',closeOk:'Assignment closed.',review:'Review submissions',mine:'My submissions',
    send:'Submit work',confirmSend:'Confirm submission',sendConfirmTitle:'Confirm submission',sendConfirm:'Submit this assignment now? This will use one attempt; the submission cannot be edited after sending.',sendAttempt:'Attempt to be recorded',attachedCount:'Attached files',answer:'Your response',onlyFiles:'This attempt contains files only.',pending:'Write a response or attach files to submit.',
    sent:'Submission recorded.',notes:'Teacher feedback',noNotes:'No feedback yet.',none:'No submissions yet.',attempt:'Attempt',date:'Submitted',
    status:'Status',actions:'Actions',view:'View details',hide:'Hide details',submitted:'Submitted',reviewed:'Reviewed',
    blocked:'No further submissions are allowed.',loading:'Loading assignment...',error:'Could not load assignment.',
    invalid:'Assignment not found or you do not have access.',onlyEditor:'Only authorized teachers can create assignments.',
    limit:'Teachers may issue an official grade after closing and reviewing the assignment.'},
  pt:{back:'Voltar às tarefas',new:'Nova tarefa',title:'Tarefa',description:'Instruções',due:'Prazo (opcional)',dueTime:'Hora limite',noDue:'Sem data, a tarefa não terá prazo.',attempts:'Tentativas permitidas',
    used:'Tentativas utilizadas',draft:'Rascunho',published:'Publicada',closed:'Encerrada',save:'Salvar rascunho',saved:'Tarefa salva.',
    publish:'Publicar tarefa',close:'Encerrar tarefa',publishConfirm:'Confirmar publicação da tarefa?',closeConfirm:'Confirmar encerramento da tarefa?',
    cancel:'Cancelar',publishOk:'Tarefa publicada.',closeOk:'Tarefa encerrada.',review:'Revisar entregas',mine:'Minhas entregas',
    send:'Enviar entrega',confirmSend:'Confirmar envio',sendConfirmTitle:'Confirmar entrega',sendConfirm:'Confirma o envio definitivo da tarefa? Será registrada uma tentativa e a entrega não poderá ser alterada.',sendAttempt:'Tentativa a registrar',attachedCount:'Arquivos anexados',answer:'Sua resposta',onlyFiles:'Esta tentativa contém apenas arquivos.',
    pending:'Escreva uma resposta ou anexe arquivos para enviar.',sent:'Entrega registrada.',notes:'Comentários do docente',
    noNotes:'Ainda não há comentários.',none:'Ainda não há entregas.',attempt:'Tentativa',date:'Data de envio',
    status:'Estado',actions:'Ações',view:'Ver detalhes',hide:'Ocultar detalhes',submitted:'Enviada',reviewed:'Revisada',
    blocked:'Esta tarefa não permite novos envios.',loading:'Carregando tarefa...',error:'Não foi possível consultar a tarefa.',
    invalid:'Tarefa inexistente ou acesso não autorizado.',onlyEditor:'Somente docentes autorizados podem criar tarefas.',
    limit:'O docente poderá lançar a nota após o encerramento e revisão da tarefa.'},
} as const;

/** Siempre solicita datos autorizados; nunca interpreta un UUID de URL como permiso. */
async function api<T>(path:string,token:string,init:RequestInit={}):Promise<T>{
  const response=await fetch(`${API}${path}`,{...init,headers:{Authorization:`Bearer ${token}`,...init.headers}});
  if(!response.ok){
    const body=await response.json().catch(()=>({})) as {detail?:unknown};
    throw new Error(typeof body.detail==='string'?body.detail:`HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}
function localDate(value:string|null):string{
  if(!value)return '';
  const date=new Date(value);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}

export function CourseTaskPage({organizationId,offeringId,taskId,token}:Props){
  const {i18n}=useTranslation();const locale=normalizeLocale(i18n.language);const t=copy[locale];
  const navigate=useNavigate();const location=useLocation();const {notify}=useToast();
  const root=`/api/v1/academic/organizations/${organizationId}/course-offerings/${offeringId}/tasks`;
  const creating=taskId==='nueva';
  const [task,setTask]=useState<Task|null>(null);
  const [editor,setEditor]=useState(false);const [canSubmit,setCanSubmit]=useState(false);
  const [history,setHistory]=useState<Submission[]>([]);
  const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);const [busy,setBusy]=useState(false);
  const [title,setTitle]=useState('');const [instructions,setInstructions]=useState('');
  // La fecha sigue siendo opcional. Solo la hora se preselecciona a las 23:59.
  const [dueDay,setDueDay]=useState('');const [dueTime,setDueTime]=useState('23:59');
  const [maxAttempts,setMaxAttempts]=useState(1);
  const [confirmAction,setConfirmAction]=useState<'publish'|'close'|null>(null);
  const [confirmSubmission,setConfirmSubmission]=useState(false);
  const [showComposer,setShowComposer]=useState(false);const [answer,setAnswer]=useState('');
  const [attachmentCount,setAttachmentCount]=useState(0);const [attachmentsBusy,setAttachmentsBusy]=useState(false);
  const selectedId=new URLSearchParams(location.search).get('intento');
  const selected=history.find(item=>item.id===selectedId)??null;
  const back=()=>navigate(`${courseOfferingPath(organizationId,offeringId)}?tab=tasks`);
  const formatDate=(value:string)=>new Date(value).toLocaleString(locale==='en'?'en-US':locale==='pt'?'pt-BR':'es-PE');
  const canAnswer=Boolean(task)&&canSendTextSubmission(canSubmit,editor,task?.status??'draft',task?.due_at??null,task?.my_attempts??0,task?.max_attempts??0);

  const load=useCallback(async(signal:AbortSignal)=>{
    setLoading(true);setError('');
    try{
      const data=await api<{role:'editor'|'student';can_submit:boolean;items:Task[]}>(root,token,{signal});
      if(signal.aborted)return;
      const permittedEditor=data.role==='editor';
      if(creating&&!permittedEditor)throw new Error(t.onlyEditor);
      const current=creating?null:data.items.find(item=>item.id===taskId)??null;
      if(!creating&&!current)throw new Error(t.invalid);
      const records=(!creating&&current&&!permittedEditor)
        ?await api<{items:Submission[]}>(`${root}/${taskId}/my-submissions`,token,{signal})
        :{items:[] as Submission[]};
      if(signal.aborted)return;
      setTask(current);setEditor(permittedEditor);setCanSubmit(data.can_submit);setHistory(records.items);
      setTitle(current?.title??'');setInstructions(current?.instructions??'');
      const localDue=localDate(current?.due_at??null);
      setDueDay(localDue.slice(0,10));setDueTime(localDue.slice(11,16)||'23:59');
      setMaxAttempts(current?.max_attempts??1);
    }catch(reason){if(!signal.aborted)setError(reason instanceof Error?reason.message:t.error);}
    finally{if(!signal.aborted)setLoading(false);}
  },[root,token,taskId,creating,t.onlyEditor,t.invalid,t.error]);
  useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load,revision]);

  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!editor||busy||(!creating&&task?.status!=='draft'))return;
    setBusy(true);
    try{
      const payload={title:title.trim(),instructions:instructions.trim(),due_at:taskLocalDateToISO(dueDay?`${dueDay}T${dueTime}`:''),max_attempts:maxAttempts};
      const result=await api<{id?:string}>(creating?root:`${root}/${taskId}`,token,{
        method:creating?'POST':'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),
      });
      notify(t.saved,'success');
      if(creating&&result.id)navigate(courseTaskPath(organizationId,offeringId,result.id),{replace:true});
      else setRevision(value=>value+1);
    }catch(reason){notify(reason instanceof Error?reason.message:t.error);}
    finally{setBusy(false);}
  }
  async function changeStatus(action:'publish'|'close'){
    if(!editor||!task||busy)return;
    setBusy(true);
    try{
      await api(`${root}/${task.id}/${action}`,token,{method:'POST'});
      setConfirmAction(null);notify(action==='publish'?t.publishOk:t.closeOk,'success');setRevision(value=>value+1);
    }catch(reason){notify(reason instanceof Error?reason.message:t.error);}
    finally{setBusy(false);}
  }
  /** El formulario solo abre confirmación. La API se invoca tras confirmar en Modal. */
  function requestSubmission(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!task||!canAnswer||busy||attachmentsBusy||!hasSubmissionContent(answer,attachmentCount))return;
    setConfirmSubmission(true);
  }
  /** Revalida el intento y el contenido antes de efectuar el envío definitivo. */
  async function submitConfirmed(){
    if(!confirmSubmission||!task||!canAnswer||busy||attachmentsBusy||!hasSubmissionContent(answer,attachmentCount))return;
    setBusy(true);
    try{
      await api(`${root}/${task.id}/submissions`,token,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answer_text:answer.trim()}),
      });
      setConfirmSubmission(false);
      notify(t.sent,'success');setShowComposer(false);setAnswer('');setAttachmentCount(0);
      setRevision(value=>value+1);
    }catch(reason){notify(reason instanceof Error?reason.message:t.error);}
    finally{setBusy(false);}
  }
  const columns:Column<Submission>[]=[
    {header:t.attempt,key:'attempt_number'},
    {header:t.date,key:'submitted_at',render:item=>formatDate(item.submitted_at)},
    {header:t.status,key:'status',render:item=><span className={`app-task-submission-state app-task-submission-${item.status} rounded-lg border px-2 py-1 text-xs font-semibold`}>{t[item.status]}</span>},
    {header:t.actions,key:'id',render:item=><button type="button" className={secondary}
      onClick={()=>navigate(`${location.pathname}${selectedId===item.id?'':`?intento=${item.id}`}`)}
      aria-expanded={selectedId===item.id}><Eye size={16}/>{selectedId===item.id?t.hide:t.view}</button>},
  ];

  return <section className="space-y-5" aria-label={t.title}>
    {/* Botón Volver a la izquierda; botón de entrega a la derecha, sin Actualizar. */}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" className={secondary} onClick={back}><ArrowLeft size={17}/>{t.back}</button>
      {/* En tareas publicadas el cierre se gestiona desde la esquina superior derecha. */}
      {!loading&&task&&editor&&task.status==='published'&&<button type="button" className={secondary} disabled={busy}
        onClick={()=>setConfirmAction('close')}><XCircle size={16}/>{t.close}</button>}
      {!loading&&canAnswer&&<button type="button" className={primary} onClick={()=>{
        setShowComposer(true);
        requestAnimationFrame(()=>document.getElementById('formulario-entrega')?.scrollIntoView({behavior:'smooth',block:'start'}));
      }}><Send size={16}/>{t.send}</button>}
    </div>
    {loading&&<Spinner label={t.loading}/>}
    {!loading&&error&&<div role="alert" className="app-warning rounded-2xl border p-5">{error}</div>}
    {!loading&&!error&&(task||creating)&&<>
      <div className="app-panel app-task-review-header space-y-3 rounded-2xl border p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xl font-bold"><ClipboardList size={20}/>{creating?t.new:task?.title}</h2>
          {task&&<span className={`app-workspace-state app-workspace-${task.status==='closed'?'archived':task.status} rounded-lg border px-2 py-1 text-xs font-semibold`}>{t[task.status]}</span>}
        </div>
        {task&&<><p className="app-muted whitespace-pre-wrap text-sm leading-7">{task.instructions}</p>
          <div className="app-task-meta flex flex-wrap gap-2 text-xs"><span><CalendarClock size={14}/>{t.due}: {task.due_at?formatDate(task.due_at):'—'}</span>
            <span>{t.attempts}: {task.max_attempts}</span>
            {!editor&&<span>{t.used}: {task.my_attempts}/{task.max_attempts}</span>}
          </div></>}
      </div>
      {editor&&(creating||task?.status==='draft')&&<form onSubmit={event=>void save(event)} className="app-panel app-task-form space-y-4 rounded-2xl border p-5 sm:p-6">
        <label className="block text-sm font-semibold">{t.title}<input className={field} required minLength={3} maxLength={180} value={title} onChange={event=>setTitle(event.target.value)}/></label>
        <label className="block text-sm font-semibold">{t.description}<textarea className={field} required minLength={10} maxLength={10000} rows={7} value={instructions} onChange={event=>setInstructions(event.target.value)}/></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-semibold">{t.due}<input className={field} type="date" value={dueDay} onChange={event=>setDueDay(event.target.value)}/></label>
          <label className="block text-sm font-semibold">{t.dueTime}<input className={field} type="time" step={60} value={dueTime} onChange={event=>setDueTime(event.target.value)} required/></label>
          <label className="block text-sm font-semibold">{t.attempts}<input className={field} type="number" required min={1} max={10} value={maxAttempts} onChange={event=>setMaxAttempts(Number(event.target.value))}/></label>
        </div>
        <p className="app-muted text-xs">{t.noDue}</p>
        <div className="flex justify-end"><button className={primary} type="submit" disabled={busy}>{t.save}</button></div>
      </form>}
      {editor&&task&&<div className="space-y-3">
        {task.status==='draft'&&<button className={primary} type="button" onClick={()=>setConfirmAction('publish')}><BookOpenCheck size={16}/>{t.publish}</button>}

      </div>}
      {/* Rúbrica por tarea; su estado y permisos se validan también en FastAPI. */}
      {task && <TaskRubricPanel root={root} taskId={task.id} token={token}
        editor={editor} taskStatus={task.status} revision={revision}/>}
      {/* El docente ve las entregas paginadas directamente debajo del detalle.
          Se reutiliza el componente con control de rol de la página anterior. */}
      {editor&&task&&task.status!=='draft'&&<TaskSubmissionsPage
        organizationId={organizationId} offeringId={offeringId} taskId={task.id} token={token} embedded/>}
      {!editor&&task&&<>
        {showComposer&&canAnswer&&<form id="formulario-entrega" onSubmit={requestSubmission} className="app-panel app-task-form scroll-mt-28 space-y-4 rounded-2xl border p-5 sm:p-6">
          <h3 className="font-bold">{t.send}</h3>
          <label className="block text-sm font-semibold">{t.answer}<textarea rows={8} maxLength={10000} className={field} value={answer} onChange={event=>setAnswer(event.target.value)}/></label>
          <TaskStagedFiles root={root} taskId={task.id} token={token} locale={locale} onCountChange={setAttachmentCount} onBusyChange={setAttachmentsBusy}/>
          <p className="app-muted text-xs">{t.limit}</p>
          <div className="flex flex-wrap justify-end gap-2"><button type="button" className={secondary} disabled={busy||attachmentsBusy} onClick={()=>setShowComposer(false)}>{t.cancel}</button>
            <button type="submit" className={primary} disabled={busy||attachmentsBusy||!hasSubmissionContent(answer,attachmentCount)}><Send size={16}/>{t.send}</button></div>
        </form>}
        {!canAnswer&&<p className="app-muted text-sm">{t.blocked}</p>}
        <section className="space-y-4" aria-label={t.mine}>
          <h3 className="text-lg font-bold">{t.mine}</h3>
          {history.length>0?<DataTable<Submission> rows={history} columns={columns} label={t.mine}/>:<p className="app-muted text-sm">{t.none}</p>}
          {selected&&<article className="app-panel app-task-card space-y-4 rounded-2xl border p-5" aria-label={`${t.attempt} ${selected.attempt_number}`}>
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-bold">{t.attempt} {selected.attempt_number}</h4>
              <span className={`app-task-submission-state app-task-submission-${selected.status} rounded-lg border px-2 py-1 text-xs font-semibold`}>{t[selected.status]}</span></div>
            <p className="app-muted inline-flex items-center gap-2 text-sm"><CalendarClock size={16}/>{formatDate(selected.submitted_at)}</p>
            <div className="app-task-file-panel space-y-2 rounded-xl border p-4"><h5 className="text-sm font-semibold">{t.answer}</h5>
              <p className="whitespace-pre-wrap text-sm">{selected.answer_text||t.onlyFiles}</p>
              <TaskSubmissionFileList root={root} taskId={task.id} submissionId={selected.id} token={token} locale={locale}/>
            </div>
            <div className="app-task-file-panel space-y-2 rounded-xl border p-4"><h5 className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 size={16}/>{t.notes}</h5>
              <p className="whitespace-pre-wrap text-sm">{selected.review_notes||t.noNotes}</p></div>
          </article>}
        </section>
      </>}
    </>}
    {/* El estudiante confirma ANTES del POST: cancelar no consume un intento.
        Los archivos ya preparados se conservan si cancela el diálogo. */}
    <Modal open={confirmSubmission} title={t.sendConfirmTitle} onClose={() => { if (!busy) setConfirmSubmission(false); }}>
      <div className="space-y-4 text-sm">
        <div className="app-warning flex items-start gap-2 rounded-xl border p-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0"/>
          <p>{t.sendConfirm}</p>
        </div>
        {task && <div className="space-y-1"><p className="font-semibold">{task.title}</p>
          <p className="app-muted">{t.sendAttempt}: {task.my_attempts + 1} / {task.max_attempts}</p>
          <p className="app-muted">{t.attachedCount}: {attachmentCount}</p></div>}
        <div className="app-divider flex justify-end gap-2 border-t pt-4">
          <button type="button" className={secondary} disabled={busy} onClick={() => setConfirmSubmission(false)}>{t.cancel}</button>
          <button type="button" className={primary}
            disabled={busy || attachmentsBusy || !canAnswer || !hasSubmissionContent(answer, attachmentCount)}
            onClick={() => void submitConfirmed()}><Send size={16}/>{t.confirmSend}</button>
        </div>
      </div>
    </Modal>
    {/* Confirmación visual uniforme con la acción «Suspender» de Usuarios.
        La mutación no sucede hasta confirmar en el modal compartido. */}
    <Modal open={confirmAction !== null} title={confirmAction === 'publish' ? t.publish : t.close}
      onClose={() => { if (!busy) setConfirmAction(null); }}>
      <div className="space-y-4 text-sm">
        <div className="app-warning flex items-start gap-2 rounded-xl border p-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0"/>
          <p>{confirmAction === 'publish' ? t.publishConfirm : t.closeConfirm}</p>
        </div>
        {task && <p className="font-semibold">{task.title}</p>}
        <div className="app-divider flex justify-end gap-2 border-t pt-4">
          <button type="button" className={secondary} disabled={busy} onClick={() => setConfirmAction(null)}>{t.cancel}</button>
          <button type="button" className={primary} disabled={busy || !confirmAction}
            onClick={() => { if (confirmAction) void changeStatus(confirmAction); }}>
            {confirmAction === 'publish' ? t.publish : t.close}
          </button>
        </div>
      </div>
    </Modal>
  </section>;
}

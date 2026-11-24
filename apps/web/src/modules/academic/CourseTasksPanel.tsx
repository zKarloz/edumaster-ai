/** CAMBIOS 21 v30.1 · Tareas y entregas textuales por oferta.
 * Los controles de la interfaz no son seguridad: FastAPI revalida cada acción.
 * La revisión docente no crea una calificación oficial.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { BookOpenCheck, CalendarClock, CheckCircle2, ClipboardList, Eye, Plus, RefreshCcw, Send, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { Modal } from '../../components/shared/Modal';
import { Spinner } from '../../components/shared/Spinner';
import { useToast } from '../../components/shared/Toast';
import { normalizeLocale, type Locale } from '../../i18n';
import { canSendTextSubmission, taskLocalDateToISO } from './courseTaskRules';

interface Task {
  id: string; title: string; instructions: string; due_at: string | null;
  max_attempts: number; status: 'draft'|'published'|'closed';
  published_at: string|null; my_attempts: number; total_submissions: number|null;
}
interface Submission {
  id:string; attempt_number:number; answer_text:string; status:'submitted'|'reviewed';
  submitted_at:string; review_notes:string|null; reviewed_at:string|null; student_name?:string;
}
interface Props { organizationId:string; offeringId:string; token:string }
const API=import.meta.env.VITE_API_URL || 'http://localhost:8000';
const primary='app-primary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50';
const secondary='app-secondary-button inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-50';
const input='app-input w-full rounded-xl border px-3 py-2 text-sm';

// Vocabulario aislado y completo para los tres idiomas ya admitidos.
const messages={
  es:{title:'Tareas y entregas',create:'Nueva tarea',edit:'Editar borrador',publish:'Publicar',close:'Cerrar tarea',
    sent:'Entrega enviada',reviewed:'Revisada',submitted:'Enviada',draft:'Borrador',published:'Publicada',closed:'Cerrada',
    description:'Las tareas pertenecen a esta oferta; los borradores no son visibles para estudiantes.',
    empty:'Todavía no hay tareas disponibles.',instructions:'Instrucciones',due:'Fecha límite (opcional)',
    attempts:'Intentos permitidos',attemptNumber:'Intento',total:'Entregas',titleLabel:'Título',
    answer:'Tu respuesta',send:'Enviar entrega',mine:'Mis entregas',view:'Revisar entregas',
    review:'Revisar',notes:'Observaciones para el estudiante',saveReview:'Guardar revisión',
    save:'Guardar borrador',cancel:'Cancelar',back:'Volver',previous:'Anterior',next:'Siguiente',
    page:'Página',confirm:'Confirmar acción',confirmPublish:'¿Publicar esta tarea para estudiantes de esta oferta? Tras publicar no podrás editar sus instrucciones.',
    confirmClose:'¿Cerrar la tarea? Los estudiantes conservarán el historial, pero ya no podrán entregar respuestas.',
    noSubmissions:'No hay entregas todavía.',noAttempts:'Todavía no has enviado una respuesta.',
    limits:'Sin calificación oficial en esta etapa.',refresh:'Actualizar',loading:'Consultando tareas...',
    saved:'Tarea guardada.',publishedOk:'Tarea publicada.',closedOk:'Tarea cerrada.',
    sentOk:'Entrega registrada.',reviewOk:'Observaciones registradas.',error:'No se pudo completar la operación.',
    remaining:'Intentos usados',late:'Plazo vencido',locked:'No se admiten nuevas entregas.',
    student:'Estudiante',date:'Fecha',status:'Estado',actions:'Acciones',
  },
  en:{title:'Assignments and submissions',create:'New assignment',edit:'Edit draft',publish:'Publish',close:'Close assignment',
    sent:'Submitted',reviewed:'Reviewed',submitted:'Submitted',draft:'Draft',published:'Published',closed:'Closed',
    description:'Assignments belong to this offering; drafts are hidden from students.',
    empty:'No assignments available yet.',instructions:'Instructions',due:'Due date (optional)',
    attempts:'Allowed attempts',attemptNumber:'Attempt',total:'Submissions',titleLabel:'Title',
    answer:'Your response',send:'Submit response',mine:'My submissions',view:'View submissions',
    review:'Review',notes:'Feedback for the student',saveReview:'Save review',
    save:'Save draft',cancel:'Cancel',back:'Back',previous:'Previous',next:'Next',
    page:'Page',confirm:'Confirm action',confirmPublish:'Publish this assignment to students? Instructions cannot be edited after publication.',
    confirmClose:'Close the assignment? Students keep their history but cannot submit.',
    noSubmissions:'No submissions yet.',noAttempts:'You have not submitted yet.',
    limits:'Official grading is not included in this stage.',refresh:'Refresh',loading:'Loading assignments...',
    saved:'Assignment saved.',publishedOk:'Assignment published.',closedOk:'Assignment closed.',
    sentOk:'Submission recorded.',reviewOk:'Feedback recorded.',error:'Could not complete the operation.',
    remaining:'Attempts used',late:'Deadline passed',locked:'No more submissions allowed.',
    student:'Student',date:'Date',status:'Status',actions:'Actions',
  },
  pt:{title:'Tarefas e entregas',create:'Nova tarefa',edit:'Editar rascunho',publish:'Publicar',close:'Encerrar tarefa',
    sent:'Enviada',reviewed:'Revisada',submitted:'Enviada',draft:'Rascunho',published:'Publicada',closed:'Encerrada',
    description:'As tarefas pertencem a esta oferta; rascunhos não são vistos pelos estudantes.',
    empty:'Ainda não há tarefas disponíveis.',instructions:'Instruções',due:'Prazo (opcional)',
    attempts:'Tentativas permitidas',attemptNumber:'Tentativa',total:'Entregas',titleLabel:'Título',
    answer:'Sua resposta',send:'Enviar resposta',mine:'Minhas entregas',view:'Ver entregas',
    review:'Revisar',notes:'Comentários ao estudante',saveReview:'Salvar revisão',
    save:'Salvar rascunho',cancel:'Cancelar',back:'Voltar',previous:'Anterior',next:'Próxima',
    page:'Página',confirm:'Confirmar ação',confirmPublish:'Publicar esta tarefa? As instruções não poderão ser editadas depois.',
    confirmClose:'Encerrar a tarefa? O histórico permanece, mas novos envios serão bloqueados.',
    noSubmissions:'Ainda não há entregas.',noAttempts:'Você ainda não enviou uma resposta.',
    limits:'Sem nota oficial nesta etapa.',refresh:'Atualizar',loading:'Carregando tarefas...',
    saved:'Tarefa salva.',publishedOk:'Tarefa publicada.',closedOk:'Tarefa encerrada.',
    sentOk:'Entrega registrada.',reviewOk:'Comentários registrados.',error:'Não foi possível completar a operação.',
    remaining:'Tentativas usadas',late:'Prazo vencido',locked:'Novas entregas não permitidas.',
    student:'Estudante',date:'Data',status:'Estado',actions:'Ações',
  },
} as const;

/** Convierte el input horario local a ISO con zona, sin confiar en hora del navegador. */
function fromIso(value:string|null):string {
  if(!value)return '';
  const date=new Date(value);const offset=date.getTimezoneOffset()*60000;
  return new Date(date.getTime()-offset).toISOString().slice(0,16);
}
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
  const t=messages[language];const {notify}=useToast();
  const root=`/api/v1/academic/organizations/${organizationId}/course-offerings/${offeringId}/tasks`;
  const [tasks,setTasks]=useState<Task[]>([]);
  const [editor,setEditor]=useState(false);const [canSubmit,setCanSubmit]=useState(false);
  const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');const [revision,setRevision]=useState(0);
  const [edit,setEdit]=useState<Task|null|undefined>(undefined);
  const [name,setName]=useState('');const [instructions,setInstructions]=useState('');
  const [due,setDue]=useState('');const [maxAttempts,setMaxAttempts]=useState(1);
  const [confirm,setConfirm]=useState<{task:Task;action:'publish'|'close'}|null>(null);
  const [answerTask,setAnswerTask]=useState<Task|null>(null);const [answer,setAnswer]=useState('');
  const [mineTask,setMineTask]=useState<Task|null>(null);const [mine,setMine]=useState<Submission[]>([]);
  const [selectedTask,setSelectedTask]=useState<Task|null>(null);
  const [submissions,setSubmissions]=useState<Submission[]>([]);const [total,setTotal]=useState(0);const [page,setPage]=useState(0);
  const [review,setReview]=useState<Submission|null>(null);const [reviewNotes,setReviewNotes]=useState('');
  const pageSize=10;
  const load=useCallback(async(signal?:AbortSignal)=>{
    setLoading(true);setError('');
    try{
      const data=await request<{items:Task[];role:'editor'|'student';can_submit:boolean}>(root,token,{signal});
      if(!signal?.aborted){setTasks(data.items);setEditor(data.role==='editor');setCanSubmit(data.can_submit);}
    }catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:t.error);}
    finally{if(!signal?.aborted)setLoading(false);}
  },[root,token,t.error]);
  useEffect(()=>{const ctrl=new AbortController();void load(ctrl.signal);return()=>ctrl.abort();},[load,revision]);
  const loadTeacher=useCallback(async(task:Task,offset:number)=>{
    const data=await request<{items:Submission[];total:number}>(`${root}/${task.id}/submissions?limit=${pageSize}&offset=${offset}`,token);
    setSubmissions(data.items);setTotal(data.total);
  },[root,token]);
  const loadMine=useCallback(async(task:Task)=>{
    const data=await request<{items:Submission[]}>(`${root}/${task.id}/my-submissions`,token);
    setMine(data.items);
  },[root,token]);
  useEffect(()=>{
    if(!selectedTask)return;
    void loadTeacher(selectedTask,page*pageSize).catch(e=>notify(e instanceof Error?e.message:t.error));
  },[selectedTask,page,revision,loadTeacher,notify,t.error]);
  useEffect(()=>{
    if(!mineTask)return;
    void loadMine(mineTask).catch(e=>notify(e instanceof Error?e.message:t.error));
  },[mineTask,revision,loadMine,notify,t.error]);

  function startEdit(task:Task|null){
    setEdit(task);setName(task?.title??'');setInstructions(task?.instructions??'');
    setDue(fromIso(task?.due_at??null));setMaxAttempts(task?.max_attempts??1);
  }
  async function perform(action:()=>Promise<unknown>,message:string,close:()=>void){
    if(busy)return;setBusy(true);
    try{await action();close();notify(message,'success');setRevision(v=>v+1);}
    catch(e){notify(e instanceof Error?e.message:t.error);}
    finally{setBusy(false);}
  }
  function saveTask(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    let dueAt:string|null;
    try{dueAt=taskLocalDateToISO(due);}catch{notify(t.error);return;}
    const body={title:name.trim(),instructions:instructions.trim(),due_at:dueAt,max_attempts:maxAttempts};
    const path=edit?`${root}/${edit.id}`:root;
    void perform(()=>request(path,token,{method:edit?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),t.saved,()=>setEdit(undefined));
  }
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!answerTask)return;
    void perform(()=>request(`${root}/${answerTask.id}/submissions`,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answer_text:answer.trim()})}),t.sentOk,()=>{setAnswer('');setAnswerTask(null);});
  }
  function submitReview(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!review||!selectedTask)return;
    void perform(()=>request(`${root}/${selectedTask.id}/submissions/${review.id}/review`,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({review_notes:reviewNotes.trim()})}),t.reviewOk,()=>setReview(null));
  }
  const fmt=(value:string|null)=>value?new Date(value).toLocaleString(language==='pt'?'pt-BR':language==='en'?'en-US':'es-PE'):'—';
  const submissionsColumns:Column<Submission>[]=[
    {header:t.student,key:'student_name'},
    {header:t.attemptNumber,key:'attempt_number'},
    {header:t.date,key:'submitted_at',render:row=>fmt(row.submitted_at)},
    {header:t.status,key:'status',render:row=>t[row.status]},
    {header:t.actions,key:'id',render:row=><button type="button" className={secondary} disabled={busy||row.status!=='submitted'} onClick={()=>{setReview(row);setReviewNotes('');}}><Eye size={15}/>{t.review}</button>},
  ];
  return <section className="space-y-4" role="tabpanel">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-lg font-bold"><ClipboardList size={20}/>{t.title}</h2><p className="app-muted mt-1 text-sm">{t.description}</p></div>
      <div className="flex gap-2"><button className={secondary} type="button" onClick={()=>setRevision(v=>v+1)} disabled={busy}><RefreshCcw size={16}/>{t.refresh}</button>
        {editor&&<button className={primary} type="button" onClick={()=>startEdit(null)}><Plus size={16}/>{t.create}</button>}</div>
    </header>
    {loading&&<Spinner label={t.loading}/>}
    {error&&<div role="alert" className="app-warning rounded-xl border p-4 text-sm">{error}</div>}
    {!loading&&!error&&tasks.length===0&&<div className="app-panel rounded-2xl border p-7 text-center app-muted">{t.empty}</div>}
    {!loading&&!error&&tasks.map(task=>{
      const overdue=Boolean(task.due_at&&new Date(task.due_at).getTime()<Date.now());
      const canAnswer=canSendTextSubmission(canSubmit,editor,task.status,task.due_at,task.my_attempts,task.max_attempts);
      return <article key={task.id} className="app-panel rounded-2xl border p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1"><h3 className="font-semibold">{task.title}</h3><p className="app-muted mt-1 whitespace-pre-wrap text-sm leading-relaxed">{task.instructions}</p></div>
          <span className="app-workspace-state rounded-lg border px-2 py-1 text-xs font-semibold">{t[task.status]}</span>
        </div>
        <div className="app-muted flex flex-wrap gap-4 text-xs">
          <span className="inline-flex items-center gap-1"><CalendarClock size={14}/>{t.due}: {fmt(task.due_at)}</span>
          <span>{t.attempts}: {task.max_attempts}</span>
          {editor?<span>{t.total}: {task.total_submissions??0}</span>:<span>{t.remaining}: {task.my_attempts}/{task.max_attempts}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {editor&&task.status==='draft'&&<><button type="button" className={secondary} disabled={busy} onClick={()=>startEdit(task)}>{t.edit}</button>
            <button type="button" className={primary} disabled={busy} onClick={()=>setConfirm({task,action:'publish'})}><BookOpenCheck size={16}/>{t.publish}</button></>}
          {editor&&task.status==='published'&&<button type="button" className={secondary} disabled={busy} onClick={()=>setConfirm({task,action:'close'})}><XCircle size={16}/>{t.close}</button>}
          {editor&&task.status!=='draft'&&<button type="button" className={secondary} onClick={()=>{setSelectedTask(task);setPage(0);}}><Eye size={16}/>{t.view}</button>}
          {!editor&&<><button type="button" className={secondary} onClick={()=>setMineTask(task)}><Eye size={16}/>{t.mine}</button>
            {canAnswer&&<button type="button" className={primary} onClick={()=>{setAnswerTask(task);setAnswer('');}}><Send size={16}/>{t.send}</button>}
            {!canAnswer&&<span className="app-muted self-center text-xs">{overdue?t.late:t.locked}</span>}</>}
        </div>
      </article>;
    })}
    <Modal open={edit!==undefined} title={edit?t.edit:t.create} onClose={()=>{if(!busy)setEdit(undefined);}}>
      <form className="space-y-4" onSubmit={saveTask}>
        <label className="block text-sm font-medium">{t.titleLabel}<input className={`${input} mt-1`} value={name} onChange={e=>setName(e.target.value)} minLength={3} maxLength={180} required/></label>
        <label className="block text-sm font-medium">{t.instructions}<textarea className={`${input} mt-1`} value={instructions} onChange={e=>setInstructions(e.target.value)} minLength={10} maxLength={10000} rows={5} required/></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-medium">{t.due}<input type="datetime-local" className={`${input} mt-1`} value={due} onChange={e=>setDue(e.target.value)}/></label>
          <label className="block text-sm font-medium">{t.attempts}<input type="number" className={`${input} mt-1`} min={1} max={10} value={maxAttempts} onChange={e=>setMaxAttempts(Number(e.target.value))} required/></label></div>
        <div className="flex justify-end gap-2"><button type="button" className={secondary} disabled={busy} onClick={()=>setEdit(undefined)}>{t.cancel}</button><button type="submit" className={primary} disabled={busy}>{t.save}</button></div>
      </form>
    </Modal>
    <Modal open={confirm!==null} title={t.confirm} onClose={()=>setConfirm(null)}>
      <p className="text-sm">{confirm?.action==='publish'?t.confirmPublish:t.confirmClose}</p>
      <div className="mt-4 flex justify-end gap-2"><button type="button" className={secondary} disabled={busy} onClick={()=>setConfirm(null)}>{t.cancel}</button>
        <button type="button" className={primary} disabled={busy} onClick={()=>{
          if(!confirm)return;
          const action=confirm.action;
          void perform(()=>request(`${root}/${confirm.task.id}/${action}`,token,{method:'POST'}),action==='publish'?t.publishedOk:t.closedOk,()=>setConfirm(null));
        }}>{confirm?.action==='publish'?t.publish:t.close}</button></div>
    </Modal>
    <Modal open={answerTask!==null} title={t.send} onClose={()=>{if(!busy)setAnswerTask(null);}}>
      <form className="space-y-4" onSubmit={submit}>
        <strong className="block text-sm">{answerTask?.title}</strong>
        <label className="block text-sm font-medium">{t.answer}<textarea rows={8} className={`${input} mt-1`} minLength={1} maxLength={10000} required value={answer} onChange={e=>setAnswer(e.target.value)}/></label>
        <p className="app-muted text-xs">{t.limits}</p>
        <div className="flex justify-end gap-2"><button type="button" className={secondary} onClick={()=>setAnswerTask(null)} disabled={busy}>{t.cancel}</button><button type="submit" className={primary} disabled={busy||!answer.trim()}><Send size={16}/>{t.send}</button></div>
      </form>
    </Modal>
    <Modal open={mineTask!==null} title={t.mine} onClose={()=>setMineTask(null)}>
      <div className="space-y-3">{mine.length===0&&<p className="app-muted text-sm">{t.noAttempts}</p>}
        {mine.map(item=><div key={item.id} className="app-panel space-y-2 rounded-xl border p-3 text-sm">
          <div className="flex items-center justify-between"><strong>{t.attemptNumber} {item.attempt_number}</strong><span className="app-muted">{t[item.status]}</span></div>
          <p className="whitespace-pre-wrap">{item.answer_text}</p>
          {item.review_notes&&<p className="rounded-lg border p-2 whitespace-pre-wrap"><CheckCircle2 size={15} className="mr-1 inline"/>{item.review_notes}</p>}
        </div>)}
        <button type="button" className={secondary} onClick={()=>setMineTask(null)}>{t.back}</button>
      </div>
    </Modal>
    <Modal open={selectedTask!==null} title={t.view} onClose={()=>setSelectedTask(null)}>
      <div className="space-y-3">
        {selectedTask&&<strong className="block">{selectedTask.title}</strong>}
        <DataTable<Submission> rows={submissions} columns={submissionsColumns} label={t.view} manualMode/>
        {submissions.length===0&&<p className="app-muted text-xs">{t.noSubmissions}</p>}
        <div className="flex items-center justify-between gap-2 text-sm"><span className="app-muted">{t.page} {page+1}/{Math.max(1,Math.ceil(total/pageSize))}</span>
          <div className="flex gap-2"><button type="button" className={secondary} disabled={page===0} onClick={()=>setPage(v=>v-1)}>{t.previous}</button>
            <button type="button" className={secondary} disabled={(page+1)*pageSize>=total} onClick={()=>setPage(v=>v+1)}>{t.next}</button></div></div>
        <button type="button" className={secondary} onClick={()=>setSelectedTask(null)}>{t.back}</button>
      </div>
    </Modal>
    <Modal open={review!==null} title={t.review} onClose={()=>{if(!busy)setReview(null);}}>
      <form onSubmit={submitReview} className="space-y-3">
        <p className="app-muted text-sm">{review?.student_name} · {t.attemptNumber} {review?.attempt_number}</p>
        <p className="max-h-44 overflow-auto rounded-lg border p-3 text-sm whitespace-pre-wrap">{review?.answer_text}</p>
        <label className="block text-sm font-medium">{t.notes}<textarea rows={5} className={`${input} mt-1`} required minLength={2} maxLength={3000} value={reviewNotes} onChange={e=>setReviewNotes(e.target.value)}/></label>
        <p className="app-muted text-xs">{t.limits}</p>
        <div className="flex justify-end gap-2"><button type="button" className={secondary} disabled={busy} onClick={()=>setReview(null)}>{t.cancel}</button><button type="submit" className={primary} disabled={busy||reviewNotes.trim().length<2}>{t.saveReview}</button></div>
      </form>
    </Modal>
  </section>;
}

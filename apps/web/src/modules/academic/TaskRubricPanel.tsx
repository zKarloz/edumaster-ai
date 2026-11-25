/** CAMBIOS 22 v30.3 · Rúbrica reutilizada entre tarea y calificación.
 * El cliente muestra y valida el formulario; FastAPI comprueba todos los permisos,
 * máximos por criterio, matrícula, intento y unicidad de la nota oficial.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, BookOpenCheck, Plus, Save, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../components/shared/Modal';
import { Spinner } from '../../components/shared/Spinner';
import { useToast } from '../../components/shared/Toast';
import { normalizeLocale } from '../../i18n';

export interface RubricItem {
  id: string;
  position: number;
  title: string;
  description: string;
  max_points: number;
}
interface RubricResponse { items: RubricItem[]; total_points: number; can_edit: boolean; locked: boolean }
export interface GradeCriterion { criterion_id: string; title: string; points: string; max_points: string; comment: string }
export interface TaskGrade {
  id: string; submission_id: string; score: number; max_score: number;
  criteria: GradeCriterion[]; feedback: string; revision: number; graded_at: string;
}
const primary = 'app-primary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50';
const secondary = 'app-secondary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm disabled:opacity-50';
const field = 'app-input mt-1 w-full rounded-xl border px-3 py-2 text-sm';
const translations = {
  es: { rubric:'Rúbrica de evaluación', info:'Los puntos de cada criterio definen la ponderación dentro de esta tarea.',
    none:'Esta tarea todavía no tiene una rúbrica configurada.', edit:'Editar rúbrica', add:'Agregar criterio',
    criterion:'Criterio', description:'Descripción (opcional)', max:'Puntos máximos', total:'Puntaje total',
    save:'Guardar rúbrica', saved:'Rúbrica guardada.', cancel:'Cancelar', locked:'No se puede modificar una rúbrica con notas oficiales.',
    published:'Modificar la rúbrica cambiará los criterios publicados para los estudiantes. ¿Confirmas el cambio?',
    delete:'Eliminar criterio', grade:'Calificación oficial', notYet:'Esta tarea todavía no tiene una nota oficial.',
    studentNote:'La nota oficial aparecerá aquí cuando el docente califique la tarea.', feedback:'Retroalimentación',
    gradeInfo:'Una sola calificación oficial por tarea y estudiante, incorporada al promedio académico.',
    closeFirst:'Para emitir notas oficiales, primero cierra la tarea.', reviewFirst:'Guarda primero la revisión docente.',
    gradeCriteria:'Puntaje obtenido', criterionComment:'Observación del criterio (opcional)', gradeSave:'Guardar nota oficial',
    gradeCorrect:'Rectificar nota oficial', gradeSaved:'Calificación oficial registrada.', gradeUpdated:'Calificación corregida.',
    confirmGrade:'La calificación se incorporará al registro académico oficial. ¿Confirmas la operación?',
    confirmCorrect:'Se conservará la nota anterior en el historial de rectificaciones. ¿Confirmas la actualización?',
    unavailable:'Configura la rúbrica en la página de la tarea antes de calificar.', loading:'Cargando rúbrica...',
    error:'No se pudo cargar la evaluación.', retry:'Reintentar', version:'Revisión', reviewed:'La revisión docente ya está guardada.', previousAttempt:'Solo el último intento puede recibir una nota oficial.' },
  en: { rubric:'Grading rubric', info:'Criterion points define its weight within this assignment.',
    none:'No rubric has been configured.', edit:'Edit rubric', add:'Add criterion', criterion:'Criterion',
    description:'Description (optional)', max:'Maximum points', total:'Total points', save:'Save rubric',
    saved:'Rubric saved.', cancel:'Cancel', locked:'Rubrics with official grades cannot be edited.',
    published:'Changing this rubric updates the criteria students see. Confirm?', delete:'Remove criterion',
    grade:'Official grade', notYet:'No official grade has been issued yet.', studentNote:'Your official grade will appear here after grading.',
    feedback:'Feedback', gradeInfo:'One official grade per assignment and student, included in academic averages.',
    closeFirst:'Close the assignment before issuing official grades.', reviewFirst:'Save the teacher review first.',
    gradeCriteria:'Awarded points', criterionComment:'Criterion feedback (optional)', gradeSave:'Issue official grade',
    gradeCorrect:'Correct official grade', gradeSaved:'Official grade recorded.', gradeUpdated:'Official grade corrected.',
    confirmGrade:'This grade will be added to the official academic record. Confirm?',
    confirmCorrect:'The previous grade will be retained in the correction history. Confirm?',
    unavailable:'Configure the rubric on the assignment page before grading.', loading:'Loading rubric...',
    error:'Could not load grading data.', retry:'Retry', version:'Revision', reviewed:'Teacher review saved.', previousAttempt:'Only the latest attempt can receive an official grade.' },
  pt: { rubric:'Rubrica de avaliação', info:'Os pontos definem os pesos dos critérios nesta tarefa.',
    none:'Ainda não há rubrica nesta tarefa.', edit:'Editar rubrica', add:'Adicionar critério', criterion:'Critério',
    description:'Descrição (opcional)', max:'Pontos máximos', total:'Pontuação total', save:'Salvar rubrica',
    saved:'Rubrica salva.', cancel:'Cancelar', locked:'Não é possível alterar rubricas com notas oficiais.',
    published:'A alteração atualizará os critérios publicados para os estudantes. Confirmar?', delete:'Remover critério',
    grade:'Nota oficial', notYet:'Ainda não há nota oficial.', studentNote:'A nota oficial aparecerá após a avaliação.',
    feedback:'Comentários', gradeInfo:'Uma nota por tarefa e estudante, incluída na média acadêmica.',
    closeFirst:'Encerre a tarefa antes de emitir notas oficiais.', reviewFirst:'Salve primeiro a revisão docente.',
    gradeCriteria:'Pontos obtidos', criterionComment:'Comentário do critério (opcional)', gradeSave:'Salvar nota oficial',
    gradeCorrect:'Corrigir nota oficial', gradeSaved:'Nota oficial registrada.', gradeUpdated:'Nota corrigida.',
    confirmGrade:'A nota será registrada no histórico acadêmico oficial. Confirmar?',
    confirmCorrect:'A nota anterior ficará no histórico de correções. Confirmar?',
    unavailable:'Configure a rubrica na página da tarefa antes de avaliar.', loading:'Carregando rubrica...',
    error:'Não foi possível carregar a avaliação.', retry:'Tentar novamente', version:'Revisão', reviewed:'Revisão salva.', previousAttempt:'Somente a última tentativa pode receber uma nota oficial.' },
} as const;

/** Helper compartido de red; el token se usa solo en Authorization. */
export async function rubricRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const response = await fetch(`${base}${path}`, { ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers }, });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as {detail?: unknown};
    throw new Error(typeof payload.detail === 'string' ? payload.detail : `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

/** Párrafo reutilizable para calificación visible a estudiante y docente. */
export function OfficialGradeSummary({ grade }: { grade: TaskGrade }) {
  const { i18n } = useTranslation();
  const t = translations[normalizeLocale(i18n.language)];
  return <div className="app-task-grade-summary space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <strong className="text-lg">{t.grade}</strong>
      <strong className="text-xl tabular-nums">{grade.score} / {grade.max_score}</strong>
    </div>
    <div className="app-divider border-t pt-3 space-y-2 text-sm">
      {grade.criteria.map(item => <div key={item.criterion_id} className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="font-semibold">{item.title}</p>
          {item.comment && <p className="app-muted whitespace-pre-wrap">{item.comment}</p>}</div>
        <span className="shrink-0 tabular-nums">{item.points} / {item.max_points}</span>
      </div>)}
    </div>
    {grade.feedback && <div className="app-divider border-t pt-3 text-sm"><strong>{t.feedback}</strong>
      <p className="mt-1 whitespace-pre-wrap">{grade.feedback}</p></div>}
    <p className="app-muted text-xs">{t.version}: {grade.revision}</p>
  </div>;
}

interface RubricProps {root: string; taskId: string; token: string; editor: boolean; taskStatus: string; revision: number}
const emptyCriterion = (): RubricItem => ({ id: crypto.randomUUID(), position: 0, title: '', description: '', max_points: 1 });

export function TaskRubricPanel({ root, taskId, token, editor, taskStatus, revision }: RubricProps) {
  const { i18n } = useTranslation(); const t = translations[normalizeLocale(i18n.language)];
  const { notify } = useToast();
  const [rubric, setRubric] = useState<RubricResponse | null>(null);
  const [myGrade, setMyGrade] = useState<TaskGrade | null>(null);
  const [draft, setDraft] = useState<RubricItem[]>([]);
  const [editing, setEditing] = useState(false); const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [reload, setReload] = useState(0);
  const rubricPath = `${root}/${taskId}/rubric`;
  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const current = await rubricRequest<RubricResponse>(rubricPath, token, { signal });
      const grade = editor ? null : await rubricRequest<{ grade: TaskGrade | null }>(`${root}/${taskId}/my-grade`, token, { signal });
      if (!signal.aborted) {
        setRubric(current); setDraft(current.items); setMyGrade(grade?.grade ?? null); setEditing(false);
      }
    } catch (reason) { if (!signal.aborted) setError(reason instanceof Error ? reason.message : t.error); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [rubricPath, token, root, taskId, editor, t.error]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, revision, reload]);
  const editCriterion = (id: string, field: 'title' | 'description' | 'max_points', value: string) => {
    setDraft(old => old.map(item => item.id === id ? { ...item, [field]: field === 'max_points' ? Number(value) : value } : item));
  };
  const total = draft.reduce((sum, row) => sum + (Number.isFinite(row.max_points) ? row.max_points : 0), 0);
  const valid = draft.length >= 1 && draft.length <= 10 && total > 0 && total <= 100 &&
    draft.every(row => row.title.trim().length >= 2 && row.max_points > 0 && row.max_points <= 100);
  async function persist() {
    if (!valid || !rubric?.can_edit || busy) return;
    setBusy(true);
    try {
      await rubricRequest(rubricPath, token, { method:'PUT', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ items:draft.map(row => ({title:row.title.trim(),description:row.description.trim(),max_points:row.max_points})) }) });
      setConfirm(false); notify(t.saved, 'success'); setReload(value => value + 1);
    } catch (reason) { notify(reason instanceof Error ? reason.message : t.error); }
    finally { setBusy(false); }
  }
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (taskStatus !== 'draft' && (rubric?.items.length ?? 0) > 0) setConfirm(true);
    else void persist();
  };
  return <section className="app-panel space-y-4 rounded-2xl border p-5 sm:p-6" aria-label={t.rubric}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-lg font-bold"><BookOpenCheck size={19}/>{t.rubric}</h3>
      {!loading && rubric?.can_edit && !editing && <button type="button" className={secondary}
        onClick={() => { setDraft(rubric.items.length ? rubric.items : [emptyCriterion()]); setEditing(true); }}>{t.edit}</button>}
    </div>
    {loading && <Spinner label={t.loading}/>}
    {error && !loading && <div role="alert" className="app-warning rounded-xl border p-3 text-sm">{error}
      <button type="button" className={secondary} onClick={() => setReload(value => value + 1)}>{t.retry}</button></div>}
    {!loading && rubric && <>
      {editing && rubric.can_edit ? <form className="space-y-4" onSubmit={save}>
        <p className="app-muted text-sm">{t.info}</p>
        {draft.map((item, index) => <div className="app-task-form space-y-3 rounded-xl border p-4" key={item.id}>
          <div className="flex items-center justify-between"><strong>{t.criterion} {index + 1}</strong>
            <button type="button" disabled={draft.length <= 1} aria-label={t.delete} className={secondary}
              onClick={() => setDraft(old => old.filter(row => row.id !== item.id))}><Trash2 size={16}/></button></div>
          <label className="block text-sm font-semibold">{t.criterion}<input className={field} value={item.title} required minLength={2} maxLength={120}
            onChange={event => editCriterion(item.id, 'title', event.target.value)}/></label>
          <label className="block text-sm font-semibold">{t.description}<textarea className={field} rows={2} maxLength={500}
            value={item.description} onChange={event => editCriterion(item.id,'description',event.target.value)}/></label>
          <label className="block text-sm font-semibold">{t.max}<input className={field} type="number" step="0.01" min="0.01" max="100"
            required value={item.max_points} onChange={event => editCriterion(item.id,'max_points',event.target.value)}/></label>
        </div>)}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" className={secondary} disabled={draft.length >= 10} onClick={() => setDraft(old => [...old, emptyCriterion()])}><Plus size={16}/>{t.add}</button>
          <strong>{t.total}: {Number(total.toFixed(2))} / 100</strong>
        </div>
        <div className="app-divider flex flex-wrap justify-end gap-2 border-t pt-4">
          <button type="button" className={secondary} disabled={busy} onClick={() => setEditing(false)}>{t.cancel}</button>
          <button type="submit" className={primary} disabled={!valid || busy}><Save size={16}/>{t.save}</button>
        </div>
      </form> : <>
        {rubric.items.length === 0 ? <p className="app-muted text-sm">{t.none}</p> : <>
          <p className="app-muted text-sm">{t.info}</p>
          <div className="app-divider space-y-3 border-t pt-4">
            {rubric.items.map(item => <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
              <div><strong>{item.position}. {item.title}</strong>{item.description && <p className="app-muted whitespace-pre-wrap">{item.description}</p>}</div>
              <strong className="shrink-0 tabular-nums">{item.max_points} pts</strong>
            </div>)}
          </div>
          <p className="app-muted text-sm font-semibold">{t.total}: {rubric.total_points}</p>
        </>}
        {rubric.locked && editor && <p className="app-muted text-xs">{t.locked}</p>}
      </>}
      {!editor && <div className="app-divider border-t pt-4">
        {myGrade ? <OfficialGradeSummary grade={myGrade}/> : <p className="app-muted text-sm">{t.studentNote}</p>}
      </div>}
    </>}
    <Modal open={confirm} title={t.save} onClose={() => { if (!busy) setConfirm(false); }}>
      <div className="space-y-4">
        <p className="app-warning flex items-start gap-2 rounded-xl border p-3 text-sm"><AlertTriangle size={18} className="shrink-0"/>{t.published}</p>
        <div className="app-divider flex justify-end gap-2 border-t pt-4">
          <button className={secondary} type="button" disabled={busy} onClick={() => setConfirm(false)}>{t.cancel}</button>
          <button className={primary} type="button" disabled={busy} onClick={() => void persist()}>{t.save}</button>
        </div>
      </div>
    </Modal>
  </section>;
}

interface GradeProps { root: string; taskId: string; submissionId: string; token: string; status: string; reviewStatus: string; isLatest: boolean; revision: number }
export function TaskGradePanel({ root, taskId, submissionId, token, status, reviewStatus, isLatest, revision }: GradeProps) {
  const { i18n } = useTranslation(); const t = translations[normalizeLocale(i18n.language)]; const { notify } = useToast();
  const [rubric, setRubric] = useState<RubricResponse | null>(null);
  const [grade, setGrade] = useState<TaskGrade | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [confirm, setConfirm] = useState(false);
  const [reload, setReload] = useState(0);
  const endpoint = `${root}/${taskId}/submissions/${submissionId}/grade`;
  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const [rubricData, gradeData] = await Promise.all([
        rubricRequest<RubricResponse>(`${root}/${taskId}/rubric`, token, { signal }),
        rubricRequest<{ grade: TaskGrade | null }>(endpoint, token, { signal }),
      ]);
      if (!signal.aborted) {
        setRubric(rubricData); setGrade(gradeData.grade);
        setScores(Object.fromEntries(rubricData.items.map(item => [item.id, String(gradeData.grade?.criteria.find(row => row.criterion_id === item.id)?.points ?? '0')])));
        setComments(Object.fromEntries(rubricData.items.map(item => [item.id, gradeData.grade?.criteria.find(row => row.criterion_id === item.id)?.comment ?? ''])));
        setFeedback(gradeData.grade?.feedback ?? '');
      }
    } catch (reason) { if (!signal.aborted) setError(reason instanceof Error ? reason.message : t.error); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [root, taskId, endpoint, token, t.error]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, revision, reload]);
  const complete = rubric?.items.length && rubric.items.every(item => {
    const value = scores[item.id];
    return value !== undefined && value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= item.max_points;
  });
  const total = rubric?.items.reduce((sum, item) => sum + (Number(scores[item.id]) || 0), 0) ?? 0;
  async function persist() {
    if (!complete || busy || !rubric) return;
    setBusy(true);
    try {
      await rubricRequest(endpoint, token, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
        expected_revision:grade?.revision ?? 0, feedback:feedback.trim(),
        criteria:rubric.items.map(item => ({criterion_id:item.id,points:Number(scores[item.id]),comment:comments[item.id] ?? ''})),
      })});
      notify(grade ? t.gradeUpdated : t.gradeSaved, 'success'); setConfirm(false); setReload(value => value + 1);
    } catch (reason) { notify(reason instanceof Error ? reason.message : t.error); }
    finally { setBusy(false); }
  }
  return <section id="calificacion-oficial" className="app-panel scroll-mt-28 space-y-4 rounded-2xl border p-5 sm:p-6" aria-label={t.grade}>
    <h3 className="flex items-center gap-2 text-lg font-bold"><BookOpenCheck size={19}/>{t.grade}</h3>
    {loading && <Spinner label={t.loading}/>}
    {error && !loading && <div className="app-warning rounded-xl border p-3 text-sm" role="alert">{error}
      <button className={secondary} type="button" onClick={() => setReload(value => value + 1)}>{t.retry}</button></div>}
    {!loading && rubric && <>
      {grade && <OfficialGradeSummary grade={grade}/>}
      {!rubric.items.length && <p className="app-muted text-sm">{t.unavailable}</p>}
      {rubric.items.length > 0 && status !== 'closed' && <p className="app-muted text-sm">{t.closeFirst}</p>}
      {rubric.items.length > 0 && status === 'closed' && !isLatest && <p className="app-muted text-sm">{t.previousAttempt}</p>}
      {rubric.items.length > 0 && status === 'closed' && isLatest && reviewStatus !== 'reviewed' && <p className="app-muted text-sm">{t.reviewFirst}</p>}
      {rubric.items.length > 0 && status === 'closed' && isLatest && reviewStatus === 'reviewed' && <form className="space-y-4" onSubmit={event => {event.preventDefault();setConfirm(true);}}>
        <p className="app-muted text-sm">{t.gradeInfo}</p>
        {rubric.items.map(item => <div className="app-task-form space-y-3 rounded-xl border p-4" key={item.id}>
          <div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{item.title}</strong><span className="app-muted">{t.max}: {item.max_points}</span></div>
          {item.description && <p className="app-muted text-xs">{item.description}</p>}
          <label className="block text-sm font-semibold">{t.gradeCriteria}<input type="number" className={field} required min="0" max={item.max_points} step="0.01"
            value={scores[item.id] ?? '0'} onChange={event => setScores(old => ({...old,[item.id]:event.target.value}))}/></label>
          <label className="block text-sm font-semibold">{t.criterionComment}<textarea className={field} maxLength={500} rows={2}
            value={comments[item.id] ?? ''} onChange={event => setComments(old => ({...old,[item.id]:event.target.value}))}/></label>
        </div>)}
        <div className="flex flex-wrap justify-between gap-3"><strong>{t.total}: {Number(total.toFixed(2))} / {rubric.total_points}</strong></div>
        <label className="block text-sm font-semibold">{t.feedback}<textarea className={field} rows={4} maxLength={3000}
          value={feedback} onChange={event => setFeedback(event.target.value)}/></label>
        <button type="submit" className={primary} disabled={!complete || busy}><Save size={16}/>{grade ? t.gradeCorrect : t.gradeSave}</button>
      </form>}
    </>}
    <Modal open={confirm} title={grade ? t.gradeCorrect : t.gradeSave} onClose={() => {if(!busy)setConfirm(false);}}>
      <div className="space-y-4">
        <p className="app-warning flex items-start gap-2 rounded-xl border p-3 text-sm"><AlertTriangle size={18} className="shrink-0"/>{grade ? t.confirmCorrect : t.confirmGrade}</p>
        <p className="font-semibold tabular-nums">{t.total}: {Number(total.toFixed(2))} / {rubric?.total_points ?? 0}</p>
        <div className="app-divider flex justify-end gap-2 border-t pt-4">
          <button className={secondary} type="button" disabled={busy} onClick={() => setConfirm(false)}>{t.cancel}</button>
          <button className={primary} type="button" disabled={busy || !complete} onClick={() => void persist()}>{grade ? t.gradeCorrect : t.gradeSave}</button>
        </div>
      </div>
    </Modal>
  </section>;
}

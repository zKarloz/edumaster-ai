// EduMaster.ai v16: actividad académica real con permisos por oferta.
// Este módulo registra evidencias; no calcula predicciones ni recomendaciones automáticas.
import { useEffect, useState, type FormEvent } from 'react';
import { Activity, BookOpen, ClipboardCheck, GraduationCap, Plus, RefreshCcw, Save, Trash2, UserRound } from 'lucide-react';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { Modal } from '../../components/shared/Modal';
import { OptionSelect } from '../../components/shared/OptionSelect';
import { Spinner } from '../../components/shared/Spinner';
import { useToast } from '../../components/shared/Toast';
import type { Organization } from '../organizations/types';

type Kind = 'grade' | 'attendance' | 'participation' | 'progress';
type RecordKind = Exclude<Kind, 'progress'>;
interface Offering {
  id: string; course_title: string; course_code: string; period: string;
  status: string; instructor_id: string | null; instructor_name: string | null;
  active_enrollments: number;
}
interface EnrollmentSummary {
  enrollment_id: string; student_id: string; student_name: string;
  student_email: string; status: string; completion_percent: number | string;
  grade_count: number; grade_average_percent: number | string | null;
  attendance_count: number; attendance_percent: number | string | null;
  participation_average: number | string | null;
}
interface AcademicRecord {
  id: string; enrollment_id: string; kind: RecordKind; title: string;
  activity_date: string; score: number | string | null; max_score: number | string | null;
  attendance_status: string | null; participation_rating: number | null;
  notes: string | null; student_name: string; recorded_at: string;
}
interface Instructor { id: string; name: string }
interface Props {
  organizations: Organization[];
  organizationId: string;
  onOrganizationChange: (value: string) => void;
  token: string;
}
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const btn = 'app-primary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';
const secondary = 'app-secondary-button inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm disabled:opacity-40';
const input = 'app-input w-full rounded-xl border px-3 py-2.5 text-sm';
const labels: Record<Kind, string> = { grade: 'Calificación', attendance: 'Asistencia', participation: 'Participación', progress: 'Progreso' };
const states: Record<string, string> = { active: 'Activa', completed: 'Completada', withdrawn: 'Retirada', present: 'Presente', absent: 'Ausente', late: 'Tardanza', excused: 'Justificada' };
const formatNumber = (value: number | string | null | undefined, suffix = ''): string =>
  value === null || value === undefined ? '—' : `${Number(value).toLocaleString('es-PE', { maximumFractionDigits: 2 })}${suffix}`;
function localDate(): string {
  const day = new Date();
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

/** No se utiliza ninguna clave de servicio: cada petición lleva el JWT del usuario. */
async function api<T>(path: string, token: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method, signal, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('No se pudo conectar con FastAPI. Comprueba que Render esté disponible.');
  }
  if (!res.ok) {
    const data: { detail?: string | Array<{ msg?: string }> } = await res.json().catch(() => ({}));
    const detail = typeof data.detail === 'string' ? data.detail : Array.isArray(data.detail)
      ? data.detail.map(item => item.msg || '').join('; ') : 'No se pudo completar la solicitud';
    throw new Error(`${detail} (HTTP ${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function AcademicActivityPage({ organizations, organizationId, onOrganizationChange, token }: Props) {
  const { notify } = useToast();
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringId, setOfferingId] = useState('');
  const [manager, setManager] = useState(false);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [assignment, setAssignment] = useState('');
  const [overview, setOverview] = useState<EnrollmentSummary[]>([]);
  const [records, setRecords] = useState<AcademicRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<Kind | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<AcademicRecord | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [title, setTitle] = useState('');
  const [activityDate, setActivityDate] = useState(localDate);
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('20');
  const [attendance, setAttendance] = useState('present');
  const [participation, setParticipation] = useState('3');
  const [progress, setProgress] = useState('0');
  const [notes, setNotes] = useState('');
  const root = `/api/v1/academic/organizations/${organizationId}`;
  const selectedOffering = offerings.find(row => row.id === offeringId);
  const activeEnrollments = overview.filter(row => row.status === 'active');

  // La institución es compartida con Cursos, Estudiantes y Matrículas.
  useEffect(() => {
    const first = organizations[0];
    if (!first) return;
    if (!organizations.some(row => row.id === organizationId)) onOrganizationChange(first.id);
  }, [organizations, organizationId, onOrganizationChange]);

  useEffect(() => {
    setOfferings([]); setOverview([]); setRecords([]); setInstructors([]);
    if (!organizationId) return;
    const controller = new AbortController();
    setError(''); setLoading(true);
    void api<{ items: Offering[]; can_manage: boolean }>(`${root}/activity/offerings`, token, 'GET', undefined, controller.signal)
      .then(async data => {
        if (controller.signal.aborted) return;
        setOfferings(data.items); setManager(data.can_manage);
        setOfferingId(current => data.items.some(item => item.id === current) ? current : (data.items[0]?.id || ''));
        if (data.can_manage) {
          const list = await api<{ items: Instructor[] }>(`${root}/instructors`, token, 'GET', undefined, controller.signal);
          if (!controller.signal.aborted) setInstructors(list.items);
        }
      })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Error al cargar ofertas'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // La lista de ofertas solo depende de la institución y del refresco explícito.
  }, [organizationId, root, token, refresh]);

  useEffect(() => {
    setOverview([]); setRecords([]);
    if (!offeringId) return;
    const controller = new AbortController();
    setLoadingRecords(true); setError('');
    const base = `${root}/activity/offerings/${offeringId}`;
    void Promise.all([
      api<{ items: EnrollmentSummary[] }>(`${base}/overview`, token, 'GET', undefined, controller.signal),
      api<{ items: AcademicRecord[] }>(`${base}/records`, token, 'GET', undefined, controller.signal),
    ]).then(([summary, evidence]) => {
      if (!controller.signal.aborted) { setOverview(summary.items); setRecords(evidence.items); }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo consultar la actividad');
    }).finally(() => { if (!controller.signal.aborted) setLoadingRecords(false); });
    return () => controller.abort();
  }, [offeringId, root, token, refresh]);

  useEffect(() => { setAssignment(selectedOffering?.instructor_id || ''); }, [selectedOffering?.instructor_id]);

  function open(kind: Kind, enrollmentId = '') {
    const student = activeEnrollments.find(row => row.enrollment_id === enrollmentId);
    setSelectedStudent(student?.enrollment_id || activeEnrollments[0]?.enrollment_id || '');
    setProgress(student ? String(student.completion_percent) : '0');
    setTitle(kind === 'grade' ? 'Evaluación' : kind === 'attendance' ? 'Sesión académica' : 'Participación en clase');
    setActivityDate(localDate()); setScore(''); setMaxScore('20');
    setAttendance('present'); setParticipation('3'); setNotes(''); setError(''); setModal(kind);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || !selectedStudent || !offeringId) return;
    const base = `${root}/activity/offerings/${offeringId}`;
    const body = modal === 'progress'
      ? { enrollment_id: selectedStudent, completion_percent: Number(progress) }
      : { enrollment_id: selectedStudent, kind: modal, title, activity_date: activityDate,
          score: modal === 'grade' ? Number(score) : null, max_score: modal === 'grade' ? Number(maxScore) : null,
          attendance_status: modal === 'attendance' ? attendance : null,
          participation_rating: modal === 'participation' ? Number(participation) : null,
          notes: notes.trim() || null };
    setBusy(true); setError('');
    try {
      await api(base + (modal === 'progress' ? '/progress' : '/records'), token, modal === 'progress' ? 'PUT' : 'POST', body);
      notify(`${labels[modal]} registrada correctamente.`, 'success');
      setModal(null); setRefresh(current => current + 1);
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar'); }
    finally { setBusy(false); }
  }

  async function assignInstructor() {
    if (!offeringId || !manager) return;
    setBusy(true); setError('');
    try {
      await api(`${root}/offerings/${offeringId}/instructor`, token, 'PUT', { instructor_id: assignment || null });
      notify('Asignación docente actualizada.', 'success');
      setRefresh(current => current + 1);
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'No se pudo asignar el docente'); }
    finally { setBusy(false); }
  }

  async function voidRecord() {
    if (!deleteRecord || !offeringId) return;
    setBusy(true); setError('');
    try {
      await api(`${root}/activity/offerings/${offeringId}/records/${deleteRecord.id}`, token, 'DELETE');
      notify('Registro anulado; conservamos su historial para auditoría.', 'success');
      setDeleteRecord(null); setRefresh(current => current + 1);
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'No se pudo anular el registro'); }
    finally { setBusy(false); }
  }

  const active = overview.filter(row => row.status === 'active').length;
  const withGrades = overview.filter(row => row.grade_count > 0).length;
  const columns: Column<EnrollmentSummary>[] = [
    { header: 'Estudiante', key: 'student_name' },
    { header: 'Estado', key: 'status', render: row => states[row.status] || row.status },
    { header: 'Prom. notas', key: 'grade_average_percent', render: row => formatNumber(row.grade_average_percent, '%') },
    { header: 'Asistencia', key: 'attendance_percent', render: row => formatNumber(row.attendance_percent, '%') },
    { header: 'Participación', key: 'participation_average', render: row => formatNumber(row.participation_average, '/5') },
    { header: 'Progreso', key: 'completion_percent', render: row => <div className="flex min-w-28 items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600"><div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.max(0, Math.min(100, Number(row.completion_percent)))}%` }}/></div>{formatNumber(row.completion_percent, '%')}</div> },
    { header: 'Acción', key: 'enrollment_id', render: row => row.status === 'active'
      ? <button type="button" className={secondary} onClick={() => open('grade', row.enrollment_id)} aria-label={`Registrar nota de ${row.student_name}`}><Plus size={14}/> Nota</button> : '—' },
  ];
  const recordColumns: Column<AcademicRecord>[] = [
    { header: 'Fecha', key: 'activity_date' },
    { header: 'Estudiante', key: 'student_name' },
    { header: 'Actividad', key: 'kind', render: row => `${labels[row.kind]} · ${row.title}` },
    { header: 'Valor', key: 'score', render: row => row.kind === 'grade' ? `${formatNumber(row.score)} / ${formatNumber(row.max_score)}`
      : row.kind === 'attendance' ? states[row.attendance_status || ''] || row.attendance_status
        : `${row.participation_rating}/5` },
    { header: 'Acciones', key: 'id', render: row => <button type="button" className={secondary}
      onClick={() => { setError(''); setDeleteRecord(row); }} title="Anular registro" aria-label={`Anular registro ${row.title}`}><Trash2 size={15}/></button> },
  ];

  return <div className="space-y-5">
    <div className="app-panel rounded-2xl border p-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-56 flex-1 space-y-2 sm:max-w-md">
          <label className="flex items-center gap-2 text-sm font-semibold"><GraduationCap size={18}/> Institución académica</label>
          <OptionSelect ariaLabel="Institución para actividad académica" value={organizationId} onChange={onOrganizationChange}
            options={organizations.map(org => ({ value: org.id, label: org.name, suffix: org.code }))} placeholder="Selecciona una institución"/>
        </div>
        <button type="button" className={secondary} disabled={!organizationId || loading} onClick={() => setRefresh(x => x + 1)}><RefreshCcw size={16}/> Actualizar</button>
      </div>
    </div>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold"><Activity size={20}/> Actividad académica</h2>
        <p className="app-muted mt-1 text-sm">Calificaciones, asistencia, participación y avance basados en registros reales.</p></div>
    </div>
    {loading && <Spinner label="Buscando ofertas académicas autorizadas..."/>}
    {!loading && offerings.length === 0 && !error && <p className="app-info rounded-xl border p-4 text-sm">No hay ofertas asignadas. El administrador institucional puede asignar docentes y matricular estudiantes desde Matrículas.</p>}
    {offerings.length > 0 && <div className="app-panel space-y-4 rounded-2xl border p-5">
      <div className="space-y-2"><label className="flex items-center gap-2 text-sm font-semibold"><BookOpen size={17}/> Curso y período</label>
        <OptionSelect ariaLabel="Oferta académica" value={offeringId} onChange={setOfferingId} options={offerings.map(row => ({
          value: row.id, label: row.course_title, suffix: `${row.period} · ${row.active_enrollments} activos`,
        }))}/></div>
      {selectedOffering && <div className="app-muted text-sm">{selectedOffering.course_code} · {selectedOffering.period} · Docente: {selectedOffering.instructor_name || 'Sin asignar'}</div>}
      {manager && selectedOffering && <div className="app-divider flex flex-wrap items-end gap-3 border-t pt-4">
        <div className="min-w-52 flex-1 space-y-2"><label className="flex items-center gap-2 text-sm font-medium"><UserRound size={16}/> Docente responsable</label>
          <OptionSelect ariaLabel="Asignar docente" value={assignment} onChange={setAssignment} placeholder="Sin docente asignado"
            options={[{ value: '', label: 'Sin docente asignado' }, ...instructors.map(row => ({ value: row.id, label: row.name }))]}/></div>
        <button className={secondary} type="button" onClick={() => void assignInstructor()} disabled={busy || assignment === (selectedOffering.instructor_id || '')}><Save size={16}/> Guardar asignación</button>
        {instructors.length === 0 && <p className="app-muted basis-full text-xs">Para asignar docentes, dales el rol Docente desde el módulo Usuarios de esta institución.</p>}
      </div>}
    </div>}
    {error && <p role="alert" className="app-warning rounded-xl border p-3 text-sm">{error}</p>}
    {offeringId && <>
      {loadingRecords && <Spinner label="Consultando las evidencias académicas..."/>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="app-panel rounded-2xl border p-4"><p className="app-muted text-xs">Matrículas activas</p><p className="mt-1 text-2xl font-semibold">{active}</p></div>
        <div className="app-panel rounded-2xl border p-4"><p className="app-muted text-xs">Estudiantes con notas</p><p className="mt-1 text-2xl font-semibold">{withGrades}</p></div>
        <div className="app-panel rounded-2xl border p-4"><p className="app-muted text-xs">Evidencias registradas</p><p className="mt-1 text-2xl font-semibold">{records.length}</p></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold"><ClipboardCheck size={19}/> Seguimiento por matrícula</h3>
        <div className="flex flex-wrap gap-2">
          {(['grade', 'attendance', 'participation', 'progress'] as const).map(kind => <button key={kind} className={secondary}
            type="button" disabled={activeEnrollments.length === 0} onClick={() => open(kind)}><Plus size={14}/>{labels[kind]}</button>)}
        </div>
      </div>
      <DataTable<EnrollmentSummary> rows={overview} columns={columns} label="Estudiantes de la oferta" pageSize={8}/>
      <DataTable<AcademicRecord> rows={records} columns={recordColumns} label="Historial de evidencias (últimos 500 registros)" pageSize={8}/>
      {records.length > 0 && <p className="app-muted text-xs">Las notas se presentan como porcentaje del puntaje máximo. La asistencia cuenta presentes y tardanzas sobre sesiones no justificadas. La participación se expresa de 1 a 5; no son predicciones de IA.</p>}
    </>}
    <Modal open={modal !== null} title={`Registrar ${modal ? labels[modal].toLowerCase() : 'actividad'}`} onClose={() => { if (!busy) { setModal(null); setError(''); } }}>
      <form className="space-y-4" onSubmit={event => void save(event)}>
        <div className="space-y-1.5"><label className="text-sm font-medium">Estudiante matriculado</label>
          <OptionSelect ariaLabel="Seleccionar matrícula" value={selectedStudent} onChange={id => { setSelectedStudent(id); const selected = activeEnrollments.find(row => row.enrollment_id === id); if (selected) setProgress(String(selected.completion_percent)); }}
            options={activeEnrollments.map(row => ({ value: row.enrollment_id, label: row.student_name }))}/></div>
        {modal !== 'progress' && <>
          <label className="flex flex-col gap-1.5 text-sm font-medium">Actividad<input className={input} required minLength={2} maxLength={120} value={title} onChange={event => setTitle(event.target.value)}/></label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">Fecha<input className={input} type="date" required value={activityDate} onChange={event => setActivityDate(event.target.value)}/></label>
        </>}
        {modal === 'grade' && <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">Nota obtenida<input className={input} type="number" required step="0.01" min="0" max={maxScore || undefined} value={score} onChange={e => setScore(e.target.value)}/></label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">Nota máxima<input className={input} type="number" required step="0.01" min="0.01" value={maxScore} onChange={e => setMaxScore(e.target.value)}/></label>
        </div>}
        {modal === 'attendance' && <div className="space-y-1.5"><label className="text-sm font-medium">Asistencia</label>
          <OptionSelect ariaLabel="Estado de asistencia" value={attendance} onChange={setAttendance} options={[
            { value: 'present', label: 'Presente' }, { value: 'late', label: 'Tardanza' },
            { value: 'absent', label: 'Ausente' }, { value: 'excused', label: 'Justificada' },
          ]}/></div>}
        {modal === 'participation' && <div className="space-y-1.5"><label className="text-sm font-medium">Participación</label>
          <OptionSelect ariaLabel="Valoración de participación" value={participation} onChange={setParticipation}
            options={[1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `${n} / 5` }))}/></div>}
        {modal === 'progress' && <label className="flex flex-col gap-1.5 text-sm font-medium">Avance del curso (0–100 %)
          <input className={input} type="number" required min="0" max="100" step="0.01" value={progress} onChange={event => setProgress(event.target.value)}/></label>}
        {modal !== 'progress' && <label className="flex flex-col gap-1.5 text-sm font-medium">Observaciones (opcional)
          <textarea className={input} maxLength={500} rows={3} value={notes} onChange={event => setNotes(event.target.value)}/></label>}
        {error && <p role="alert" className="app-warning rounded-xl border p-3 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2"><button type="button" className={secondary} disabled={busy} onClick={() => { setModal(null); setError(''); }}>Cancelar</button>
          <button type="submit" className={btn} disabled={busy || !selectedStudent}>{busy ? 'Guardando…' : 'Guardar evidencia'}</button></div>
      </form>
    </Modal>
    <Modal open={deleteRecord !== null} title="Anular evidencia" onClose={() => { if (!busy) { setDeleteRecord(null); setError(''); } }}>
      <div className="space-y-4"><p className="text-sm">¿Anular la evidencia «{deleteRecord?.title}»? No se borrará físicamente; la auditoría conservará esta operación.</p>
        {error && <p role="alert" className="app-warning rounded-xl border p-3 text-sm">{error}</p>}
        <div className="flex justify-end gap-2"><button className={secondary} disabled={busy} onClick={() => { setDeleteRecord(null); setError(''); }}>Cancelar</button>
          <button className={btn} disabled={busy} onClick={() => void voidRecord()}>Confirmar anulación</button></div></div>
    </Modal>
  </div>;
}

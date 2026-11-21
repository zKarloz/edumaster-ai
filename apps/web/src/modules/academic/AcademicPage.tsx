// Incremento académico real: todas las operaciones via FastAPI con JWT.
// Se reutilizan el modal, el selector con scroll y la tabla paginada del proyecto.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { BookOpen, GraduationCap, Plus, RefreshCcw, UsersRound, School, Info } from 'lucide-react';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { Modal } from '../../components/shared/Modal';
import { OptionSelect } from '../../components/shared/OptionSelect';
import { Spinner } from '../../components/shared/Spinner';
import { useToast } from '../../components/shared/Toast';
import type { Organization } from '../organizations/types';

export type AcademicSection = 'courses' | 'students' | 'enrollments';
interface Course {
  id: string; code: string; title: string; description: string | null;
  level: string | null; status: 'draft' | 'published';
  offering_id: string | null; period: string | null;
  offering_status: string | null; enrolled_count: number;
}
interface Student {
  id: string; full_name: string; email: string;
  external_code: string | null; status: string; enrollment_count: number;
}
interface Enrollment {
  id: string; offering_id: string; student_id: string; status: string;
  student_name: string; student_email: string;
  course_title: string; course_code: string; period: string;
}
interface Props {
  mode: AcademicSection;
  organizations: Organization[];
  organizationId: string;
  onOrganizationChange: (value: string) => void;
  canManageOrganization: (organizationId: string) => boolean;
  token: string;
}
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const inputClass = 'app-input min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-[#345578] dark:bg-[#112A48]';
const mainButton = 'app-primary-button inline-flex items-center justify-center gap-2 rounded-xl bg-[#087FE5] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60';
const secondaryButton = 'app-secondary-button inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-[#345578]';
const titleFor = { courses: 'Cursos', students: 'Estudiantes', enrollments: 'Matrículas' };
const courseColumns: Column<Course>[] = [
  { header: 'Código', key: 'code' }, { header: 'Curso', key: 'title' },
  { header: 'Período', key: 'period' },
  { header: 'Estado', key: 'status', render: row => row.status === 'published' ? 'Publicado' : 'Borrador' },
  { header: 'Matrículas', key: 'enrolled_count' },
];
const studentColumns: Column<Student>[] = [
  { header: 'Estudiante', key: 'full_name' }, { header: 'Correo', key: 'email' },
  { header: 'Código académico', key: 'external_code' },
  { header: 'Matrículas', key: 'enrollment_count' },
];
const enrollmentColumns: Column<Enrollment>[] = [
  { header: 'Estudiante', key: 'student_name' }, { header: 'Curso', key: 'course_title' },
  { header: 'Período', key: 'period' }, { header: 'Estado', key: 'status' },
];

async function request<T>(path: string, token: string, signal?: AbortSignal, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      method: body === undefined ? 'GET' : 'POST', signal,
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('No se pudo conectar con FastAPI. Revisa el servidor y la terminal de errores.');
  }
  if (!response.ok) {
    const payload: { detail?: string | Array<{ msg?: string }> } = await response.json().catch(() => ({}));
    const detail = typeof payload.detail === 'string' ? payload.detail : Array.isArray(payload.detail)
      ? payload.detail.map(item => item.msg).join('; ') : 'Error al procesar la solicitud.';
    throw new Error(`${detail} (HTTP ${response.status})`);
  }
  return response.json() as Promise<T>;
}

type Dialog = 'course' | 'student' | 'enrollment' | null;

/** Campos reutilizados visualmente, con la separación definida para el proyecto. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="app-form-field flex flex-col gap-1.5 text-sm font-medium">
    <span>{label}</span>{children}
  </label>;
}

export function AcademicPage({ mode, organizations, organizationId, onOrganizationChange, canManageOrganization, token }: Props) {
  const { notify } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  // Evita mostrar avisos de "sin datos" antes de terminar la primera consulta.
  const [loadedOrganizationId, setLoadedOrganizationId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [refresh, setRefresh] = useState(0);
  const [code, setCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('');
  const [period, setPeriod] = useState('2026-II');
  const [courseStatus, setCourseStatus] = useState('published');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [externalCode, setExternalCode] = useState('');
  const [offering, setOffering] = useState('');
  const [studentId, setStudentId] = useState('');
  const manager = Boolean(organizationId && canManageOrganization(organizationId));

  // `noUncheckedIndexedAccess` considera que organizations[0] puede ser undefined.
  // Comprobamos explícitamente la primera institución antes de acceder a su id.
  useEffect(() => {
    const firstOrganization = organizations[0];
    if (!firstOrganization) {
      if (organizationId) onOrganizationChange('');
      return;
    }
    // No seleccionamos una institución fuera del conjunto autorizado por FastAPI.
    if (!organizations.some(item => item.id === organizationId)) {
      onOrganizationChange(firstOrganization.id);
    }
  }, [organizations, organizationId, onOrganizationChange]);

  useEffect(() => {
    setCourses([]); setStudents([]); setEnrollments([]); setError('');
    setLoadedOrganizationId(null);
    if (!organizationId || !organizations.some(org => org.id === organizationId)) return;
    const controller = new AbortController();
    const root = `/api/v1/academic/organizations/${organizationId}`;
    setLoading(true);
    // El directorio nominal solo se pide si el usuario tiene permisos de gestión.
    const calls: Promise<unknown>[] = [request<{ items: Course[] }>(`${root}/courses`, token, controller.signal)];
    if (manager) {
      calls.push(request<{ items: Student[] }>(`${root}/students`, token, controller.signal));
      calls.push(request<{ items: Enrollment[] }>(`${root}/enrollments`, token, controller.signal));
    }
    void Promise.all(calls).then(results => {
      if (controller.signal.aborted) return;
      setCourses((results[0] as { items: Course[] }).items);
      if (manager) {
        setStudents((results[1] as { items: Student[] }).items);
        setEnrollments((results[2] as { items: Enrollment[] }).items);
      }
      setLoadedOrganizationId(organizationId);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Error al consultar el módulo académico');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [organizationId, organizations, token, manager, refresh]);

  function begin(next: Exclude<Dialog, null>) {
    setError(''); setCode(''); setCourseName(''); setDescription(''); setLevel('');
    setPeriod('2026-II'); setCourseStatus('published'); setEmail(''); setFullName('');
    setExternalCode(''); setOffering(''); setStudentId(''); setDialog(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog || !organizationId || !manager) return;
    const body = dialog === 'course'
      ? { code: code.toLowerCase().trim(), title: courseName, description: description || null,
          level: level || null, period, status: courseStatus }
      : dialog === 'student'
        ? { email, full_name: fullName, external_code: externalCode || null }
        : { offering_id: offering, student_id: studentId };
    setBusy(true); setError('');
    try {
      await request(`/api/v1/academic/organizations/${organizationId}/${dialog === 'course' ? 'courses' : dialog === 'student' ? 'students' : 'enrollments'}`,
        token, undefined, body);
      notify(dialog === 'course' ? 'Curso registrado correctamente.' : dialog === 'student'
        ? 'Estudiante incorporado correctamente.' : 'Matrícula registrada correctamente.', 'success');
      setDialog(null);
      setRefresh(count => count + 1);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el registro');
    } finally { setBusy(false); }
  }

  const activeCourses = courses.filter(item => item.status === 'published' && item.offering_status === 'open' && item.offering_id);
  // Solo un estudiante activo puede matricularse: contar inactivos habilitaba por error el botón.
  const activeStudents = students.filter(item => item.status === 'active');
  const icon = mode === 'courses' ? <BookOpen size={21}/> : mode === 'students' ? <GraduationCap size={21}/> : <UsersRound size={21}/>;
  return <div className="space-y-5">
    <div className="app-panel flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#23456A] dark:bg-[#0A1F3D]">
      <div className="min-w-[220px] flex-1 space-y-2 sm:max-w-md">
        <p className="flex items-center gap-2 font-semibold"> <School size={18}/> Institución académica</p>
        <OptionSelect ariaLabel="Seleccionar institución académica" value={organizationId}
          onChange={onOrganizationChange} options={organizations.map(org => ({ value: org.id, label: org.name, suffix: org.code }))}
          placeholder="Selecciona una institución"/>
      </div>
      <button type="button" onClick={() => setRefresh(count => count + 1)} className={secondaryButton} disabled={!organizationId}>
        <RefreshCcw size={16}/> Actualizar
      </button>
    </div>
    {organizations.length === 0 && <p className="app-warning rounded-xl border p-4 text-sm">Primero registra una institución en el módulo Instituciones.</p>}
    {organizationId && <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">{icon}{titleFor[mode]}</h3>
          <p className="app-muted mt-1 text-sm">{mode === 'courses'
            ? 'Cursos y períodos académicos de la institución seleccionada.'
            : mode === 'students' ? 'Cuentas académicas verificadas y asociadas a esta institución.'
              : 'Inscripciones en ofertas abiertas de la misma institución.'}</p>
        </div>
        {manager && <button type="button" onClick={() => begin(mode === 'courses' ? 'course' : mode === 'students' ? 'student' : 'enrollment')}
          disabled={mode === 'enrollments' && (!activeStudents.length || !activeCourses.length)} className={mainButton}>
          <Plus size={17}/>{mode === 'courses' ? 'Nuevo curso' : mode === 'students' ? 'Incorporar estudiante' : 'Nueva matrícula'}
        </button>}
      </div>
      {loading && <Spinner label="Cargando datos académicos..."/>}
      {error && !dialog && <p role="alert" className="app-warning rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
      {mode === 'courses' && <DataTable<Course> key={organizationId} rows={courses} columns={courseColumns} label="Catálogo de cursos" pageSize={8}/>}
      {mode === 'students' && manager && <DataTable<Student> key={organizationId} rows={students} columns={studentColumns} label="Estudiantes vinculados" pageSize={8}/>}
      {mode === 'enrollments' && manager && <DataTable<Enrollment> key={organizationId} rows={enrollments} columns={enrollmentColumns} label="Matrículas registradas" pageSize={8}/>}
      {mode !== 'courses' && !manager && <p role="status" className="app-panel rounded-xl border p-5 text-sm">El directorio de estudiantes y las matrículas requieren permisos de administración institucional.</p>}
      {/* Guía informativa (azul suave en Claro/Oscuro, gris en Negro):
          aparece mientras la institución no tenga estudiantes. No es una alerta de error. */}
      {mode === 'students' && manager && !loading && !error && loadedOrganizationId === organizationId && students.length === 0 &&
        <p role="status" className="app-info flex items-start gap-2 rounded-xl border p-4 text-sm">
          <Info size={18} aria-hidden="true" className="mt-0.5 shrink-0"/>
          <span>Antes de incorporar un estudiante, crea su cuenta y confirma su correo en Supabase Authentication → Users. Este formulario no crea credenciales de acceso.</span>
        </p>}
      {/* Aviso de requisito pendiente: desaparece al existir estudiantes activos y ofertas abiertas. */}
      {mode === 'enrollments' && manager && !loading && !error && loadedOrganizationId === organizationId && (!activeStudents.length || !activeCourses.length) &&
        <p role="status" className="app-warning rounded-xl border p-4 text-sm">
          Para matricular necesitas al menos un estudiante activo y un curso publicado con oferta abierta.
        </p>}
    </>}

    <Modal open={dialog !== null} title={dialog === 'course' ? 'Registrar curso' : dialog === 'student' ? 'Incorporar estudiante' : 'Matricular estudiante'}
      onClose={() => { if (!busy) { setDialog(null); setError(''); } }}>
      <form className="space-y-4" onSubmit={event => void submit(event)}>
        {dialog === 'course' && <>
          <Field label="Código del curso"><input required minLength={3} maxLength={40} value={code} onChange={event => setCode(event.target.value.toLowerCase())} placeholder="mat-101" className={inputClass}/></Field>
          <Field label="Nombre del curso"><input required minLength={3} maxLength={180} value={courseName} onChange={event => setCourseName(event.target.value)} placeholder="Fundamentos de Matemáticas" className={inputClass}/></Field>
          <Field label="Descripción (opcional)"><textarea maxLength={2000} rows={3} value={description} onChange={event => setDescription(event.target.value)} className={inputClass}/></Field>
          <Field label="Nivel (opcional)"><input maxLength={80} value={level} onChange={event => setLevel(event.target.value)} placeholder="Básico" className={inputClass}/></Field>
          <Field label="Período académico"><input required minLength={3} maxLength={80} value={period} onChange={event => setPeriod(event.target.value)} placeholder="2026-II" className={inputClass}/></Field>
          <div className="space-y-1.5"><span className="text-sm font-medium">Estado inicial</span><OptionSelect value={courseStatus} onChange={setCourseStatus} ariaLabel="Estado inicial del curso" options={[
            { value: 'published', label: 'Publicado — matrícula abierta' }, { value: 'draft', label: 'Borrador — sin matrículas' },
          ]}/></div>
        </>}
        {dialog === 'student' && <>
          {/* La guía permanece disponible dentro del formulario, incluso si ya hay alumnos. */}
          <p className="app-info flex items-start gap-2 rounded-xl border p-3 text-xs" role="note">
            <Info size={16} aria-hidden="true" className="shrink-0"/>
            <span>La cuenta debe existir y tener el correo confirmado en Supabase Authentication → Users. Aquí no se crean contraseñas.</span>
          </p>
          <Field label="Correo de la cuenta Supabase Auth"><input required type="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="estudiante@ejemplo.com" className={inputClass}/></Field>
          <Field label="Nombre completo"><input required minLength={3} maxLength={180} value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Estudiante de prueba" className={inputClass}/></Field>
          <Field label="Código académico (opcional)"><input maxLength={60} value={externalCode} onChange={event => setExternalCode(event.target.value)} placeholder="ALU-001" className={inputClass}/></Field>
          <p className="app-muted text-xs">Una cuenta Auth confirmada puede pertenecer a varias instituciones; cada institución conserva su propio perfil académico.</p>
        </>}
        {dialog === 'enrollment' && <>
          <div className="space-y-1.5"><span className="text-sm font-medium">Curso y período</span><OptionSelect ariaLabel="Curso ofertado" value={offering} onChange={setOffering} placeholder="Seleccionar oferta abierta" options={activeCourses.map(item => ({
            value: item.offering_id!, label: item.title, suffix: item.period ?? '',
          }))}/></div>
          <div className="space-y-1.5"><span className="text-sm font-medium">Estudiante</span><OptionSelect ariaLabel="Estudiante a matricular" value={studentId} onChange={setStudentId} placeholder="Seleccionar estudiante" options={activeStudents.map(item => ({
            value: item.id, label: item.full_name, suffix: item.external_code || '',
          }))}/></div>
        </>}
        {error && <p role="alert" className="app-warning rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-3">
          <button type="button" disabled={busy} onClick={() => { setDialog(null); setError(''); }} className={secondaryButton}>Cancelar</button>
          <button type="submit" disabled={busy || (dialog === 'enrollment' && (!offering || !studentId))} className={mainButton}>
            {busy ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  </div>;
}

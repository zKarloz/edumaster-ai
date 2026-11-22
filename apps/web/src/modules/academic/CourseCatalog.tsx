/** Catálogo por rol. Los estados de oferta nunca se confunden con los de matrícula. */
import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, GraduationCap,
  LayoutGrid, List, RefreshCcw, Search, UsersRound } from 'lucide-react';
import { OptionSelect } from '../../components/shared/OptionSelect';
import { Spinner } from '../../components/shared/Spinner';
import { DataTable, type Column } from '../../components/shared/DataTable';

export type CourseRole = 'manager' | 'instructor' | 'student';
interface CourseRow {
  id: string; code: string; title: string; description?: string | null;
  status: string; offering_id: string | null; period: string | null;
  offering_status: string | null; enrollment_status?: string | null; enrolled_count: number;
}
interface Props { organizationId: string; token: string; role: CourseRole; refreshKey: number }
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const PAGE_SIZE = 12;
const btn = 'app-secondary-button inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-50';
const statusOffer: Record<string,string> = { planned: 'Planificada', open: 'Abierta', closed: 'Cerrada', cancelled: 'Cancelada' };
const statusStudent: Record<string,string> = { active: 'En curso', completed: 'Completado', withdrawn: 'Retirado' };

async function get<T>(path: string, token: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${API}${path}`, { signal, headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`No se pudieron consultar los cursos (HTTP ${response.status}).`);
  return response.json() as Promise<T>;
}
function statusLabel(item: CourseRow, role: CourseRole) {
  return role === 'student'
    ? statusStudent[item.enrollment_status || ''] || 'Sin estado'
    : statusOffer[item.offering_status || ''] || 'Sin oferta';
}

export function CourseCatalog({ organizationId, token, role, refreshKey }: Props) {
  const [view, setView] = useState<'list'|'grid'>(() => {
    try { return localStorage.getItem('edumaster_cursos_vista') === 'grid' ? 'grid' : 'list'; }
    catch { return 'list'; }
  });
  const [periods, setPeriods] = useState<string[]>([]);
  const [period, setPeriod] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isStudent = role === 'student';
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [search]);
  useEffect(() => { setPeriod('all'); setStatus('all'); setSearch(''); setPage(0); setRows([]); }, [organizationId, role]);
  useEffect(() => { setPage(0); }, [period, status, debounced]);
  useEffect(() => {
    if (!organizationId) { setPeriods([]); return; }
    const controller = new AbortController();
    void get<{items: string[]}>(`/api/v1/academic/organizations/${organizationId}/course-periods`,token,controller.signal)
      .then(data => { if (!controller.signal.aborted) setPeriods(data.items); })
      .catch(() => { if (!controller.signal.aborted) setPeriods([]); });
    return () => controller.abort();
  }, [organizationId, token, role, refreshKey]);

  useEffect(() => {
    if (!organizationId) return;
    const controller = new AbortController();
    const root = `/api/v1/academic/organizations/${organizationId}`;
    setLoading(true); setError('');
    if (role === 'instructor') {
      // El endpoint docente solo expone ofertas asignadas. Mantiene su límite actual
      // de 200 ofertas; cuando se amplíe, añadiremos paginación equivalente en API.
      void get<{items: Array<{id:string;course_title:string;course_code:string;period:string;status:string;active_enrollments:number}>}>(
        `${root}/activity/offerings`, token, controller.signal)
        .then(data => {
          if (controller.signal.aborted) return;
          const all = data.items.map(offering => ({id:offering.id,code:offering.course_code,
            title:offering.course_title,status:'published',offering_id:offering.id,
            period:offering.period,offering_status:offering.status,enrolled_count:offering.active_enrollments}));
          const filtered = all.filter(item => {
            const periodMatches = period === 'all' || (period === 'current' ? item.offering_status === 'open'
              : period === 'year' ? item.period?.includes(String(currentYear)) : item.period === period);
            return periodMatches && (status === 'all' || item.offering_status === status)
              && `${item.title} ${item.code}`.toLocaleLowerCase().includes(debounced.toLocaleLowerCase());
          });
          setTotal(filtered.length); setRows(filtered.slice(page * PAGE_SIZE, (page+1)*PAGE_SIZE));
        }).catch((err: unknown) => { if (!controller.signal.aborted) setError(err instanceof Error?err.message:'Error al consultar cursos'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    } else {
      const qs = new URLSearchParams({ limit:String(PAGE_SIZE), offset:String(page*PAGE_SIZE) });
      if (debounced) qs.set('search',debounced);
      if (period === 'current') qs.set('current','true');
      else if (period === 'year') qs.set('year',String(currentYear));
      else if (period !== 'all') qs.set('period',period);
      if (status !== 'all') qs.set(isStudent?'enrollment_status':'offering_status',status);
      void get<{items:CourseRow[];total:number}>(`${root}/${isStudent?'my-courses':'course-offerings'}?${qs}`,token,controller.signal)
        .then(data => { if (!controller.signal.aborted) { setRows(data.items); setTotal(data.total); } })
        .catch((err:unknown) => { if (!controller.signal.aborted) setError(err instanceof Error?err.message:'Error al consultar cursos'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }
    return () => controller.abort();
  }, [organizationId, token, role, refreshKey, period, status, debounced, page, currentYear, isStudent]);

  const columns: Column<CourseRow>[] = [
    {header:'Curso',key:'title',render:item=><div><p className="font-medium">{item.title}</p><p className="app-muted text-xs">{item.code}</p></div>},
    {header:'Período',key:'period'},
    {header:isStudent?'Mi matrícula':'Oferta',key:'offering_status',render:item=>statusLabel(item,role)},
    ...(!isStudent ? [{header:'Activos',key:'enrolled_count' as const}] : []),
  ];
  function changeView(value:'list'|'grid') {
    setView(value);
    try { localStorage.setItem('edumaster_cursos_vista',value); } catch { /* navegador sin almacenamiento */ }
  }
  const totalPages = Math.max(1,Math.ceil(total/PAGE_SIZE));
  return <div className="space-y-4">
    <div className="app-panel space-y-4 rounded-2xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h4 className="font-semibold">{isStudent?'Mis cursos':role==='instructor'?'Mis ofertas asignadas':'Ofertas académicas'}</h4>
          <p className="app-muted mt-1 text-xs">{isStudent?'Completados significa que finalizaste personalmente la matrícula.':'El cierre de la oferta no significa que sus estudiantes hayan completado el curso.'}</p></div>
        <div className="flex overflow-hidden rounded-xl border app-divider" role="group" aria-label="Vista de cursos">
          <button type="button" aria-pressed={view==='list'} onClick={()=>changeView('list')} title="Vista lista"
            className={`${btn} rounded-none border-0 ${view==='list'?'app-accent bg-sky-500/10':''}`}><List size={17}/> Lista</button>
          <button type="button" aria-pressed={view==='grid'} onClick={()=>changeView('grid')} title="Vista cuadrícula"
            className={`${btn} rounded-none border-0 ${view==='grid'?'app-accent bg-sky-500/10':''}`}><LayoutGrid size={17}/> Cuadrícula</button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
        <label className="space-y-1.5 text-sm"><span className="app-muted flex items-center gap-1"><CalendarDays size={15}/> Período</span>
          <OptionSelect ariaLabel="Filtrar por período" value={period} onChange={setPeriod} options={[
            {value:'all',label:'Todos los períodos'},{value:'current',label:'Actuales (ofertas abiertas)'},
            {value:'year',label:`Año actual (${currentYear})`},
            ...periods.map(p=>({value:p,label:p})),
          ]}/></label>
        <label className="space-y-1.5 text-sm"><span className="app-muted">{isStudent?'Mi estado':'Estado de la oferta'}</span>
          <OptionSelect ariaLabel="Filtrar por estado" value={status} onChange={setStatus} options={isStudent?[
            {value:'all',label:'Todos mis cursos'},{value:'active',label:'En curso'},
            {value:'completed',label:'Completados'},{value:'withdrawn',label:'Retirados'},
          ]:[{value:'all',label:'Todas las ofertas'},
            {value:'planned',label:'Planificadas'},{value:'open',label:'Abiertas'},
            {value:'closed',label:'Cerradas'}, ...(role==='manager'?[{value:'cancelled',label:'Canceladas'}]:[])]}/></label>
        <label className="space-y-1.5 text-sm"><span className="app-muted">Buscar curso</span>
          <div className="app-input flex items-center gap-2 rounded-xl border px-3"><Search size={16}/>
            <input className="min-h-11 min-w-0 flex-1 bg-transparent outline-none" placeholder="Título o código" value={search}
              onChange={event=>setSearch(event.target.value)} maxLength={100}/></div></label>
      </div>
      <p className="app-muted text-xs">«Año actual» interpreta el año escrito en el período; no existen fechas académicas oficiales configuradas aún.</p>
    </div>
    {loading && <Spinner label="Cargando cursos y filtros..."/>}
    {error && <p role="alert" className="app-warning rounded-xl border p-3 text-sm">{error}</p>}
    {!loading && !error && rows.length === 0 && <div className="app-panel rounded-2xl border p-8 text-center text-sm app-muted">No hay cursos para los filtros seleccionados.</div>}
    {!loading && !error && rows.length > 0 && (view==='list'
      ? <DataTable<CourseRow> key={`${organizationId}-${role}-${period}-${status}-${page}`} rows={rows} columns={columns} label="Cursos filtrados" pageSize={PAGE_SIZE} manualMode/>
      : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map(item=><article key={item.offering_id || item.id} className="app-panel flex min-h-48 flex-col rounded-2xl border p-5">
          <div className="flex items-start justify-between gap-2"><span className="rounded-xl bg-sky-500/10 p-2 app-accent"><BookOpen size={20}/></span>
            <span className="app-info rounded-lg border px-2 py-1 text-xs">{statusLabel(item,role)}</span></div>
          <h4 className="mt-4 font-semibold">{item.title}</h4><p className="app-muted mt-1 text-xs">{item.code} · {item.period || 'Sin período'}</p>
          <div className="app-muted mt-auto flex items-center gap-2 pt-4 text-xs">{isStudent?<GraduationCap size={15}/>:<UsersRound size={15}/>}
            {isStudent?'Mi matrícula':`${item.enrolled_count} matrículas activas`}</div>
        </article>)}</div>)}
    {role==='instructor' && total >= 200 && <p className="app-muted text-xs">Mostrando hasta 200 ofertas docentes; la paginación del directorio docente está pendiente.</p>}
    {!loading && !error && total>0 && <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="app-muted text-sm">{total} {isStudent?'matrículas':'ofertas'} · página {page+1} de {totalPages}</p>
      <div className="flex gap-2">
        <button className={btn} type="button" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}><ChevronLeft size={15}/> Anterior</button>
        <button className={btn} type="button" disabled={page+1>=totalPages} onClick={()=>setPage(p=>p+1)}>Siguiente <ChevronRight size={15}/></button>
      </div>
    </div>}
    <p className="app-muted flex items-center gap-2 text-xs"><RefreshCcw size={13}/> Los datos proceden de FastAPI, con permisos verificados por institución.</p>
  </div>;
}

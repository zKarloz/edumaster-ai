/** Catálogo por rol. Los estados de oferta nunca se confunden con los de matrícula. */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
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
const statusOffer: Record<string,string> = { planned: 'course.planned', open: 'course.open', closed: 'course.closed', cancelled: 'course.cancelled' };
const statusStudent: Record<string,string> = { active: 'course.underway', completed: 'course.completed', withdrawn: 'course.withdrawn' };

async function get<T>(path: string, token: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${API}${path}`, { signal, headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`No se pudieron consultar los cursos (HTTP ${response.status}).`);
  return response.json() as Promise<T>;
}
function statusLabel(item: CourseRow, role: CourseRole) {
  return i18n.t(role === 'student' ? (statusStudent[item.enrollment_status || ''] || 'course.unknown') : (statusOffer[item.offering_status || ''] || 'course.noOffer'));
}

export function CourseCatalog({ organizationId, token, role, refreshKey }: Props) {
  const { t } = useTranslation();
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
    {header:t('course.course'),key:'title',render:item=><div><p className="font-medium">{item.title}</p><p className="app-muted text-xs">{item.code}</p></div>},
    {header:t('course.period'),key:'period'},
    {header:t(isStudent ? 'course.myEnrollment' : 'course.offer'),key:'offering_status',render:item=>statusLabel(item,role)},
    ...(!isStudent ? [{header:t('course.active'),key:'enrolled_count' as const}] : []),
  ];
  function changeView(value:'list'|'grid') {
    setView(value);
    try { localStorage.setItem('edumaster_cursos_vista',value); } catch { /* navegador sin almacenamiento */ }
  }
  const totalPages = Math.max(1,Math.ceil(total/PAGE_SIZE));
  return <div className="space-y-4">
    <div className="app-panel space-y-4 rounded-2xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h4 className="font-semibold">{t(isStudent ? 'course.myCourses' : role==='instructor' ? 'course.assignedOffers' : 'course.academicOffers')}</h4>
          <p className="app-muted mt-1 text-xs">{t(isStudent ? 'course.studentHint' : 'course.offerHint')}</p></div>
        <div className="flex overflow-hidden rounded-xl border app-divider" role="group" aria-label={t('course.listView')}>
          <button type="button" aria-pressed={view==='list'} onClick={()=>changeView('list')} title={t('course.listView')}
            className={`${btn} rounded-none border-0 ${view==='list'?'app-accent bg-sky-500/10':''}`}><List size={17}/> {t('course.list')}</button>
          <button type="button" aria-pressed={view==='grid'} onClick={()=>changeView('grid')} title={t('course.gridView')}
            className={`${btn} rounded-none border-0 ${view==='grid'?'app-accent bg-sky-500/10':''}`}><LayoutGrid size={17}/> {t('course.grid')}</button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
        <label className="space-y-1.5 text-sm"><span className="app-muted flex items-center gap-1"><CalendarDays size={15}/> {t('course.period')}</span>
          <OptionSelect ariaLabel={t('course.filterPeriod')} value={period} onChange={setPeriod} options={[
            {value:'all',label:t('course.allPeriods')},{value:'current',label:t('course.current')},
            {value:'year',label:t('course.currentYear', {year:currentYear})},
            ...periods.map(p=>({value:p,label:p})),
          ]}/></label>
        <label className="space-y-1.5 text-sm"><span className="app-muted">{t(isStudent ? 'course.myState' : 'course.offerState')}</span>
          <OptionSelect ariaLabel={t('course.filterState')} value={status} onChange={setStatus} options={isStudent?[
            {value:'all',label:t('course.allMine')},{value:'active',label:t('course.underway')},
            {value:'completed',label:t('course.completed')},{value:'withdrawn',label:t('course.withdrawn')},
          ]:[{value:'all',label:t('course.allOffers')},
            {value:'planned',label:t('course.planned')},{value:'open',label:t('course.open')},
            {value:'closed',label:t('course.closed')}, ...(role==='manager'?[{value:'cancelled',label:t('course.cancelled')}]:[])]}/></label>
        <label className="space-y-1.5 text-sm"><span className="app-muted">{t('course.searchCourse')}</span>
          <div className="app-input flex items-center gap-2 rounded-xl border px-3"><Search size={16}/>
            <input className="min-h-11 min-w-0 flex-1 bg-transparent outline-none" placeholder={t('course.search')} value={search}
              onChange={event=>setSearch(event.target.value)} maxLength={100}/></div></label>
      </div>
      <p className="app-muted text-xs">{t('course.yearHint')}</p>
    </div>
    {loading && <Spinner label={t('course.loading')}/>}
    {error && <p role="alert" className="app-warning rounded-xl border p-3 text-sm">{error}</p>}
    {!loading && !error && rows.length === 0 && <div className="app-panel rounded-2xl border p-8 text-center text-sm app-muted">{t('course.empty')}</div>}
    {!loading && !error && rows.length > 0 && (view==='list'
      ? <DataTable<CourseRow> key={`${organizationId}-${role}-${period}-${status}-${page}`} rows={rows} columns={columns} label={t('course.filtered')} pageSize={PAGE_SIZE} manualMode/>
      : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map(item=><article key={item.offering_id || item.id} className="app-panel flex min-h-48 flex-col rounded-2xl border p-5">
          <div className="flex items-start justify-between gap-2"><span className="rounded-xl bg-sky-500/10 p-2 app-accent"><BookOpen size={20}/></span>
            <span className="app-info rounded-lg border px-2 py-1 text-xs">{statusLabel(item,role)}</span></div>
          <h4 className="mt-4 font-semibold">{item.title}</h4><p className="app-muted mt-1 text-xs">{item.code} · {item.period || t('course.noPeriod')}</p>
          <div className="app-muted mt-auto flex items-center gap-2 pt-4 text-xs">{isStudent?<GraduationCap size={15}/>:<UsersRound size={15}/>}
            {isStudent ? t('course.myEnrollment') : t('course.activeCount', {count: item.enrolled_count})}</div>
        </article>)}</div>)}
    {role==='instructor' && total >= 200 && <p className="app-muted text-xs">{t('course.maxOffers')}</p>}
    {!loading && !error && total>0 && <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="app-muted text-sm">{t(isStudent ? 'course.enrollmentCount' : 'course.offeringCount', {count: total, page:page+1, total:totalPages})}</p>
      <div className="flex gap-2">
        <button className={btn} type="button" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}><ChevronLeft size={15}/> {t('course.previous')}</button>
        <button className={btn} type="button" disabled={page+1>=totalPages} onClick={()=>setPage(p=>p+1)}>{t('course.next')} <ChevronRight size={15}/></button>
      </div>
    </div>}
    <p className="app-muted flex items-center gap-2 text-xs"><RefreshCcw size={13}/> {t('course.source')}</p>
  </div>;
}

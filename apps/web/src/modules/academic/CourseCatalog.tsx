/** Catálogo por rol: tarjeta horizontal o cuadrícula; no mezcla oferta y matrícula.
 * La ficha seleccionable muestra datos reales. El futuro espacio de tareas se diseñará aparte.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { courseOfferingPath, courseBasePath } from '../../routes';
import i18n from '../../i18n';
import {
  CalendarDays, ChevronLeft, ChevronRight, GraduationCap, LayoutGrid, List,
  Palette, RotateCcw, Search, Settings2, UsersRound,
} from 'lucide-react';
import { OptionSelect } from '../../components/shared/OptionSelect';
import { Spinner } from '../../components/shared/Spinner';
import { Modal } from '../../components/shared/Modal';
import { ResponsiveActionMenu } from '../../components/shared/ResponsiveActionMenu';
import { useToast } from '../../components/shared/Toast';
import {
  COLOR_KEYS, COURSE_COLORS, ICON_KEYS, courseCardStyle, courseIcon,
} from './courseAppearance';

export type CourseRole = 'manager' | 'instructor' | 'student';
interface CourseRow {
  id: string; code: string; title: string; description?: string | null;
  status: string; offering_id: string | null; period: string | null;
  offering_status: string | null; enrollment_status?: string | null; enrolled_count: number;
  course_icon?: string; course_color?: string;
  offering_icon_override?: string | null; offering_color_override?: string | null;
  appearance_icon?: string; appearance_color?: string;
}
interface InstructorOffering {
  id: string; course_id: string; course_title: string; course_code: string;
  period: string; status: string; course_status: string; active_enrollments: number;
  course_icon: string; course_color: string;
  offering_icon_override: string | null; offering_color_override: string | null;
  appearance_icon: string; appearance_color: string;
}
interface Props { organizationId: string; token: string; role: CourseRole; refreshKey: number }
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const PAGE_SIZE = 12;
const btn = 'app-secondary-button inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-50';
const statusOffer: Record<string,string> = { planned:'course.planned', open:'course.open', closed:'course.closed', cancelled:'course.cancelled' };
const statusStudent: Record<string,string> = { active:'course.underway', completed:'course.completed', withdrawn:'course.withdrawn' };

async function get<T>(path: string, token: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${API}${path}`, { signal, headers:{ Authorization:`Bearer ${token}` } });
  if (!response.ok) throw new Error(`No se pudieron consultar los cursos (HTTP ${response.status}).`);
  return response.json() as Promise<T>;
}

/** Las escrituras siempre incluyen JWT; el servidor valida rol y oferta asignada. */
async function saveAppearance(path:string, method:'PATCH'|'PUT'|'DELETE', token:string, value?:{icon:string;color:string}):Promise<void> {
  const response = await fetch(`${API}${path}`, {
    method, headers:{Authorization:`Bearer ${token}`, ...(value?{'Content-Type':'application/json'}:{})},
    ...(value?{body:JSON.stringify(value)}:{}),
  });
  if (!response.ok) {
    const body: {detail?:unknown} = await response.json().catch(()=>({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : `Error HTTP ${response.status}`);
  }
}

/** Cambio de estado institucional autorizado exclusivamente por FastAPI. */
async function saveCourseState(path:string,token:string,status:string):Promise<void> {
  const response=await fetch(`${API}${path}`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({status})});
  if(!response.ok) {
    const error:{detail?:unknown}=await response.json().catch(()=>({}));
    throw new Error(typeof error.detail==='string'?error.detail:'No se pudo actualizar el estado.');
  }
}

function statusLabel(item:CourseRow, role:CourseRole):string {
  return i18n.t(role==='student'
    ? (statusStudent[item.enrollment_status || ''] || 'course.unknown')
    : (statusOffer[item.offering_status || ''] || 'course.noOffer'));
}

export function CourseCatalog({organizationId, token, role, refreshKey}:Props) {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {notify} = useToast();
  const [view,setView] = useState<'list'|'grid'>(()=>{
    try {return localStorage.getItem('edumaster_cursos_vista')==='grid'?'grid':'list';}
    catch {return 'list';}
  });
  const [periods,setPeriods] = useState<string[]>([]);
  const [period,setPeriod] = useState('all');
  const [status,setStatus] = useState('all');
  const [courseStatus,setCourseStatus] = useState('published');
  const [search,setSearch] = useState('');
  const [debounced,setDebounced] = useState('');
  const [page,setPage] = useState(0);
  const [rows,setRows] = useState<CourseRow[]>([]);
  const [total,setTotal] = useState(0);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [appearanceRefresh,setAppearanceRefresh] = useState(0);
  const [selected,setSelected] = useState<CourseRow|null>(null);
  const [dialogMode,setDialogMode] = useState<'appearance'|'status'|null>(null);
  const [editIcon,setEditIcon] = useState('book-open');
  const [editColor,setEditColor] = useState('blue');
  const [saving,setSaving] = useState(false);
  const [saveError,setSaveError] = useState('');
  const [statusError,setStatusError] = useState('');
  const [nextCourseStatus,setNextCourseStatus] = useState('published');
  const isStudent = role==='student';
  const canEdit = role!=='student';
  const currentYear = new Date().getFullYear();

  useEffect(()=>{
    const id = window.setTimeout(()=>setDebounced(search.trim()),250);
    return ()=>window.clearTimeout(id);
  },[search]);
  useEffect(()=>{
    setPeriod('all');setStatus('all');setCourseStatus('published');setSearch('');setPage(0);setRows([]);setSelected(null);setDialogMode(null);
  },[organizationId,role]);
  useEffect(()=>setPage(0),[period,status,courseStatus,debounced]);
  useEffect(()=>{
    if(!organizationId){setPeriods([]);return;}
    const controller=new AbortController();
    void get<{items:string[]}>(`/api/v1/academic/organizations/${organizationId}/course-periods`,token,controller.signal)
      .then(data=>{if(!controller.signal.aborted)setPeriods(data.items);})
      .catch(()=>{if(!controller.signal.aborted)setPeriods([]);});
    return ()=>controller.abort();
  },[organizationId,token,role,refreshKey]);
  useEffect(()=>{
    if(!organizationId)return;
    const controller=new AbortController();
    const root=`/api/v1/academic/organizations/${organizationId}`;
    setLoading(true);setError('');
    if(role==='instructor'){
      // Endpoint docente devuelve únicamente ofertas asignadas. Se conserva
      // su límite actual de 200 registros hasta introducir paginación API.
      void get<{items:InstructorOffering[]}>(`${root}/activity/offerings`,token,controller.signal)
        .then(data=>{
          if(controller.signal.aborted)return;
          const all:CourseRow[]=data.items.map(off=>({
            id:off.course_id, code:off.course_code,title:off.course_title,
            status:off.course_status, offering_id:off.id,period:off.period,
            offering_status:off.status,enrolled_count:off.active_enrollments,
            course_icon:off.course_icon,course_color:off.course_color,
            offering_icon_override:off.offering_icon_override,
            offering_color_override:off.offering_color_override,
            appearance_icon:off.appearance_icon,appearance_color:off.appearance_color,
          }));
          const filtered=all.filter(item=>{
            const periodMatches=period==='all'||(period==='current'?item.offering_status==='open'
              :period==='year'?item.period?.includes(String(currentYear)):item.period===period);
            return periodMatches&&(status==='all'||item.offering_status===status)
              && item.status===courseStatus
              &&`${item.title} ${item.code}`.toLocaleLowerCase().includes(debounced.toLocaleLowerCase());
          });
          setTotal(filtered.length);setRows(filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE));
        }).catch((reason:unknown)=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Error al consultar cursos');})
        .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    } else {
      const qs=new URLSearchParams({limit:String(PAGE_SIZE),offset:String(page*PAGE_SIZE)});
      if(debounced)qs.set('search',debounced);
      if(period==='current')qs.set('current','true');
      else if(period==='year')qs.set('year',String(currentYear));
      else if(period!=='all')qs.set('period',period);
      if(status!=='all')qs.set(isStudent?'enrollment_status':'offering_status',status);
      if(!isStudent)qs.set('course_status',courseStatus);
      void get<{items:CourseRow[];total:number}>(`${root}/${isStudent?'my-courses':'course-offerings'}?${qs}`,token,controller.signal)
        .then(data=>{if(!controller.signal.aborted){setRows(data.items);setTotal(data.total);}})
        .catch((reason:unknown)=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Error al consultar cursos');})
        .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    }
    return ()=>controller.abort();
  },[organizationId,token,role,refreshKey,appearanceRefresh,period,status,courseStatus,debounced,page,currentYear,isStudent]);

  function changeView(value:'list'|'grid'){
    setView(value);
    try{localStorage.setItem('edumaster_cursos_vista',value);}catch{/* Almacenamiento no disponible */}
  }
  /** Cada acción abre su propio diálogo. El menú no altera las tarjetas ni los permisos. */
  function openActionDialog(item:CourseRow, mode:'appearance'|'status'){
    setDialogMode(mode);setSelected(item);setSaveError('');setStatusError('');setNextCourseStatus(item.status);
    // El gestor modifica el valor institucional. El docente modifica sólo su oferta.
    setEditIcon(role==='manager'?(item.course_icon||'book-open'):(item.appearance_icon||'book-open'));
    setEditColor(role==='manager'?(item.course_color||'blue'):(item.appearance_color||'blue'));
  }
  /** La tarjeta abre su espacio académico; apariencia sigue en un control separado. */
  function visitCourse(item:CourseRow){
    if (item.offering_id) navigate(courseOfferingPath(organizationId,item.offering_id));
    else if (role==='manager') navigate(courseBasePath(organizationId,item.id));
  }
  async function updateAppearance(reset=false){
    if(!selected||!organizationId||!canEdit)return;
    setSaving(true);setSaveError('');
    try {
      const root=`/api/v1/academic/organizations/${organizationId}`;
      if(role==='manager'){
        await saveAppearance(`${root}/courses/${selected.id}/appearance`,'PATCH',token,
          {icon:editIcon,color:editColor});
      }else if(selected.offering_id){
        await saveAppearance(`${root}/course-offerings/${selected.offering_id}/appearance`,
          reset?'DELETE':'PUT',token,reset?undefined:{icon:editIcon,color:editColor});
      }
      notify(t(reset?'courseAppearance.restored':'courseAppearance.saved'),'success');
      setSelected(null);setDialogMode(null);setAppearanceRefresh(value=>value+1);
    }catch(reason){setSaveError(reason instanceof Error?reason.message:t('courseAppearance.saveError'));}
    finally{setSaving(false);}
  }

  /** Actualiza el estado editorial sin eliminar ofertas, matrículas ni notas. */
  async function updateCourseState(){
    if (!selected || role!=='manager' || nextCourseStatus===selected.status) return;
    setSaving(true);setStatusError('');
    try {
      await saveCourseState(`/api/v1/academic/organizations/${organizationId}/courses/${selected.id}/status`,token,nextCourseStatus);
      notify(t('course.statusSaved'),'success');
      setSelected(null);setDialogMode(null);
      // Mantener el filtro actual: los archivados desaparecen hasta elegir Archivado.
      setAppearanceRefresh(value=>value+1);
    } catch (reason) {
      setStatusError(reason instanceof Error?reason.message:t('workspace.saveError'));
    } finally {setSaving(false);}
  }

  const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const SelectedIcon=courseIcon(selected?.appearance_icon);
  const PreviewIcon=courseIcon(editIcon);
  return <div className="space-y-4">
    <div className="app-panel space-y-4 rounded-2xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h4 className="font-semibold">{t(isStudent?'course.myCourses':role==='instructor'?'course.assignedOffers':'course.academicOffers')}</h4>
          <p className="app-muted mt-1 text-xs">{t(isStudent?'course.studentHint':'course.offerHint')}</p></div>
        <div className="flex overflow-hidden rounded-xl border app-divider" role="group" aria-label={t('course.listView')}>
          <button type="button" aria-pressed={view==='list'} onClick={()=>changeView('list')} title={t('course.listView')}
            className={`${btn} rounded-none border-0 ${view==='list'?'app-accent bg-sky-500/10':''}`}><List size={17}/> {t('course.list')}</button>
          <button type="button" aria-pressed={view==='grid'} onClick={()=>changeView('grid')} title={t('course.gridView')}
            className={`${btn} rounded-none border-0 ${view==='grid'?'app-accent bg-sky-500/10':''}`}><LayoutGrid size={17}/> {t('course.grid')}</button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1.5 text-sm"><span className="app-muted flex items-center gap-1"><CalendarDays size={15}/>{t('course.period')}</span>
          <OptionSelect ariaLabel={t('course.filterPeriod')} value={period} onChange={setPeriod} options={[
            {value:'all',label:t('course.allPeriods')},{value:'current',label:t('course.current')},
            {value:'year',label:t('course.currentYear',{year:currentYear})},...periods.map(p=>({value:p,label:p})),
          ]}/></label>
        <label className="space-y-1.5 text-sm"><span className="app-muted">{t(isStudent?'course.myState':'course.offerState')}</span>
          <OptionSelect ariaLabel={t('course.filterState')} value={status} onChange={setStatus} options={isStudent?[
            {value:'all',label:t('course.allMine')},{value:'active',label:t('course.underway')},
            {value:'completed',label:t('course.completed')},{value:'withdrawn',label:t('course.withdrawn')},
          ]:[{value:'all',label:t('course.allOffers')},{value:'planned',label:t('course.planned')},
            {value:'open',label:t('course.open')},{value:'closed',label:t('course.closed')},
            ...(role==='manager'?[{value:'cancelled',label:t('course.cancelled')}]:[])]}/></label>
        {!isStudent && <label className="space-y-1.5 text-sm"><span className="app-muted">{t('course.courseStatus')}</span>
          <OptionSelect ariaLabel={t('course.courseStatus')} value={courseStatus} onChange={setCourseStatus} options={[
            {value:'published',label:t('course.courseActive')},
            {value:'draft',label:t('course.courseDraft')},
            {value:'archived',label:t('course.courseArchived')},
          ]}/></label>}
        <label className="space-y-1.5 text-sm"><span className="app-muted">{t('course.searchCourse')}</span>
          <div className="search-control app-input flex items-center gap-2 rounded-xl border px-3"><Search size={16} className="shrink-0"/>
            <input type="search" className="min-h-11 min-w-0 flex-1 bg-transparent outline-none focus:outline-none focus-visible:outline-none" placeholder={t('course.search')}
              value={search} onChange={event=>setSearch(event.target.value)} maxLength={100}/></div></label>
      </div>
      <p className="app-muted text-xs">{t('course.yearHint')}</p>
    </div>
    {loading&&<Spinner label={t('course.loading')}/>}
    {error&&<p role="alert" className="app-warning rounded-xl border p-3 text-sm">{error}</p>}
    {!loading&&!error&&rows.length===0&&<div className="app-panel rounded-2xl border p-8 text-center text-sm app-muted">{t('course.empty')}</div>}
    {!loading&&!error&&rows.length>0&&(view==='list'
      ? <div className="space-y-2" aria-label={t('course.filtered')}>
          {rows.map(item=>{
            const Icon=courseIcon(item.appearance_icon);
            return <div key={item.offering_id||item.id}
              className="app-course-list-card app-panel group relative flex min-h-22 w-full items-center gap-1 overflow-hidden rounded-2xl border text-left"
              style={courseCardStyle(item.appearance_color)}>
              <span aria-hidden="true" className="app-course-list-stripe"/>
              <button type="button" onClick={()=>visitCourse(item)}
                aria-label={`${t('workspace.enterCourse')}: ${item.title} (${item.period||''})`}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2">
                <span className="app-course-list-icon flex size-11 shrink-0 items-center justify-center rounded-xl"><Icon size={23}/></span>
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{item.title}</span>
                  <span className="app-muted mt-1 block truncate text-xs">{item.code} · {item.period||t('course.noPeriod')}</span></span>
                <span className="app-info hidden rounded-lg border px-2 py-1 text-xs sm:block">{statusLabel(item,role)}</span>
                <ChevronRight size={18} className="app-muted shrink-0 transition-transform group-hover:translate-x-0.5"/>
              </button>
              {canEdit && (role==='manager'||item.status!=='archived') &&
                <ResponsiveActionMenu className="mr-3" label={`${t('course.actionMenu')}: ${item.title}`}
                  sheetTitle={item.title} actions={[
                    {id:'theme',label:t('courseAppearance.editTheme'),icon:<Palette size={17}/>,
                      disabled:item.status==='archived',onSelect:()=>openActionDialog(item,'appearance')},
                    ...(role==='manager' ? [{id:'status',label:t('course.changeStateMenu'),
                      icon:<Settings2 size={17}/>,onSelect:()=>openActionDialog(item,'status')}] : []),
                  ]}/> }
            </div>;
          })}
        </div>
      : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rows.map(item=>{
          const Icon=courseIcon(item.appearance_icon);
          return <div key={item.offering_id||item.id}
            className="app-course-grid-card app-panel group relative flex min-h-56 w-full flex-col overflow-hidden rounded-2xl border text-left"
            style={courseCardStyle(item.appearance_color)}>
            <button type="button" onClick={()=>visitCourse(item)}
              className="flex min-h-56 w-full flex-1 flex-col text-left focus-visible:outline-2 focus-visible:outline-offset-2"
              aria-label={`${t('workspace.enterCourse')}: ${item.title} (${item.period||''})`}>
              <span className="app-course-grid-banner flex min-h-24 w-full items-center justify-center"><Icon size={39} strokeWidth={1.7}/></span>
              <span className="flex flex-1 flex-col gap-2 p-4">
                <span className="font-semibold leading-snug">{item.title}</span>
                <span className="app-muted text-xs">{item.code} · {item.period||t('course.noPeriod')}</span>
                <span className="app-muted mt-auto flex items-center gap-2 pt-2 text-xs">{isStudent?<GraduationCap size={15}/>:<UsersRound size={15}/>} 
                  {isStudent?t('course.myEnrollment'):t('course.activeCount',{count:item.enrolled_count})}</span>
                <span className="app-info self-start rounded-lg border px-2 py-1 text-xs">{statusLabel(item,role)}</span>
              </span>
            </button>
            {canEdit && (role==='manager'||item.status!=='archived') &&
              <div className="absolute right-3 top-3">
                <ResponsiveActionMenu className="app-course-appearance-grid" label={`${t('course.actionMenu')}: ${item.title}`}
                  sheetTitle={item.title} actions={[
                    {id:'theme',label:t('courseAppearance.editTheme'),icon:<Palette size={17}/>,
                      disabled:item.status==='archived',onSelect:()=>openActionDialog(item,'appearance')},
                    ...(role==='manager' ? [{id:'status',label:t('course.changeStateMenu'),
                      icon:<Settings2 size={17}/>,onSelect:()=>openActionDialog(item,'status')}] : []),
                  ]}/>
              </div>}
          </div>;
        })}</div>)}
    {role==='instructor'&&total>=200&&<p className="app-muted text-xs">{t('course.maxOffers')}</p>}
    {!loading&&!error&&total>0&&<div className="flex flex-wrap items-center justify-between gap-3">
      <p className="app-muted text-sm">{t(isStudent?'course.enrollmentCount':'course.offeringCount',{count:total,page:page+1,total:totalPages})}</p>
      <div className="flex gap-2">
        <button className={btn} type="button" disabled={page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}><ChevronLeft size={15}/>{t('course.previous')}</button>
        <button className={btn} type="button" disabled={page+1>=totalPages} onClick={()=>setPage(p=>p+1)}>{t('course.next')}<ChevronRight size={15}/></button>
      </div>
    </div>}

    <Modal open={Boolean(selected && dialogMode)}
      title={t(dialogMode==='status'?'course.changeStateMenu':'courseAppearance.editTheme')}
      onClose={()=>{if(!saving){setSelected(null);setDialogMode(null);}}}>
      {selected && <div className="space-y-5">
        <div className="app-course-detail-banner flex items-center gap-4 rounded-xl p-4"
          style={courseCardStyle(selected.appearance_color)}>
          <SelectedIcon size={36} className="shrink-0"/>
          <div className="min-w-0"><p className="text-lg font-semibold">{selected.title}</p>
            <p className="text-sm opacity-90">{selected.code} · {selected.period||t('course.noPeriod')}</p></div>
        </div>
        {dialogMode==='appearance' && canEdit && selected.status!=='archived' && <div className="space-y-4">
          <p className="app-muted text-sm">{t(role==='manager'?'courseAppearance.managerHint':'courseAppearance.teacherHint')}</p>
          <div><p className="mb-2 text-sm font-medium">{t('courseAppearance.color')}</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('courseAppearance.color')}>
              {COLOR_KEYS.map(key=><button key={key} type="button" aria-pressed={editColor===key}
                aria-label={`${t('courseAppearance.color')}: ${t(`courseAppearance.colors.${key}`)}`}
                className="app-course-color-choice flex size-9 items-center justify-center rounded-full border-2"
                style={{backgroundColor:COURSE_COLORS[key]}} onClick={()=>setEditColor(key)}>
                {editColor===key&&<span aria-hidden="true" className="block size-2 rounded-full bg-white"/>}
              </button>)}
            </div>
          </div>
          <div><p className="mb-2 text-sm font-medium">{t('courseAppearance.icon')}</p>
            <div className="grid grid-cols-6 gap-2" role="group" aria-label={t('courseAppearance.icon')}>
              {ICON_KEYS.map(key=>{const Icon=courseIcon(key);return <button key={key} type="button"
                aria-pressed={editIcon===key} aria-label={t(`courseAppearance.subjects.${key}`)} title={t(`courseAppearance.subjects.${key}`)} onClick={()=>setEditIcon(key)}
                className="app-course-icon-choice flex aspect-square items-center justify-center rounded-xl border"><Icon size={22}/>
              </button>;})}
            </div>
          </div>
          <div className="app-course-selection-preview flex items-center gap-3 rounded-xl border p-3" style={courseCardStyle(editColor)}>
            <span className="app-course-list-icon flex size-10 items-center justify-center rounded-lg">
              <PreviewIcon size={22}/>
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{selected.title}</span>
            <span className="app-muted text-xs">{t('courseAppearance.preview')}</span>
          </div>
          {saveError&&<p role="alert" className="app-warning rounded-xl border p-3 text-sm">{saveError}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            {role==='instructor'&&(selected.offering_icon_override||selected.offering_color_override)&&
              <button type="button" className={btn} disabled={saving} onClick={()=>void updateAppearance(true)}>
                <RotateCcw size={16}/>{t('courseAppearance.restore')}
              </button>}
            <button type="button" className="app-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
              disabled={saving} onClick={()=>void updateAppearance()}>
              {saving?t('courseAppearance.saving'):t('courseAppearance.save')}
            </button>
          </div>
        </div>}
        {dialogMode==='status' && role==='manager' && <div className="space-y-3">
          <p className="app-muted text-sm">{t('course.statusHelp')}</p>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>{t('course.courseStatus')}</span>
            <OptionSelect value={nextCourseStatus} onChange={setNextCourseStatus} ariaLabel={t('course.courseStatus')}
              options={[{value:'published',label:t('course.courseActive')},{value:'draft',label:t('course.courseDraft')},
                {value:'archived',label:t('course.courseArchived')}]}/>
          </label>
          {statusError && <p className="app-warning text-sm" role="alert">{statusError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={btn} disabled={saving}
              onClick={()=>{setSelected(null);setDialogMode(null);}}>{t('common.cancel')}</button>
            <button type="button" className="app-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
              disabled={saving||nextCourseStatus===selected.status}
              onClick={()=>void updateCourseState()}>{t('course.changeCourseStatus')}</button>
          </div>
        </div>}
      </div>}
    </Modal>
  </div>;
}

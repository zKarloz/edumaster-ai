/** v26 · Espacio de aprendizaje por oferta y editor autorizado del curso base.
 * No confunde unidades/lecturas con tareas y notas (se implementarán después).
 * Todos los datos son reales y llegan desde FastAPI con JWT y alcance institucional.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown, ArrowLeft, ArrowUp, BookOpen,
  ClipboardList, FileCheck2, FileText, FolderOpen, LayoutDashboard,
  Pencil, Plus, RefreshCcw,
} from 'lucide-react';
import { Modal } from '../../components/shared/Modal';
import { Accordion } from '../../components/shared/Accordion';
import { OptionSelect } from '../../components/shared/OptionSelect';
import { Spinner } from '../../components/shared/Spinner';
import { useToast } from '../../components/shared/Toast';
import { sectionPaths } from '../../routes';
import { courseCardStyle, courseIcon } from './courseAppearance';

type State = 'draft' | 'published' | 'archived';
type Direction = 'up' | 'down';
type Source = 'base' | 'offering';
interface Lesson {
  id: string; module_id: string; title: string; content: string | null;
  position: number; status: State; updated_at: string;
}
interface Unit {
  id: string; title: string; description: string | null;
  position: number; status: State; source: Source; updated_at: string; lessons: Lesson[];
}
interface Course {
  course_id: string; offering_id?: string;
  title: string; code: string; description: string | null;
  course_status: string; offering_status?: string; period?: string;
  appearance_icon?: string; appearance_color?: string;
}
interface Workspace {course: Course; role: 'manager' | 'instructor' | 'student'; can_edit_base: boolean; can_edit_offering: boolean; units: Unit[]}
interface Props {organizationId: string; offeringId?: string; courseId?: string; token: string}

type ContentDialog = {kind: 'unit'; source: Source; current?: Unit} | {kind: 'lesson'; source: Source; unitId: string; current?: Lesson} | null;
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const secondary = 'app-secondary-button inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-40';
const primary = 'app-primary-button inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40';
const control = 'app-input w-full rounded-xl border px-3 py-2.5 text-sm';

async function api<T>(path: string, token: string, options: {signal?: AbortSignal; method?: 'POST'|'PATCH'; body?: unknown} = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: options.method || 'GET', signal: options.signal,
    headers: {Authorization: `Bearer ${token}`, ...(options.body === undefined ? {} : {'Content-Type':'application/json'})},
    ...(options.body === undefined ? {} : {body: JSON.stringify(options.body)}),
  });
  if (!response.ok) {
    const error: {detail?: unknown} = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === 'string' ? error.detail : `Error HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

/** Insignias editoriales: los borradores nunca se sirven al estudiante. */
function StateBadge({status}: {status: State}) {
  const {t} = useTranslation();
  return <span className={`app-workspace-state app-workspace-${status} rounded-lg border px-2 py-1 text-[11px] font-semibold`}>{t(`workspace.${status}`)}</span>;
}

export function CourseWorkspacePage({organizationId, offeringId, courseId, token}: Props) {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {notify} = useToast();
  const [workspace,setWorkspace] = useState<Workspace|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  const [tab,setTab] = useState<'overview'|'content'>('overview');
  const [expanded,setExpanded] = useState<string[]>([]);
  // Por defecto, ocultar unidades archivadas sin perder acceso desde el filtro.
  const [unitFilter,setUnitFilter] = useState<'current'|'all'|State>('current');
  const [dialog,setDialog] = useState<ContentDialog>(null);
  const [title,setTitle] = useState('');
  const [body,setBody] = useState('');
  const [itemState,setItemState] = useState<State>('draft');
  const [saving,setSaving] = useState(false);
  const [formError,setFormError] = useState('');
  const root = `/api/v1/academic/organizations/${organizationId}`;
  const workspacePath = offeringId
    ? `${root}/course-offerings/${offeringId}/workspace`
    : `${root}/courses/${courseId || ''}/workspace`;
  const isBase = !offeringId;
  const editing = Boolean(workspace?.can_edit_base || (offeringId && workspace?.can_edit_offering));
  const canEditSource = (source: Source): boolean =>
    source === 'base' ? Boolean(workspace?.can_edit_base) : Boolean(offeringId && workspace?.can_edit_offering);
  // CAMBIOS 19: cada rol crea solo su tipo de unidad. El gestor conserva
  // can_edit_offering para supervisar y editar contenido docente existente.
  const canCreateBaseUnit = workspace?.role === 'manager' && canEditSource('base');
  const canCreateOfferingUnit = workspace?.role === 'instructor' && canEditSource('offering');

  useEffect(() => {
    const controller = new AbortController();
    setWorkspace(null); setLoading(true); setError('');
    void api<Workspace>(workspacePath,token,{signal:controller.signal})
      .then(data => {if (!controller.signal.aborted) setWorkspace(data);})
      .catch((reason:unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : t('workspace.loadError'));
      }).finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [workspacePath, token, revision, t]);

  const units = workspace?.units ?? [];
  const visibleUnits = units.filter(unit => unitFilter === 'all'
    || (unitFilter === 'current' ? unit.status !== 'archived' : unit.status === unitFilter));
  const publishedUnits = useMemo(() => units.filter(unit => unit.status === 'published').length,[units]);
  const publishedLessons = useMemo(() => units.reduce((total,unit) => total + unit.lessons.filter(lesson => lesson.status === 'published').length,0),[units]);
  const Icon = courseIcon(workspace?.course.appearance_icon);

  function showEditor(next: NonNullable<ContentDialog>) {
    setDialog(next);
    setTitle(next.current?.title || '');
    setBody(next.kind === 'unit' ? next.current?.description || '' : next.current?.content || '');
    setItemState(next.current?.status || 'draft');
    setFormError('');
  }

  /** Las rutas se construyen a partir de los UUID recibidos del backend. */
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialog || !canEditSource(dialog.source) || !workspace) return;
    setSaving(true); setFormError('');
    try {
      const isUnit = dialog.kind === 'unit';
      const currentId = dialog.current?.id;
      const path = dialog.source === 'base'
        ? (isUnit
          ? (currentId ? `${root}/course-modules/${currentId}` : `${root}/courses/${workspace.course.course_id}/modules`)
          : (currentId ? `${root}/lessons/${currentId}` : `${root}/course-modules/${dialog.unitId}/lessons`))
        : (isUnit
          ? (currentId ? `${root}/offering-modules/${currentId}` : `${root}/course-offerings/${offeringId}/modules`)
          : (currentId ? `${root}/offering-lessons/${currentId}` : `${root}/offering-modules/${dialog.unitId}/lessons`));
      // Evita reescribir contenido publicado sin control de versiones.
      // Si está publicado, primero debe pasarse a borrador en una operación aparte.
      const values: Record<string,string|null> = {};
      const current = dialog.current;
      if (!current || title !== current.title) values.title = title;
      const oldBody = dialog.kind === 'unit'
        ? dialog.current?.description : dialog.current?.content;
      if (!current || (body || null) !== (oldBody || null)) {
        values[isUnit?'description':'content'] = body || null;
      }
      if (current && itemState !== current.status) values.status = itemState;
      if (current && Object.keys(values).length===0) {setDialog(null);return;}
      await api(path,token,{method:currentId?'PATCH':'POST',body:values});
      notify(t('workspace.saved'),'success');
      setDialog(null); setRevision(value=>value+1);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : t('workspace.saveError'));
    } finally {setSaving(false);}
  }

  /** Reordena con la operación transaccional del backend, sin datos optimistas. */
  async function move(kind:'unit'|'lesson', source:Source, itemId:string, parentId:string, direction:Direction) {
    if (!canEditSource(source) || !workspace) return;
    setSaving(true);
    try {
      const path = source === 'base'
        ? (kind==='unit'
          ? `${root}/courses/${workspace.course.course_id}/modules/${itemId}/move`
          : `${root}/course-modules/${parentId}/lessons/${itemId}/move`)
        : (kind==='unit'
          ? `${root}/course-offerings/${offeringId}/modules/${itemId}/move`
          : `${root}/offering-modules/${parentId}/lessons/${itemId}/move`);
      await api(path,token,{method:'PATCH',body:{direction}});
      setRevision(value=>value+1);
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : t('workspace.saveError'));
    } finally {setSaving(false);}
  }

  function toggleUnit(id:string) {
    setExpanded(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button className={secondary} type="button" onClick={()=>navigate(sectionPaths.courses)}>
        <ArrowLeft size={17}/>{t('workspace.back')}
      </button>
      <button className={secondary} type="button" onClick={()=>setRevision(value=>value+1)} disabled={loading}>
        <RefreshCcw size={16}/>{t('common.refresh')}
      </button>
    </div>

    {loading && <Spinner label={t('workspace.loading')}/>}
    {error && <div className="app-warning rounded-xl border p-4" role="alert"><p className="text-sm">{error}</p>
      <button className={`${secondary} mt-3`} type="button" onClick={()=>setRevision(v=>v+1)}>{t('workspace.retry')}</button>
    </div>}
    {!loading && !error && workspace && <>
      <section className="app-panel overflow-hidden rounded-2xl border">
        <div className="app-workspace-banner flex flex-wrap items-center gap-4 px-5 py-5 sm:px-6" style={courseCardStyle(workspace.course.appearance_color)}>
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white"><Icon size={30}/></span>
          <div className="min-w-0 flex-1 text-white">
            <p className="text-xl font-bold leading-snug sm:text-2xl">{workspace.course.title}</p>
            <p className="mt-1 text-sm text-white/90">{workspace.course.code}{workspace.course.period ? ` · ${workspace.course.period}`:''}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3 sm:p-4" role="tablist" aria-label={t('workspace.sections')}>
          <button role="tab" aria-selected={tab==='overview'} className={`${secondary} ${tab==='overview'?'app-workspace-active':''}`}
            onClick={()=>setTab('overview')} type="button"><LayoutDashboard size={17}/>{t('workspace.overview')}</button>
          <button role="tab" aria-selected={tab==='content'} className={`${secondary} ${tab==='content'?'app-workspace-active':''}`}
            onClick={()=>setTab('content')} type="button"><BookOpen size={17}/>{t('workspace.content')}</button>
        </div>
      </section>

      {tab==='overview' ? <section className="space-y-4" role="tabpanel">
        <div className="grid gap-3 sm:grid-cols-3">
          {[{label:'workspace.units',value:units.length,icon:FolderOpen},
            {label:'workspace.publishedUnits',value:publishedUnits,icon:BookOpen},
            {label:'workspace.publishedLessons',value:publishedLessons,icon:FileText}].map(item=><div key={item.label} className="app-panel rounded-2xl border p-4">
              <div className="app-muted flex items-center gap-2 text-xs"><item.icon size={16}/>{t(item.label)}</div>
              <p className="mt-3 text-2xl font-bold tabular-nums">{item.value}</p>
            </div>)}
        </div>
        <div className="app-panel rounded-2xl border p-5 sm:p-6">
          <h2 className="font-semibold">{t('workspace.about')}</h2>
          <p className="app-muted mt-2 whitespace-pre-wrap text-sm leading-relaxed">{workspace.course.description || t('workspace.noDescription')}</p>
          <p className="app-muted mt-4 text-xs">{t(isBase?'workspace.baseNote':workspace.role==='student'?'workspace.studentNote':'workspace.offeringNote')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="app-panel flex items-center gap-3 rounded-2xl border p-4"><ClipboardList size={21} className="app-muted"/>
            <div><p className="font-medium">{t('workspace.tasks')}</p><p className="app-muted text-xs">{t('workspace.nextPhase')}</p></div>
          </div>
          <div className="app-panel flex items-center gap-3 rounded-2xl border p-4"><FileCheck2 size={21} className="app-muted"/>
            <div><p className="font-medium">{t('workspace.assessments')}</p><p className="app-muted text-xs">{t('workspace.nextPhase')}</p></div>
          </div>
        </div>
      </section> : <section className="space-y-3" role="tabpanel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">{t('workspace.unitsAndLessons')}</h2>
            <p className="app-muted mt-1 text-xs">{t(editing?'workspace.editorHint':workspace.role==='student'?'workspace.publishedOnly':'workspace.previewHint')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {workspace.role!=='student' && <div className="min-w-44">
              <OptionSelect ariaLabel={t('workspace.filterUnits')} value={unitFilter}
                onChange={value=>setUnitFilter(value as typeof unitFilter)} options={[
                  {value:'current',label:t('workspace.currentUnits')},
                  {value:'published',label:t('workspace.published')},
                  {value:'draft',label:t('workspace.draft')},
                  {value:'archived',label:t('workspace.archived')},
                  {value:'all',label:t('workspace.allUnits')},
                ]}/>
            </div>}
            {canCreateBaseUnit && <button className={primary} type="button" onClick={()=>showEditor({kind:'unit',source:'base'})}>
              <Plus size={17}/>{t('workspace.addBaseUnit')}
            </button>}
            {canCreateOfferingUnit && <button className={primary} type="button" onClick={()=>showEditor({kind:'unit',source:'offering'})}>
              <Plus size={17}/>{t('workspace.addOfferingUnit')}
            </button>}
          </div>
        </div>
        {visibleUnits.length===0 && <div className="app-panel rounded-2xl border px-5 py-10 text-center">
          <FolderOpen className="app-muted mx-auto mb-3" size={32}/><p className="font-medium">{t('workspace.emptyUnits')}</p>
          <p className="app-muted mt-1 text-sm">{t(units.length>0?'workspace.noFilterResults':editing?'workspace.emptyEditor':'workspace.emptyReader')}</p>
        </div>}
        {visibleUnits.map(unit=>{
          const open=expanded.includes(unit.id);
          const editable=canEditSource(unit.source);
          // El índice se calcula solo dentro del mismo origen; no se mezclan órdenes.
          const siblings=units.filter(item=>item.source===unit.source);
          const indexAmongSiblings=siblings.findIndex(item=>item.id===unit.id);
          const actions=editable ? <>
            <button type="button" className="app-workspace-icon-button" title={t('workspace.moveUp')}
              aria-label={`${t('workspace.moveUp')}: ${unit.title}`} disabled={saving||indexAmongSiblings===0}
              onClick={()=>void move('unit',unit.source,unit.id,unit.id,'up')}><ArrowUp size={16}/></button>
            <button type="button" className="app-workspace-icon-button" title={t('workspace.moveDown')}
              aria-label={`${t('workspace.moveDown')}: ${unit.title}`} disabled={saving||indexAmongSiblings===siblings.length-1}
              onClick={()=>void move('unit',unit.source,unit.id,unit.id,'down')}><ArrowDown size={16}/></button>
            <button type="button" className="app-workspace-icon-button" title={t('workspace.editUnit')}
              aria-label={`${t('workspace.editUnit')}: ${unit.title}`} disabled={saving}
              onClick={()=>showEditor({kind:'unit',source:unit.source,current:unit})}><Pencil size={16}/></button>
          </> : undefined;
          return <Accordion key={unit.id} open={open} onToggle={()=>toggleUnit(unit.id)}
            title={`${unit.position}. ${unit.title}`} subtitle={t('workspace.lessonCount',{count:unit.lessons.length})}
            icon={<FolderOpen size={21}/>} actions={actions} actionsLabel={t('workspace.unitActions')}
            badge={workspace.role!=='student'?<StateBadge status={unit.status}/>:undefined}>
            {workspace.role!=='student' && <div className="flex flex-wrap items-center gap-2 text-xs app-muted">
              <span>{t(unit.source==='base'?'workspace.institutional':'workspace.ofThisOffering')}</span>
              <span className="sm:hidden"><StateBadge status={unit.status}/></span>
            </div>}
            {unit.description && <p className="app-muted whitespace-pre-wrap text-sm">{unit.description}</p>}
            {unit.lessons.length===0 && <p className="app-muted text-sm">{t('workspace.noLessons')}</p>}
            {unit.lessons.map((lesson,lessonIndex)=><div key={lesson.id} className="app-workspace-lesson rounded-xl border p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-3">
                <FileText size={18} className="app-muted shrink-0"/>
                <span className="min-w-0 flex-1 font-medium text-sm">{lesson.position}. {lesson.title}</span>
                {workspace.role!=='student' && <StateBadge status={lesson.status}/>}
                {editable && <div className="flex items-center gap-1">
                  <button type="button" className="app-workspace-icon-button" title={t('workspace.moveUp')} disabled={saving||lessonIndex===0}
                    aria-label={`${t('workspace.moveUp')}: ${lesson.title}`} onClick={()=>void move('lesson',unit.source,lesson.id,unit.id,'up')}><ArrowUp size={16}/></button>
                  <button type="button" className="app-workspace-icon-button" title={t('workspace.moveDown')} disabled={saving||lessonIndex===unit.lessons.length-1}
                    aria-label={`${t('workspace.moveDown')}: ${lesson.title}`} onClick={()=>void move('lesson',unit.source,lesson.id,unit.id,'down')}><ArrowDown size={16}/></button>
                  <button type="button" className="app-workspace-icon-button" title={t('workspace.editLesson')} disabled={saving}
                    aria-label={`${t('workspace.editLesson')}: ${lesson.title}`} onClick={()=>showEditor({kind:'lesson',source:unit.source,unitId:unit.id,current:lesson})}><Pencil size={16}/></button>
                </div>}
              </div>
              {lesson.content && <p className="app-muted mt-3 whitespace-pre-wrap text-sm leading-relaxed">{lesson.content}</p>}
            </div>)}
            {editable && <button className={secondary} type="button" onClick={()=>showEditor({kind:'lesson',source:unit.source,unitId:unit.id})}>
              <Plus size={16}/>{t('workspace.addLesson')}
            </button>}
          </Accordion>;
        })}
      </section>}
    </>}

    <Modal open={Boolean(dialog)} title={t(dialog?.kind==='lesson'?'workspace.lessonForm':'workspace.unitForm')}
      onClose={()=>{if(!saving)setDialog(null);}}>
      <form className="space-y-4" onSubmit={event=>void save(event)}>
        <label className="block space-y-1.5 text-sm font-medium"><span>{t('workspace.title')}</span>
          <input className={control} value={title} onChange={event=>setTitle(event.target.value)} minLength={3} maxLength={180}
            disabled={dialog?.current?.status==='published'} required/>
        </label>
        <label className="block space-y-1.5 text-sm font-medium"><span>{t(dialog?.kind==='lesson'?'workspace.lessonText':'workspace.description')}</span>
          <textarea className={`${control} min-h-32 resize-y`} value={body} onChange={event=>setBody(event.target.value)}
            maxLength={dialog?.kind==='lesson'?20000:2000} rows={5}
            disabled={dialog?.current?.status==='published'}/>
        </label>
        {dialog?.current && <div className="space-y-1.5 text-sm font-medium">
          <p>{t('workspace.state')}</p>
          <OptionSelect ariaLabel={t('workspace.state')} value={itemState} onChange={value=>setItemState(value as State)} options={[
            {value:'draft',label:t('workspace.draft')},{value:'published',label:t('workspace.published')},
            {value:'archived',label:t('workspace.archived')},
          ]}/>
          <p className="app-muted text-xs font-normal">{t('workspace.visibilityNote')}</p>
          {dialog.current.status==='published' && <p className="app-muted text-xs font-normal">{t('workspace.publishedEditHint')}</p>}
        </div>}
        {formError && <p className="app-warning rounded-xl border p-3 text-sm" role="alert">{formError}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={secondary} disabled={saving} onClick={()=>setDialog(null)}>{t('common.cancel')}</button>
          <button type="submit" className={primary} disabled={saving||!title.trim()}>{saving?t('workspace.saving'):t('common.save')}</button>
        </div>
      </form>
    </Modal>
  </div>;
}

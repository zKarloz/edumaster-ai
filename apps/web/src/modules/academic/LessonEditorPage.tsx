/** v29.1 · Página de edición de borradores privados.
 * Las revisiones de estudiantes NO se consultan. La API controla cada permiso.
 * Ningún guardado modifica la proyección publicada de las lecciones.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { JSONContent } from '@tiptap/core';
import { useBlocker, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Eye, Pencil, RefreshCcw, Save, ShieldCheck } from 'lucide-react';
import { RichTextEditor } from '../../components/shared/RichTextEditor';
import { LessonResources } from './LessonResources';
import { canonicalLessonDocument } from './lessonDocument';
import { shouldBlockLessonNavigation } from './lessonNavigation';
import { Spinner } from '../../components/shared/Spinner';
import { Modal } from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';
import { courseBasePath, courseOfferingPath, type LessonSource } from '../../routes';

const API=import.meta.env.VITE_API_URL || 'http://localhost:8000';
const emptyDocument:JSONContent={type:'doc',content:[{type:'paragraph'}]};
interface Draft {
  id:string; lesson_id:string; source:'institutional'|'offering'; revision_state:'draft';
  title:string; document_format:'tiptap-json-v1'; document:JSONContent;
  lock_version:number; base_revision_id:string|null; updated_at:string;
}
interface Props {
  organizationId:string; courseId?:string; offeringId?:string;
  lessonId:string; source:LessonSource; token:string; onConfirmSignOut:()=>Promise<boolean>;
}
class ApiFailure extends Error {
  constructor(readonly status:number, detail:string) {super(detail);}
}
/** Recibe errores de FastAPI sin mostrar trazas técnicas al usuario. */
async function draftApi(path:string,token:string,method:'GET'|'POST'|'PATCH',body?:unknown,signal?:AbortSignal):Promise<Draft> {
  const response=await fetch(`${API}${path}`,{
    method, signal,
    headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
  });
  if (!response.ok) {
    const data:{detail?:unknown}=await response.json().catch(()=>({}));
    throw new ApiFailure(response.status,typeof data.detail==='string'?data.detail:`HTTP ${response.status}`);
  }
  return response.json() as Promise<Draft>;
}

export function LessonEditorPage({organizationId,offeringId,courseId,lessonId,source,token,onConfirmSignOut}:Props) {
  const {t}=useTranslation();
  const navigate=useNavigate();
  const location=useLocation();
  const {notify}=useToast();
  const tokenRef=useRef(token);
  const translateRef=useRef(t);
  translateRef.current=t;
  tokenRef.current=token; // Un JWT renovado no debe descartar cambios sin guardar.
  const [draft,setDraft]=useState<Draft|null>(null);
  const [title,setTitle]=useState('');
  const [document,setDocument]=useState<JSONContent>(emptyDocument);
  const [snapshot,setSnapshot]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [conflict,setConflict]=useState(false);
  const [preview,setPreview]=useState(false);
  const [logoutDialog,setLogoutDialog]=useState(false);
  const [confirmedLogout,setConfirmedLogout]=useState(false);
  const [reloadDialog,setReloadDialog]=useState(false);
  const [epoch,setEpoch]=useState(0);
  const sourcePath=source==='base'?'lessons':'offering-lessons';
  const path=`/api/v1/academic/organizations/${organizationId}/${sourcePath}/${lessonId}/draft`;
  const workspace=offeringId?courseOfferingPath(organizationId,offeringId):courseBasePath(organizationId,courseId!);
  const unitId=new URLSearchParams(location.search).get('unit');
  const backPath=`${workspace}?tab=content${unitId?`&unit=${encodeURIComponent(unitId)}`:''}`;
  const dirty=useMemo(()=>Boolean(draft) && snapshot!==JSON.stringify({title,document}),[draft,snapshot,title,document]);

  const load=useCallback(async(signal?:AbortSignal)=>{
    setLoading(true); setError('');setConflict(false);
    try {
      let response:Draft;
      try {response=await draftApi(path,tokenRef.current,'GET',undefined,signal);}
      catch (cause) {
        if (!(cause instanceof ApiFailure) || cause.status!==404) throw cause;
        // GET 404 significa que no existe borrador. Solo POST sobre publicación
        // puede crear uno, con comprobación transaccional en FastAPI.
        try {response=await draftApi(path,tokenRef.current,'POST',undefined,signal);}
        catch (createError) {
          if (!(createError instanceof ApiFailure) || createError.status!==409) throw createError;
          // Otro editor pudo crear el borrador entre ambas llamadas.
          response=await draftApi(path,tokenRef.current,'GET',undefined,signal);
        }
      }
      if (signal?.aborted) return;
      const normalized=canonicalLessonDocument(response.document);
      setDraft(response);setTitle(response.title);setDocument(normalized);setEpoch(value=>value+1);
      setSnapshot(JSON.stringify({title:response.title,document:normalized}));
    } catch (reason) {
      if (signal?.aborted) return;
      setError(translateRef.current('lessonEditor.noDraft'));
    } finally {if (!signal?.aborted) setLoading(false);}
  },[path]);
  useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]);
  // El enrutador de datos intercepta también los enlaces y Atrás/Adelante.
  // No bloquea cambios internos de la misma URL, ni tras confirmar el cierre.
  const blocker=useBlocker(({currentLocation,nextLocation}) =>
    shouldBlockLessonNavigation(dirty,confirmedLogout,currentLocation,nextLocation)
  );
  // El cierre de sesión no es una simple navegación: Supabase revoca el JWT.
  // Se solicita confirmación ANTES de destruir la sesión autenticada.
  useEffect(()=>{
    if (!dirty || confirmedLogout) return;
    const guard=(event:Event)=>{
      event.preventDefault();
      setLogoutDialog(true);
    };
    window.addEventListener('edumaster:before-signout',guard);
    return()=>window.removeEventListener('edumaster:before-signout',guard);
  },[dirty,confirmedLogout]);
  useEffect(()=>{
    if (!dirty) return;
    const onBeforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',onBeforeUnload);
    return()=>window.removeEventListener('beforeunload',onBeforeUnload);
  },[dirty]);

  async function save() {
    if (!draft || saving || !dirty) return;
    const cleanedTitle=title.trim();
    if (cleanedTitle.length<3 || cleanedTitle.length>180) {setError(t('lessonEditor.invalidTitle'));return;}
    setError('');setSaving(true);setConflict(false);
    try {
      const normalized=canonicalLessonDocument(document);
      const saved=await draftApi(path,tokenRef.current,'PATCH',{
        title:cleanedTitle,document:normalized,expected_lock_version:draft.lock_version,
      });
      setDraft(saved);
      // Si el usuario siguió escribiendo durante la petición, conservar
      // sus cambios posteriores en lugar de reemplazarlos con el resultado.
      setTitle(value=>value===title?cleanedTitle:value);
      setDocument(value=>JSON.stringify(value)===JSON.stringify(document)?normalized:value);
      setSnapshot(JSON.stringify({title:cleanedTitle,document:normalized}));
      notify(t('lessonEditor.saved'),'success');
    } catch (reason) {
      if (reason instanceof ApiFailure && reason.status===409) {
        setConflict(true);setError(t('lessonEditor.conflict'));
      } else if (reason instanceof ApiFailure && reason.status===422) {
        setError(t('lessonEditor.invalidDocument'));
      } else setError(t('lessonEditor.saveError'));
    } finally {setSaving(false);}
  }
  function back() { navigate(backPath); }
  function keyboard(event:KeyboardEvent<HTMLElement>) {
    if ((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='s') {
      event.preventDefault();void save();
    }
  }

  return <section className="app-lesson-page mx-auto w-full max-w-5xl space-y-4" onKeyDown={keyboard}>
    <div className="flex items-center justify-between gap-3">
      <button type="button" className="app-secondary-button inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
        onClick={back}><ArrowLeft size={17}/>{t('lessonEditor.back')}</button>
      {draft && <span className="app-muted flex items-center gap-1.5 text-xs"><ShieldCheck size={15}/>{t('lessonEditor.draft')}</span>}
    </div>
    {loading && <Spinner label={t('lessonEditor.loading')}/>}
    {error && <div role="alert" className="app-warning rounded-xl border p-3 text-sm">{error}</div>}
    {conflict && <button className="app-secondary-button flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" onClick={()=>setReloadDialog(true)}
      type="button"><RefreshCcw size={15}/>{t('lessonEditor.reload')}</button>}
    {!loading && !draft && <button className="app-secondary-button rounded-lg border px-3 py-2 text-sm" type="button" onClick={()=>void load()}>{t('workspace.retry')}</button>}
    {draft && !loading && <>
      <div className="app-panel rounded-2xl border p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">{t('lessonEditor.pageTitle')}</h1>
            <p className="app-muted mt-1 text-xs">{t(draft.base_revision_id?'lessonEditor.draftOnly':'lessonEditor.firstDraft')}</p>
          </div>
          <span className={`text-xs font-semibold ${dirty?'text-amber-600 dark:text-amber-300':'app-muted'}`} aria-live="polite">
            {t(dirty?'lessonEditor.dirty':'lessonEditor.clean')}
          </span>
        </div>
        <label className="block space-y-1.5 text-sm font-medium">
          <span>{t('lessonEditor.title')}</span>
          <input className="app-input w-full rounded-xl border px-3 py-2.5" maxLength={180} minLength={3}
            value={title} onChange={event=>setTitle(event.target.value)} disabled={saving||preview}/>
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex gap-1 rounded-xl p-1 app-editor-switch" role="group" aria-label={t('lessonEditor.pageTitle')}>
            <button type="button" aria-pressed={!preview} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${!preview?'app-editor-tab-active':''}`}
              onClick={()=>setPreview(false)}><Pencil size={15}/>{t('lessonEditor.write')}</button>
            <button type="button" aria-pressed={preview} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${preview?'app-editor-tab-active':''}`}
              onClick={()=>setPreview(true)}><Eye size={15}/>{t('lessonEditor.preview')}</button>
          </div>
          <span className="app-muted text-xs">{t('lessonEditor.noPublish')}</span>
        </div>
        {preview ? <RichTextEditor key={`preview-${draft.id}-${epoch}`} value={document} readOnly/>
          : <RichTextEditor key={`edit-${draft.id}-${epoch}`} value={document} onChange={setDocument}/>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" className="app-primary-button inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            disabled={saving||!dirty||preview} onClick={()=>void save()}><Save size={17}/>{saving?t('lessonEditor.saving'):t('lessonEditor.save')}</button>
        </div>
      </div>
      <LessonResources draftPath={path} token={token} preview={preview}/>
    </>}
    <Modal open={blocker.state==='blocked'} title={t('lessonEditor.dirty')}
      onClose={()=>{if(blocker.state==='blocked') blocker.reset();}}>
      <p className="text-sm">{t('lessonEditor.confirmLeave')}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="app-secondary-button rounded-lg border px-3 py-2 text-sm"
          onClick={()=>{if(blocker.state==='blocked') blocker.reset();}}>{t('common.cancel')}</button>
        <button type="button" className="app-primary-button rounded-lg px-3 py-2 text-sm"
          onClick={()=>{if(blocker.state==='blocked') blocker.proceed();}}>{t('lessonEditor.discardLeave')}</button>
      </div>
    </Modal>
    <Modal open={logoutDialog} title={t('lessonEditor.dirty')} onClose={()=>setLogoutDialog(false)}>
      <p className="text-sm">{t('lessonEditor.confirmLeave')}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="app-secondary-button rounded-lg border px-3 py-2 text-sm"
          onClick={()=>setLogoutDialog(false)}>{t('common.cancel')}</button>
        <button type="button" className="app-primary-button rounded-lg px-3 py-2 text-sm"
          onClick={()=>{
            setConfirmedLogout(true);setLogoutDialog(false);
            // Si Supabase falla, el editor recupera su protección de salida.
            void onConfirmSignOut().then(success=>{if(!success)setConfirmedLogout(false);})
              .catch(()=>setConfirmedLogout(false));
          }}>{t('lessonEditor.discardSignout')}</button>
      </div>
    </Modal>
    <Modal open={reloadDialog} title={t('lessonEditor.reload')} onClose={()=>setReloadDialog(false)}>
      <p className="text-sm">{t('lessonEditor.reloadConfirm')}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button className="app-secondary-button rounded-lg border px-3 py-2 text-sm" onClick={()=>setReloadDialog(false)}>{t('common.cancel')}</button>
        <button className="app-primary-button rounded-lg px-3 py-2 text-sm" onClick={()=>{setReloadDialog(false);void load();}}>{t('lessonEditor.reload')}</button>
      </div>
    </Modal>
  </section>;
}

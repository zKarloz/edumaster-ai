/** CAMBIOS 21 v30.2.7 · Crear una lección directamente con Tiptap.
 * FastAPI autoriza la unidad, crea el borrador y valida después el documento.
 * Una petición fallida de guardado NO crea duplicados: se reutiliza el ID creado.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { JSONContent } from '@tiptap/core';
import { useBlocker, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Save, ShieldCheck } from 'lucide-react';
import { RichTextEditor } from '../../components/shared/RichTextEditor';
import { Modal } from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';
import { canonicalLessonDocument } from './lessonDocument';
import { courseBasePath, courseOfferingPath, lessonEditorPath, type LessonSource } from '../../routes';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const emptyDocument: JSONContent = {type:'doc',content:[{type:'paragraph'}]};
interface Props {
  organizationId:string; offeringId?:string; courseId?:string;
  unitId:string; source:LessonSource; token:string; onConfirmSignOut:()=>Promise<boolean>;
}
interface DraftResult {lock_version:number}
const copy = {
  es: {heading:'Nueva lección',hint:'Escribe el título y el contenido con el editor. Los recursos y el historial estarán disponibles al guardar el borrador.',
    create:'Crear lección y guardar borrador',cancel:'Cancelar',error:'No se pudo guardar la lección. Puedes reintentar sin crear otra.',
    unsaved:'Hay contenido sin guardar. ¿Salir sin crear la lección?',leave:'Salir sin guardar'},
  en: {heading:'New lesson',hint:'Write the title and content with the editor. Resources and version history are available after saving the draft.',
    create:'Create lesson and save draft',cancel:'Cancel',error:'Could not save the lesson. You can retry without creating a duplicate.',
    unsaved:'You have unsaved content. Leave without creating the lesson?',leave:'Leave without saving'},
  pt: {heading:'Nova lição',hint:'Escreva o título e o conteúdo com o editor. Recursos e histórico ficam disponíveis após salvar o rascunho.',
    create:'Criar lição e salvar rascunho',cancel:'Cancelar',error:'Não foi possível salvar a lição. É possível tentar novamente sem duplicar.',
    unsaved:'Há conteúdo não salvo. Sair sem criar a lição?',leave:'Sair sem salvar'},
} as const;

/** Presenta un error legible sin exponer trazas internas ni tokens. */
async function authorizedJson<T>(path:string,token:string,init:RequestInit={}):Promise<T>{
  const response=await fetch(`${API}${path}`,{
    ...init,headers:{Authorization:`Bearer ${token}`,...init.headers},
  });
  if(!response.ok){
    const body=await response.json().catch(()=>({})) as {detail?:unknown};
    throw new Error(typeof body.detail==='string'?body.detail:`HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function LessonCreatePage({organizationId,offeringId,courseId,unitId,source,token,onConfirmSignOut}:Props){
  const {t,i18n}=useTranslation();
  const locale=i18n.language.startsWith('pt')?'pt':i18n.language.startsWith('en')?'en':'es';
  const labels=copy[locale];
  const {notify}=useToast();
  const navigate=useNavigate();
  const [title,setTitle]=useState('');
  const [document,setDocument]=useState<JSONContent>(emptyDocument);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [logoutDialog,setLogoutDialog]=useState(false);
  const [confirmedLogout,setConfirmedLogout]=useState(false);
  const skipBlock=useRef(false);
  // Se guarda el ID tan pronto responde el POST, incluso si falla el PATCH.
  const createdId=useRef<string|null>(null);
  const workspace=offeringId?courseOfferingPath(organizationId,offeringId):courseBasePath(organizationId,courseId!);
  const backPath=`${workspace}?tab=content&unit=${encodeURIComponent(unitId)}`;
  const dirty=useMemo(()=>Boolean(title.trim()) || JSON.stringify(document)!==JSON.stringify(emptyDocument),[title,document]);
  const blocker=useBlocker(({currentLocation,nextLocation})=>
    !skipBlock.current && !confirmedLogout && dirty && (currentLocation.pathname!==nextLocation.pathname || currentLocation.search!==nextLocation.search));
  useEffect(()=>{
    if(!dirty)return;
    const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',guard);
    return()=>window.removeEventListener('beforeunload',guard);
  },[dirty]);

  // Consistente con LessonEditorPage: el cierre de sesión no descarta
  // silenciosamente un documento sin guardar.
  useEffect(()=>{
    if(!dirty || confirmedLogout)return;
    const guard=(event:Event)=>{event.preventDefault();setLogoutDialog(true);};
    window.addEventListener('edumaster:before-signout',guard);
    return()=>window.removeEventListener('edumaster:before-signout',guard);
  },[dirty,confirmedLogout]);

  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy||title.trim().length<3||title.trim().length>180)return;
    setBusy(true);setError('');
    try{
      // Validación local idéntica al contrato documental del editor existente.
      const normalized=canonicalLessonDocument(document);
      const collection=source==='base'?`course-modules/${unitId}/lessons`:`offering-modules/${unitId}/lessons`;
      const root=`/api/v1/academic/organizations/${organizationId}`;
      if(!createdId.current){
        const created=await authorizedJson<{id:string}>(`${root}/${collection}`,token,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({title:title.trim(),content:null}),
        });
        createdId.current=created.id;
      }
      const id=createdId.current;
      if (!id) throw new Error(labels.error);
      const draftPath=`${root}/${source==='base'?'lessons':'offering-lessons'}/${id}/draft`;
      const draft=await authorizedJson<DraftResult>(draftPath,token);
      await authorizedJson(draftPath,token,{
        method:'PATCH',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({title:title.trim(),document:normalized,expected_lock_version:draft.lock_version}),
      });
      notify(t('lessonEditor.saved'),'success');
      skipBlock.current=true;
      navigate(`${lessonEditorPath(organizationId,id,source,offeringId,courseId)}?unit=${encodeURIComponent(unitId)}`,{replace:true});
    }catch(reason){setError(reason instanceof Error?reason.message:labels.error);}
    finally{setBusy(false);}
  }

  return <section className="w-full space-y-4">
    <button type="button" className="app-secondary-button inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
      onClick={()=>navigate(backPath)}><ArrowLeft size={17}/>{t('lessonEditor.back')}</button>
    <form className="app-panel space-y-4 rounded-2xl border p-4 sm:p-6" onSubmit={event=>void save(event)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">{labels.heading}</h1>
        <span className="app-muted inline-flex items-center gap-1 text-xs"><ShieldCheck size={15}/>{t('lessonEditor.draft')}</span>
      </div>
      <p className="app-muted text-sm">{labels.hint}</p>
      <label className="block space-y-1.5 text-sm font-medium">
        <span>{t('lessonEditor.title')}</span>
        <input className="app-input w-full rounded-xl border px-3 py-2.5" minLength={3} maxLength={180}
          required value={title} onChange={event=>setTitle(event.target.value)} disabled={busy}/>
      </label>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">{t('lessonEditor.format')}</h2>
        <RichTextEditor value={document} onChange={setDocument} readOnly={busy}/>
      </div>
      {error&&<div role="alert" className="app-warning rounded-xl border p-3 text-sm">{error}</div>}
      <div className="flex justify-end">
        <button type="submit" className="app-primary-button inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          disabled={busy||title.trim().length<3}><Save size={17}/>{busy?t('workspace.saving'):labels.create}</button>
      </div>
    </form>
    <Modal open={logoutDialog} title={t('lessonEditor.dirty')} onClose={()=>setLogoutDialog(false)}>
      <p className="text-sm">{labels.unsaved}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="app-secondary-button rounded-lg border px-3 py-2" onClick={()=>setLogoutDialog(false)}>{labels.cancel}</button>
        <button type="button" className="app-primary-button rounded-lg px-3 py-2" onClick={()=>{
          setConfirmedLogout(true);setLogoutDialog(false);
          void onConfirmSignOut().then(ok=>{if(!ok)setConfirmedLogout(false);}).catch(()=>setConfirmedLogout(false));
        }}>{t('lessonEditor.discardSignout')}</button>
      </div>
    </Modal>
    <Modal open={blocker.state==='blocked'} title={t('lessonEditor.dirty')}
      onClose={()=>{if(blocker.state==='blocked')blocker.reset();}}>
      <p className="text-sm">{labels.unsaved}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="app-secondary-button rounded-lg border px-3 py-2" onClick={()=>{if(blocker.state==='blocked')blocker.reset();}}>{labels.cancel}</button>
        <button type="button" className="app-primary-button rounded-lg px-3 py-2" onClick={()=>{if(blocker.state==='blocked')blocker.proceed();}}>{labels.leave}</button>
      </div>
    </Modal>
  </section>;
}

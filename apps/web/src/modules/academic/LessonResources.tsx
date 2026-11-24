/** Recursos privados de una revisión de lección (v29.2).
 * Nunca se consulta Storage desde el navegador con claves privilegiadas.
 * La API comprueba permisos antes de emitir enlaces de descarga temporales.
 */
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, FileText, Image as ImageIcon, Link2, Paperclip, Plus, Trash2, Upload } from 'lucide-react';
import { Modal } from '../../components/shared/Modal';
import { Spinner } from '../../components/shared/Spinner';
import { useToast } from '../../components/shared/Toast';

const API=import.meta.env.VITE_API_URL || 'http://localhost:8000';
const MAX_BYTES=10*1024*1024;
const ALLOWED_TYPES=new Set(['application/pdf','image/png','image/jpeg','image/webp']);

type Resource={id:string;kind:'file'|'link';title:string;url:string|null;position:number;filename?:string;media_type?:string;size_bytes?:number};
type Props={draftPath:string;token:string;preview:boolean};

async function resourceApi<T>(path:string,token:string,options:RequestInit={}) {
  const response=await fetch(`${API}${path}`,{...options,headers:{Authorization:`Bearer ${token}`,...options.headers}});
  if (!response.ok) throw new Error(`Resource request: ${response.status}`);
  return response.json() as Promise<T>;
}

export function LessonResources({draftPath,token,preview}:Props) {
  const {t}=useTranslation();
  const {notify}=useToast();
  const path=draftPath.replace(/\/draft$/,'/resources');
  const fileInput=useRef<HTMLInputElement>(null);
  const [resources,setResources]=useState<Resource[]>([]);
  const [isLoading,setIsLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [problem,setProblem]=useState(false);
  const [newTitle,setNewTitle]=useState('');
  const [newUrl,setNewUrl]=useState('');
  const [removeItem,setRemoveItem]=useState<Resource|null>(null);

  const reload=useCallback(async(signal?:AbortSignal)=>{
    setIsLoading(true);setProblem(false);
    try {
      const result=await resourceApi<{items:Resource[]}>(path,token,{signal});
      if(!signal?.aborted)setResources(result.items);
    } catch {
      if(!signal?.aborted)setProblem(true);
    } finally {if(!signal?.aborted)setIsLoading(false);}
  },[path,token]);
  useEffect(()=>{const controller=new AbortController();void reload(controller.signal);return()=>controller.abort();},[reload]);

  async function addLink(){
    if(busy)return;
    const title=newTitle.trim(); const url=newUrl.trim();
    if(!title||!url.startsWith('https://')){notify(t('lessonResources.invalidLink'),'info');return;}
    setBusy(true);
    try{
      await resourceApi(`${path}/links`,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,url})});
      setNewTitle('');setNewUrl('');notify(t('lessonResources.added'),'success');await reload();
    }catch{notify(t('lessonResources.failed'),'info');}finally{setBusy(false);}
  }

  async function uploadFile(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];if(!file||busy)return;
    event.target.value='';
    if(file.size>MAX_BYTES||file.size===0||!ALLOWED_TYPES.has(file.type)){
      notify(t('lessonResources.invalidFile'),'info');return;
    }
    setBusy(true);
    try{
      const filename=encodeURIComponent(file.name);
      await resourceApi(`${path}/files?filename=${filename}`,token,{
        method:'POST',headers:{'Content-Type':file.type},body:file,
      });
      notify(t('lessonResources.added'),'success');await reload();
    }catch{notify(t('lessonResources.failed'),'info');}finally{setBusy(false);}
  }

  async function openFile(item:Resource){
    // Abrir primero la pestaña evita el bloqueo de ventanas emergentes que
    // los navegadores aplican cuando la URL llega tras una petición asíncrona.
    const popup=window.open('about:blank','_blank');
    if(popup)popup.opener=null;
    try {
      const data=await resourceApi<{url:string;expires_in:number}>(`${path}/${item.id}/download`,token);
      // Solo URLs de nuestro proyecto Storage, sin origen controlado por usuario.
      // Sin URL pública de proyecto no es seguro aceptar una URL firmada.
      const supabaseUrl=import.meta.env.VITE_SUPABASE_URL;
      if(!supabaseUrl)throw new Error('Supabase URL not configured');
      const original=new URL(supabaseUrl);
      const target=new URL(data.url);
      if(target.origin!==original.origin||!target.pathname.startsWith('/storage/v1/object/sign/course-resources/'))throw new Error('Signed URL origin');
      if(popup)popup.location.href=target.toString();
      else notify(t('lessonResources.popupBlocked'),'info');
    }catch{popup?.close();notify(t('lessonResources.failed'),'info');}
  }

  async function confirmRemove(){
    if(!removeItem||busy)return;
    setBusy(true);
    try{
      await resourceApi(`${path}/${removeItem.id}`,token,{method:'DELETE'});
      setRemoveItem(null);notify(t('lessonResources.removed'),'success');await reload();
    }catch{notify(t('lessonResources.failed'),'info');}finally{setBusy(false);}
  }

  return <section className="app-panel rounded-2xl border p-4 sm:p-5 space-y-4" aria-label={t('lessonResources.heading')}>
    <div className="flex flex-wrap items-center gap-2">
      <Paperclip size={19}/><h2 className="font-semibold">{t('lessonResources.heading')}</h2>
      <span className="app-muted text-xs">{t('lessonResources.draftHint')}</span>
    </div>
    {isLoading&&<Spinner label={t('common.loading')}/>}
    {problem&&<button type="button" className="app-secondary-button rounded-xl border px-3 py-2 text-sm" onClick={()=>void reload()}>{t('lessonResources.reload')}</button>}
    {!isLoading&&!problem&&<div className="space-y-2">
      {resources.length===0&&<p className="app-muted text-sm">{t('lessonResources.empty')}</p>}
      {resources.map(item=><div key={item.id} className="app-editor-resource-item flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5">
        {item.kind==='link'?<Link2 size={17} aria-hidden="true"/>:item.media_type?.startsWith('image/')?<ImageIcon size={17} aria-hidden="true"/>:<FileText size={17} aria-hidden="true"/>}
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{item.title}</div>{item.kind==='file'&&<p className="app-muted text-xs">{Math.ceil((item.size_bytes??0)/1024)} KB</p>}</div>
        {item.kind==='link'&&item.url&&<a className="app-secondary-button inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs" href={item.url} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink size={14}/>{t('lessonResources.open')}</a>}
        {item.kind==='file'&&<button className="app-secondary-button inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs" type="button" onClick={()=>void openFile(item)}><ExternalLink size={14}/>{t('lessonResources.open')}</button>}
        {!preview&&<button className="app-secondary-button rounded-lg border p-2" type="button" aria-label={t('lessonResources.remove')} onClick={()=>setRemoveItem(item)} disabled={busy}><Trash2 size={16}/></button>}
      </div>)}
    </div>}
    {!preview&&<div className="grid gap-3 border-t pt-4 md:grid-cols-2">
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('lessonResources.addLink')}</p>
        <input className="app-input w-full rounded-xl border px-3 py-2 text-sm" placeholder={t('lessonResources.linkTitle')} maxLength={180} value={newTitle} onChange={event=>setNewTitle(event.target.value)}/>
        <input className="app-input w-full rounded-xl border px-3 py-2 text-sm" placeholder="https://..." type="url" value={newUrl} onChange={event=>setNewUrl(event.target.value)}/>
        <button type="button" disabled={busy} className="app-secondary-button inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-50" onClick={()=>void addLink()}><Plus size={16}/>{t('lessonResources.add')}</button>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('lessonResources.addFile')}</p>
        <p className="app-muted text-xs">{t('lessonResources.limits')}</p>
        <input ref={fileInput} type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={event=>void uploadFile(event)}/>
        <button type="button" disabled={busy} className="app-secondary-button inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-50" onClick={()=>fileInput.current?.click()}><Upload size={17}/>{t('lessonResources.choose')}</button>
      </div>
    </div>}
    <Modal open={removeItem!==null} title={t('lessonResources.remove')} onClose={()=>setRemoveItem(null)}>
      <p className="text-sm">{t('lessonResources.confirmRemove')}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="app-secondary-button rounded-lg border px-3 py-2 text-sm" onClick={()=>setRemoveItem(null)}>{t('common.cancel')}</button>
        <button type="button" className="app-primary-button rounded-lg px-3 py-2 text-sm" disabled={busy} onClick={()=>void confirmRemove()}>{t('lessonResources.remove')}</button>
      </div>
    </Modal>
  </section>;
}

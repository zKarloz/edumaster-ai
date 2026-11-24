/** CAMBIOS 21 v30.2 · adjuntos privados de tareas.
 * Se reutiliza en el formulario del estudiante y en el historial docente.
 * Ninguna URL de Storage ni clave privilegiada se guarda en el cliente.
 */
import { useCallback, useEffect, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { Download, FilePlus2, LoaderCircle, Paperclip, Trash2 } from 'lucide-react';
import { useToast } from '../../components/shared/Toast';

export interface TaskFile {
  id: string;
  filename: string;
  media_type: string;
  size_bytes: number;
}

interface SharedProps { root:string; taskId:string; token:string; locale:'es'|'en'|'pt' }
interface StageProps extends SharedProps {
  onCountChange:Dispatch<SetStateAction<number>>;
  onBusyChange:Dispatch<SetStateAction<boolean>>;
}
interface HistoryProps extends SharedProps { submissionId:string }

const secondary='app-secondary-button inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-50';
const text={
  es:{files:'Archivos adjuntos', add:'Adjuntar PDF o imagen', remove:'Quitar', open:'Abrir archivo',
    prepare:'Preparar descarga', empty:'Sin archivos adjuntos', hint:'Hasta 3 archivos · máximo 10 MB cada uno · PDF, PNG, JPG o WebP.',
    loaded:'Archivo adjuntado.', removed:'Archivo retirado.', error:'No se pudo completar la operación.',
    signed:'Acceso temporal (60 segundos)', loading:'Cargando archivos...', limit:'Máximo tres archivos.', oversized:'Archivo demasiado grande (máximo 10 MB).'},
  en:{files:'Attachments', add:'Attach PDF or image', remove:'Remove', open:'Open file',
    prepare:'Prepare download', empty:'No attached files', hint:'Up to 3 files · 10 MB each · PDF, PNG, JPG or WebP.',
    loaded:'File attached.', removed:'File removed.', error:'Could not complete the operation.',
    signed:'Temporary access (60 seconds)', loading:'Loading attachments...', limit:'Three files maximum.', oversized:'File too large (10 MB maximum).'},
  pt:{files:'Anexos', add:'Anexar PDF ou imagem', remove:'Remover', open:'Abrir arquivo',
    prepare:'Preparar download', empty:'Sem anexos', hint:'Até 3 arquivos · 10 MB cada · PDF, PNG, JPG ou WebP.',
    loaded:'Arquivo anexado.', removed:'Arquivo removido.', error:'Não foi possível concluir.',
    signed:'Acesso temporário (60 segundos)', loading:'Carregando anexos...', limit:'No máximo três arquivos.', oversized:'Arquivo muito grande (máximo 10 MB).'},
} as const;
const API=import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function api<T>(path:string, token:string, init:RequestInit={}):Promise<T>{
  const response=await fetch(`${API}${path}`,{
    ...init, headers:{Authorization:`Bearer ${token}`,...init.headers},
  });
  if(!response.ok){
    const body=await response.json().catch(()=>({})) as {detail?:string};
    throw new Error(typeof body.detail==='string'?body.detail:`HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

/** Nombre y tamaño no permiten manipular rutas privadas. */
function FileDescription({item}:{item:TaskFile}){
  return <span className="min-w-0 flex-1 truncate text-sm" title={item.filename}>
    <Paperclip size={14} className="mr-1 inline"/>{item.filename}
    <span className="app-muted ml-1 text-xs">({Math.ceil(item.size_bytes/1024)} KB)</span>
  </span>;
}

export function TaskStagedFiles({root,taskId,token,locale,onCountChange,onBusyChange}:StageProps){
  const t=text[locale];const {notify}=useToast();
  const [items,setItems]=useState<TaskFile[]>([]);
  const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
  const path=`${root}/${taskId}/attachments`;
  const refresh=useCallback(async()=>{
    const data=await api<{items:TaskFile[]}>(`${path}/staged`,token);
    setItems(data.items);onCountChange(data.items.length);
  },[path,token,onCountChange]);
  useEffect(()=>{
    let active=true;
    void api<{items:TaskFile[]}>(`${path}/staged`,token).then(data=>{
      if(active){setItems(data.items);onCountChange(data.items.length);}
    }).catch(e=>{if(active)notify(e instanceof Error?e.message:t.error);})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[path,token,onCountChange,notify,t.error]);
  useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false);},[busy,onBusyChange]);
  async function upload(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];event.target.value='';
    if(!file||busy)return;
    if(file.size>10*1024*1024){notify(t.oversized);return;}
    if(items.length>=3){notify(t.limit);return;}
    setBusy(true);
    try{
      await api<TaskFile>(`${path}?filename=${encodeURIComponent(file.name)}`,token,{
        method:'POST',headers:{'Content-Type':file.type},body:file,
      });
      await refresh();notify(t.loaded,'success');
    }catch(e){notify(e instanceof Error?e.message:t.error);}
    finally{setBusy(false);}
  }
  async function remove(id:string){
    if(busy)return;setBusy(true);
    try{
      await api<{deleted:boolean}>(`${path}/${id}`,token,{method:'DELETE'});
      await refresh();notify(t.removed,'success');
    }catch(e){notify(e instanceof Error?e.message:t.error);}
    finally{setBusy(false);}
  }
  return <div className="space-y-2 rounded-xl border p-3">
    <p className="text-sm font-semibold"><Paperclip size={15} className="mr-1 inline"/>{t.files} ({items.length}/3)</p>
    <p className="app-muted text-xs">{t.hint}</p>
    {loading&&<p className="app-muted text-xs"><LoaderCircle size={14} className="mr-1 inline animate-spin"/>{t.loading}</p>}
    {items.map(item=><div key={item.id} className="flex min-w-0 items-center gap-2 rounded-lg border p-2">
      <FileDescription item={item}/>
      <button type="button" className={secondary} onClick={()=>void remove(item.id)} disabled={busy} aria-label={`${t.remove}: ${item.filename}`}><Trash2 size={15}/>{t.remove}</button>
    </div>)}
    <label className={`${secondary} cursor-pointer ${busy||loading||items.length>=3?'pointer-events-none opacity-50':''}`}>
      <FilePlus2 size={16}/>{t.add}
      <input type="file" className="sr-only" disabled={busy||loading||items.length>=3}
        accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" onChange={e=>void upload(e)}/>
    </label>
  </div>;
}

/** Lista bajo demanda: no genera URL firmada hasta que se pide abrir. */
export function TaskSubmissionFileList({root,taskId,submissionId,token,locale}:HistoryProps){
  const t=text[locale];const {notify}=useToast();
  const [expanded,setExpanded]=useState(false);
  const [items,setItems]=useState<TaskFile[]>([]);
  const [busyId,setBusyId]=useState<string|null>(null);
  const [links,setLinks]=useState<Record<string,string>>({});
  const endpoint=`${root}/${taskId}/submissions/${submissionId}/attachments`;
  async function toggle(){
    if(expanded){setExpanded(false);setLinks({});return;}
    try{
      const data=await api<{items:TaskFile[]}>(endpoint,token);
      setItems(data.items);setExpanded(true);
    }catch(e){notify(e instanceof Error?e.message:t.error);}
  }
  async function sign(id:string){
    setBusyId(id);
    try{
      const response=await api<{url:string;expires_in:number}>(`${endpoint}/${id}/download`,token);
      setLinks(old=>({...old,[id]:response.url}));
    }catch(e){notify(e instanceof Error?e.message:t.error);}
    finally{setBusyId(null);}
  }
  return <div className="space-y-2">
    <button type="button" className={secondary} onClick={()=>void toggle()}>
      <Paperclip size={15}/>{expanded?'−': '+'} {t.files}
    </button>
    {expanded&&<div className="space-y-2 rounded-lg border p-2">
      {items.length===0&&<p className="app-muted text-xs">{t.empty}</p>}
      {items.map(item=><div className="flex flex-wrap items-center gap-2" key={item.id}>
        <FileDescription item={item}/>
        {links[item.id]?<a className={secondary} href={links[item.id]} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
          <Download size={14}/>{t.open} · {t.signed}
        </a>:<button type="button" className={secondary} disabled={busyId!==null} onClick={()=>void sign(item.id)}><Download size={14}/>{t.prepare}</button>}
      </div>)}
    </div>}
  </div>;
}

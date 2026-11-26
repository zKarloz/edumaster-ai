/** Registro global DEMO. La API vuelve a verificar el rol en cada solicitud. */
import { useEffect, useState, useRef } from 'react';
import { Cloud, FolderOpen, Archive, RefreshCw, ArchiveRestore } from 'lucide-react';
import { Modal } from '../../../components/shared/Modal';
import { useToast } from '../../../components/shared/Toast';
import type { Locale } from '../../../i18n';
import type { LocalCheckpoint } from '../ml/checkpoint';

type Item = { id: string; created_at: string; archived_at: string | null };
type Action = 'list' | 'save' | 'load' | 'archive' | 'restore';
type Confirmation = { id: string; action: 'archive' | 'restore' };
const words = {
 es: {title:'Registro central DEMO',note:'Candidatos no verificados. No autorizados para decisiones académicas.',save:'Registrar modelo actual',list:'Actualizar',load:'Recuperar',archive:'Archivar',restore:'Restaurar',askArchive:'¿Archivar este candidato?',askRestore:'¿Restaurar este candidato archivado?',cancel:'Cancelar',archived:'Archivado',empty:'No hay registros.',saved:'Modelo registrado.',loaded:'Modelo recuperado sin reentrenar.',archivedDone:'Modelo archivado.',restored:'Modelo restaurado. Ya está disponible para recuperar.',listed:'Registro actualizado.',error:'No se pudo completar la operación.',refreshError:'La operación se completó, pero no se pudo actualizar la lista. Pulsa Actualizar.'},
 en: {title:'Central DEMO registry',note:'Unverified candidates. Not authorized for academic decisions.',save:'Register current model',list:'Refresh',load:'Load',archive:'Archive',restore:'Unarchive',askArchive:'Archive this candidate?',askRestore:'Restore this archived candidate?',cancel:'Cancel',archived:'Archived',empty:'No records.',saved:'Model registered.',loaded:'Model loaded without retraining.',archivedDone:'Model archived.',restored:'Model restored and available to load.',listed:'Registry refreshed.',error:'Operation failed.',refreshError:'Operation completed, but the list could not be refreshed. Select Refresh.'},
 pt: {title:'Registro central DEMO',note:'Candidatos não verificados. Não autorizados para decisões acadêmicas.',save:'Registrar modelo atual',list:'Atualizar',load:'Recuperar',archive:'Arquivar',restore:'Restaurar',askArchive:'Arquivar este candidato?',askRestore:'Restaurar este candidato arquivado?',cancel:'Cancelar',archived:'Arquivado',empty:'Nenhum registro.',saved:'Modelo registrado.',loaded:'Modelo recuperado sem novo treinamento.',archivedDone:'Modelo arquivado.',restored:'Modelo restaurado e disponível para recuperação.',listed:'Registro atualizado.',error:'Falha na operação.',refreshError:'Operação concluída, mas não foi possível atualizar a lista. Selecione Atualizar.'},
} as const;

export function RemoteModels({locale,token,blocked,visible,checkpoint,onRestore,onBusy}:{visible:boolean;locale:Locale;token:string;blocked:boolean;checkpoint:()=>LocalCheckpoint|null;onRestore:(value:unknown)=>boolean;onBusy:(v:boolean)=>void}) {
 const t = words[locale];
 const { notify } = useToast();
 const [items,setItems] = useState<Item[]>([]);
 const [busy,setBusy] = useState(false);
 const [confirm,setConfirm] = useState<Confirmation|null>(null);
 const lock = useRef(false);
 const mounted = useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{if(!visible)setConfirm(null);},[visible]);
 async function call(path='',method='GET',body?:LocalCheckpoint) {
  const response=await fetch(`${import.meta.env.VITE_API_URL||'http://localhost:8000'}/api/v1/neural-demo/models${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw new Error(String(response.status));
  return response.json();
 }
 // Confirmar la mutación antes de notificar; un fallo de refresco no invalida el guardado.
 async function run(action:Action,id?:string) {
  if(lock.current||blocked)return;
  lock.current=true;setBusy(true);onBusy(true);
  try {
   if(action==='save'){const value=checkpoint();if(!value)throw new Error('checkpoint');await call('','POST',value);}
   if(action==='load'){const value=await call(`/${id}`);if(!mounted.current)return;if(!onRestore(value))throw new Error('invalid');}
   if(action==='archive'||action==='restore')await call(`/${id}/${action}`,'PATCH');
   if(!mounted.current)return;
   const success={list:t.listed,save:t.saved,load:t.loaded,archive:t.archivedDone,restore:t.restored}[action];
   if(action!=='list')notify(success,'success');
   if(action!=='load'){
    try {const data=await call();if(mounted.current){setItems(data.items);if(action==='list')notify(success,'success');}}
    catch {if(mounted.current)notify(action==='list'?t.error:t.refreshError,'info');}
   }
  }catch{if(mounted.current)notify(t.error,'info');}
  finally{lock.current=false;if(mounted.current){onBusy(false);setBusy(false);}}
 }
 const cls='app-secondary-button inline-flex items-center gap-2 rounded-lg border border-[var(--app-control-border)] px-3 py-2 text-sm';
 return <section className="space-y-3 rounded-xl border border-[var(--app-panel-border)] p-4">
  <h4 className="flex items-center gap-2 font-semibold"><Cloud size={18}/>{t.title}</h4><p className="app-muted text-sm">{t.note}</p>
  <div className="flex flex-wrap gap-2"><button className={cls} disabled={busy||blocked||!checkpoint()} onClick={()=>void run('save')}>{t.save}</button><button className={cls} disabled={busy||blocked} onClick={()=>void run('list')}><RefreshCw size={16}/>{t.list}</button></div>
  <div className="space-y-2">{items.length===0&&<p className="app-muted text-sm">{t.empty}</p>}{items.map(item=><div key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--app-control-border)] p-3">
   <div className="min-w-0 flex-1"><p className="font-mono text-xs break-all">{item.id}</p><p className="app-muted text-xs">{new Date(item.created_at).toLocaleString(locale)}{item.archived_at?` · ${t.archived}`:''}</p></div>
   {item.archived_at?<button className={cls} disabled={busy||blocked} onClick={()=>setConfirm({id:item.id,action:'restore'})}><ArchiveRestore size={15}/>{t.restore}</button>:<><button className={cls} disabled={busy||blocked} onClick={()=>void run('load',item.id)}><FolderOpen size={15}/>{t.load}</button><button className={cls} disabled={busy||blocked} onClick={()=>setConfirm({id:item.id,action:'archive'})}><Archive size={15}/>{t.archive}</button></>}
  </div>)}</div>
  <Modal open={visible&&confirm!==null} title={confirm?.action==='restore'?t.restore:t.archive} onClose={()=>setConfirm(null)}><p>{confirm?.action==='restore'?t.askRestore:t.askArchive}</p><div className="mt-4 flex justify-end gap-2"><button className={cls} onClick={()=>setConfirm(null)}>{t.cancel}</button><button className={cls} disabled={busy||blocked} onClick={()=>{const selected=confirm;setConfirm(null);if(selected)void run(selected.action,selected.id);}}>{confirm?.action==='restore'?t.restore:t.archive}</button></div></Modal>
 </section>;
}

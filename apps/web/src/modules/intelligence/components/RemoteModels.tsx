/** Registro global DEMO. La API vuelve a verificar el rol en cada solicitud. */
import {useEffect,useState,useRef} from 'react';
import {Cloud,FolderOpen,Archive,RefreshCw} from 'lucide-react';
import {Modal} from '../../../components/shared/Modal';
import type {Locale} from '../../../i18n';
import type {LocalCheckpoint} from '../ml/checkpoint';
type Item={id:string;created_at:string;archived_at:string|null};
const words={es:['Registro central DEMO','Candidatos no verificados. No autorizados para decisiones académicas.','Registrar modelo actual','Actualizar','Recuperar','Archivar','¿Archivar este candidato?','Cancelar','Operación completada','No se pudo completar la operación.','Archivado','No hay registros.'],en:['Central DEMO registry','Unverified candidates. Not authorized for academic decisions.','Register current model','Refresh','Restore','Archive','Archive this candidate?','Cancel','Operation completed','Operation failed.','Archived','No records.'],pt:['Registro central DEMO','Candidatos não verificados. Não autorizados para decisões acadêmicas.','Registrar modelo atual','Atualizar','Recuperar','Arquivar','Arquivar este candidato?','Cancelar','Operação concluída','Falha na operação.','Arquivado','Nenhum registro.']} as const;
export function RemoteModels({locale,token,blocked,visible,checkpoint,onRestore,onBusy}:{visible:boolean;locale:Locale;token:string;blocked:boolean;checkpoint:()=>LocalCheckpoint|null;onRestore:(value:unknown)=>boolean;onBusy:(v:boolean)=>void}){
 const t=words[locale];const [items,setItems]=useState<Item[]>([]);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [confirm,setConfirm]=useState<string|null>(null);const lock=useRef(false);const mounted=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{if(!visible)setConfirm(null);},[visible]);
 async function call(path='',method='GET',body?:LocalCheckpoint){const response=await fetch(`${import.meta.env.VITE_API_URL||'http://localhost:8000'}/api/v1/neural-demo/models${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!response.ok)throw new Error(String(response.status));return response.json();}
 async function run(action:'list'|'save'|'load'|'archive',id?:string){if(lock.current||blocked)return;lock.current=true;setBusy(true);onBusy(true);setMessage('');try{
  if(action==='save'){const value=checkpoint();if(!value)throw new Error('checkpoint');await call('','POST',value);}
  if(action==='load'){const value=await call(`/${id}`);if(!mounted.current)return;if(!onRestore(value))throw new Error('invalid');}
  if(action==='archive')await call(`/${id}/archive`,'PATCH');
  if(action!=='load'){const data=await call();if(mounted.current)setItems(data.items);}
  if(mounted.current)setMessage(t[8]);
 }catch{if(mounted.current)setMessage(t[9]);}finally{lock.current=false;onBusy(false);if(mounted.current)setBusy(false);}}
 const cls='app-secondary-button inline-flex items-center gap-2 rounded-lg border border-[var(--app-control-border)] px-3 py-2 text-sm';
 return <section className="space-y-3 rounded-xl border border-[var(--app-panel-border)] p-4"><h4 className="flex items-center gap-2 font-semibold"><Cloud size={18}/>{t[0]}</h4><p className="app-muted text-sm">{t[1]}</p><div className="flex flex-wrap gap-2"><button className={cls} disabled={busy||blocked||!checkpoint()} onClick={()=>void run('save')}>{t[2]}</button><button className={cls} disabled={busy||blocked} onClick={()=>void run('list')}><RefreshCw size={16}/>{t[3]}</button></div>
 <div className="space-y-2">{items.length===0&&<p className="app-muted text-sm">{t[11]}</p>}{items.map(item=><div key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--app-control-border)] p-3"><div className="min-w-0 flex-1"><p className="font-mono text-xs">{item.id}</p><p className="app-muted text-xs">{new Date(item.created_at).toLocaleString(locale)}{item.archived_at?` · ${t[10]}`:''}</p></div>{!item.archived_at&&<><button className={cls} disabled={busy||blocked} onClick={()=>void run('load',item.id)}><FolderOpen size={15}/>{t[4]}</button><button className={cls} disabled={busy||blocked} onClick={()=>setConfirm(item.id)}><Archive size={15}/>{t[5]}</button></>}</div>)}</div><p role="status" className="text-sm">{message}</p><Modal open={visible&&confirm!==null} title={t[5]} onClose={()=>setConfirm(null)}><p>{t[6]}</p><div className="mt-4 flex justify-end gap-2"><button className={cls} onClick={()=>setConfirm(null)}>{t[7]}</button><button className={cls} onClick={()=>{const id=confirm;setConfirm(null);if(id)void run('archive',id);}}>{t[5]}</button></div></Modal></section>;
}

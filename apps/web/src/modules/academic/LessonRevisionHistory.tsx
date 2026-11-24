/** Historial v29.3. Todas las consultas exigen el rol editor en FastAPI.
 * Las versiones antiguas son inmutables; restaurar crea un nuevo borrador.
 */
import { useCallback, useEffect, useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import { useTranslation } from 'react-i18next';
import { BookOpen, History, RotateCcw } from 'lucide-react';
import { Modal } from '../../components/shared/Modal';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { RichTextEditor } from '../../components/shared/RichTextEditor';
import { Spinner } from '../../components/shared/Spinner';
import { useToast } from '../../components/shared/Toast';

const API=import.meta.env.VITE_API_URL || 'http://localhost:8000';
interface Revision {id:string;revision_number:number|null;revision_state:string;title:string;origin:string;published_at:string|null;created_at:string;published_by_name:string}
interface Detail {id:string;title:string;revision_number:number|null;document:JSONContent}
interface Props {path:string;token:string;draftId:string;lockVersion:number;onRestored:()=>void;disabled:boolean}

export function LessonRevisionHistory({path,token,draftId,lockVersion,onRestored,disabled}:Props) {
  const {t}=useTranslation();const {notify}=useToast();
  const base=path.replace(/\/draft$/,'');
  const [rows,setRows]=useState<Revision[]>([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(0);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [detail,setDetail]=useState<Detail|null>(null);
  const [restore,setRestore]=useState<Revision|null>(null);
  const pageSize=10;
  const request=useCallback(async (url:string, options:RequestInit={})=>{
    const response=await fetch(`${API}${url}`,{
      ...options,headers:{Authorization:`Bearer ${token}`,...options.headers},
    });
    if(!response.ok)throw new Error(`History error: ${response.status}`);
    return response.json() as Promise<unknown>;
  },[token]);
  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const data=await request(`${base}/history?offset=${page*pageSize}&limit=${pageSize}`) as {items:Revision[];total:number};
      setRows(data.items);setTotal(data.total);
    }catch{notify(t('lessonVersions.readError'),'info');}
    finally{setLoading(false);}
  },[base,page,request,notify,t]);
  useEffect(()=>{void load();},[load]);

  async function preview(item:Revision){
    setBusy(true);
    try{setDetail(await request(`${base}/revisions/${item.id}`) as Detail);}
    catch{notify(t('lessonVersions.readError'),'info');}
    finally{setBusy(false);}
  }
  async function confirmRestore(){
    if(!restore||busy||disabled)return;
    setBusy(true);
    try{
      // El servidor exige la versión del borrador que se confirma sustituir.
      const current=rows.find(row=>row.revision_state==='published');
      // Consultar el actual sin depender de que esté en esta página del historial.
      const head=await request(`${base}/history?offset=0&limit=1`) as {items:Revision[]};
      const active=head.items.find(row=>row.revision_state==='published') ?? current;
      await request(`${base}/revisions/${restore.id}/restore`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({expected_published_revision_id:active?.id??null,
          replace_draft_id:draftId,expected_draft_lock_version:lockVersion}),
      });
      setRestore(null);setDetail(null);notify(t('lessonVersions.restored'),'success');onRestored();
    }catch{notify(t('lessonVersions.conflict'),'info');}
    finally{setBusy(false);}
  }
  const columns:Column<Revision>[]=[
    {header:t('lessonVersions.versionTitle'),key:'revision_number',render:row=>t('lessonVersions.version',{number:row.revision_number??'—'})},
    {header:t('lessonEditor.title'),key:'title'},
    {header:t('lessonVersions.author'),key:'published_by_name'},
    {header:t('lessonVersions.date'),key:'published_at',render:row=>row.published_at?new Date(row.published_at).toLocaleString():t('lessonVersions.legacy')},
    {header:t('lessonVersions.actions'),key:'id',render:row=><div className="flex flex-wrap gap-2">
      <button type="button" className="app-secondary-button inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs" disabled={busy} onClick={()=>void preview(row)}><BookOpen size={14}/>{t('lessonVersions.preview')}</button>
      <button type="button" className="app-secondary-button inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs" disabled={busy||disabled} onClick={()=>setRestore(row)}><RotateCcw size={14}/>{t('lessonVersions.restore')}</button>
    </div>},
  ];
  return <section className="space-y-3">
    <h2 className="flex items-center gap-2 text-base font-semibold"><History size={18}/>{t('lessonVersions.history')}</h2>
    {loading&&<Spinner label={t('common.loading')}/>}
    {!loading&&<>
      <DataTable rows={rows} columns={columns} label={t('lessonVersions.history')} manualMode/>
      <div className="flex items-center justify-end gap-3 text-sm">
        <span className="app-muted">{t('lessonVersions.page',{page:page+1,total:Math.max(1,Math.ceil(total/pageSize))})}</span>
        <button type="button" className="app-secondary-button rounded-lg border px-3 py-2 disabled:opacity-50" disabled={page===0} onClick={()=>setPage(value=>value-1)}>{t('common.previous')}</button>
        <button type="button" className="app-secondary-button rounded-lg border px-3 py-2 disabled:opacity-50" disabled={(page+1)*pageSize>=total} onClick={()=>setPage(value=>value+1)}>{t('common.next')}</button>
      </div>
    </>}
    <Modal open={detail!==null} title={t('lessonVersions.preview')} onClose={()=>setDetail(null)}>
      {detail&&<div className="space-y-3"><strong>{detail.title}</strong><RichTextEditor value={detail.document} readOnly/></div>}
    </Modal>
    <Modal open={restore!==null} title={t('lessonVersions.restore')} onClose={()=>setRestore(null)}>
      <p className="text-sm">{t('lessonVersions.restoreWarning')}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="app-secondary-button rounded-lg border px-3 py-2" onClick={()=>setRestore(null)}>{t('common.cancel')}</button>
        <button type="button" className="app-primary-button rounded-lg px-3 py-2 disabled:opacity-50" disabled={busy||disabled} onClick={()=>void confirmRestore()}>{t('lessonVersions.restore')}</button>
      </div>
    </Modal>
  </section>;
}

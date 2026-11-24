/** v29.3 · Consulta de la versión publicada de una lección desde una oferta.
 * El JWT y la matrícula se validan en FastAPI. No solicita revisiones draft.
 */
import { useCallback, useEffect, useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import { useTranslation } from 'react-i18next';
import { ExternalLink, FileText, Image as ImageIcon, Link2, RefreshCcw } from 'lucide-react';
import { RichTextEditor } from '../../components/shared/RichTextEditor';
import { Spinner } from '../../components/shared/Spinner';
import { safeCourseResourceUrl } from './lessonVersioning';
import { useToast } from '../../components/shared/Toast';

const API=import.meta.env.VITE_API_URL || 'http://localhost:8000';
type Resource={id:string;kind:'file'|'link';title:string;url:string|null;media_type?:string};
type Published={title:string;revision_number:number;document:JSONContent;resources:Resource[]};
interface Props {organizationId:string;offeringId?:string;courseId?:string;lessonId:string;source:'base'|'offering';token:string}

export function PublishedLessonView({organizationId,offeringId,courseId,lessonId,source,token}:Props) {
  const {t}=useTranslation();
  const {notify}=useToast();
  const [published,setPublished]=useState<Published|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const root=`/api/v1/academic/organizations/${organizationId}`;
  const path=offeringId
    ? `${root}/course-offerings/${offeringId}/published-lessons/${source}/${lessonId}`
    : `${root}/courses/${courseId}/published-lessons/${lessonId}`;
  const load=useCallback(async(signal?:AbortSignal)=>{
    setLoading(true);setError(false);
    try {
      const response=await fetch(`${API}${path}`,{signal,headers:{Authorization:`Bearer ${token}`}});
      if(!response.ok)throw new Error('Publication inaccessible');
      const data=await response.json() as Published;
      if(!signal?.aborted)setPublished(data);
    }catch{if(!signal?.aborted)setError(true);}
    finally{if(!signal?.aborted)setLoading(false);}
  },[path,token]);
  useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]);

  async function downloadFile(resourceId:string) {
    const popup=window.open('about:blank','_blank');
    if(popup)popup.opener=null;
    try {
      const response=await fetch(`${API}${path}/resources/${resourceId}/download`,{headers:{Authorization:`Bearer ${token}`}});
      if(!response.ok)throw new Error('File not authorized');
      const data=await response.json() as {url:string};
      const signed=safeCourseResourceUrl(data.url,import.meta.env.VITE_SUPABASE_URL);
      if(popup)popup.location.href=signed;
      else notify(t('lessonVersions.popupBlocked'),'info');
    }catch{popup?.close();notify(t('lessonVersions.readError'),'info');}
  }

  return <div className="app-published-lesson-outline app-panel mt-3 space-y-3 rounded-xl border-2 p-3 sm:p-4" aria-label={t('lessonVersions.published')}>
    {loading&&<Spinner label={t('common.loading')}/>}
    {error&&<button type="button" className="app-secondary-button inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" onClick={()=>void load()}>
      <RefreshCcw size={16}/>{t('workspace.retry')}
    </button>}
    {published&&!loading&&<>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm">{published.title}</strong>
        <span className="app-muted text-xs">{t('lessonVersions.version',{number:published.revision_number})}</span>
      </div>
      <RichTextEditor value={published.document} readOnly/>
      {published.resources.length>0&&<div className="app-divider space-y-2 border-t pt-3">
        <p className="text-sm font-semibold">{t('lessonResources.heading')}</p>
        {published.resources.map(item=><div key={item.id} className="app-editor-resource-item flex items-center gap-2 rounded-xl border p-2.5 text-sm">
          {item.kind==='link'?<Link2 size={16}/>:item.media_type?.startsWith('image/')?<ImageIcon size={16}/>:<FileText size={16}/>}
          <span className="min-w-0 flex-1 truncate">{item.title}</span>
          {item.kind==='link'&&item.url&&<a className="app-secondary-button inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs" href={item.url} target="_blank" rel="noopener noreferrer nofollow"><ExternalLink size={14}/>{t('lessonResources.open')}</a>}
          {item.kind==='file'&&<button type="button" className="app-secondary-button inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs" onClick={()=>void downloadFile(item.id)}><ExternalLink size={14}/>{t('lessonResources.open')}</button>}
        </div>)}
      </div>}
    </>}
  </div>;
}

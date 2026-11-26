/** Comunidad de la oferta: texto plano, permisos del servidor y moderación explícita. */
import { useEffect, useState, type FormEvent } from 'react';
import { Heart, MessageCircle, Plus, RefreshCw, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../components/shared/Modal';
import { Spinner } from '../../components/shared/Spinner';
import { useToast } from '../../components/shared/Toast';
import { UserAvatar } from '../../components/shared/UserAvatar';
import { OptionSelect } from '../../components/shared/OptionSelect';
import { useAvatar } from '../profile/useAvatar';
import { AcademicProfileModal } from './AcademicParticipantProfile';

type Author = {author:string;author_auth_id:string|null};
type Post = Author & {id:string;kind:'announcement'|'question';title:string;body:string;author:string;created_at:string;likes:number;liked:boolean};
type Comment = Author & {id:string;body:string;author:string;created_at:string};
type Feed = {editor:boolean;writable:boolean;items:Post[];total:number;page:number;page_size:number};
const translations = {
 es:{heading:'Comunidad académica',note:'Espacio compartido con los participantes de esta oferta. No publiques datos privados.',new:'Nueva publicación',question:'Pregunta',announcement:'Anuncio',title:'Título',body:'Contenido',send:'Publicar',cancel:'Cancelar',refresh:'Actualizar',comments:'Comentarios',comment:'Escribe un comentario',like:'Me gusta',hide:'Ocultar',confirm:'¿Ocultar este contenido para toda la comunidad?',success:'Operación realizada.',error:'No se pudo completar la operación.',empty:'Todavía no hay publicaciones.',noComments:'Todavía no hay comentarios.',readOnly:'Comunidad de solo lectura.',limit:'Hasta 100 comentarios por publicación.'},
 en:{heading:'Academic community',note:'Shared with participants in this course offering. Do not post private data.',new:'New post',question:'Question',announcement:'Announcement',title:'Title',body:'Content',send:'Publish',cancel:'Cancel',refresh:'Refresh',comments:'Comments',comment:'Write a comment',like:'Like',hide:'Hide',confirm:'Hide this content from the entire community?',success:'Operation completed.',error:'Could not complete the operation.',empty:'No posts yet.',noComments:'No comments yet.',readOnly:'Read-only community.',limit:'Up to 100 comments per post.'},
 pt:{heading:'Comunidade acadêmica',note:'Espaço compartilhado com participantes desta oferta. Não publique dados privados.',new:'Nova publicação',question:'Pergunta',announcement:'Anúncio',title:'Título',body:'Conteúdo',send:'Publicar',cancel:'Cancelar',refresh:'Atualizar',comments:'Comentários',comment:'Escreva um comentário',like:'Curtir',hide:'Ocultar',confirm:'Ocultar este conteúdo de toda a comunidade?',success:'Operação concluída.',error:'Não foi possível concluir a operação.',empty:'Ainda não há publicações.',noComments:'Ainda não há comentários.',readOnly:'Comunidade somente para leitura.',limit:'Até 100 comentários por publicação.'},
} as const;
const secondary='app-secondary-button inline-flex items-center gap-2 rounded-xl border border-[var(--app-control-border)] px-3 py-2 text-sm disabled:opacity-50';
const primary='app-primary-button inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50';
const control='app-input w-full rounded-xl border border-[var(--app-control-border)] px-3 py-2 text-sm';
// Vista pública académica mínima; no reutiliza el endpoint administrativo de Usuarios.
function CommunityAuthor({author,onOpen,large=false}:{author:Author;onOpen?:()=>void;large?:boolean}) {
 const avatar=useAvatar(author.author_auth_id);
 const picture=<UserAvatar userId={author.author_auth_id??author.author} name={author.author} photo={avatar.photo} loading={avatar.loading} large={large}/>;
 return onOpen?<button type="button" className="flex min-w-0 items-center gap-2 text-left hover:underline" onClick={onOpen}>{picture}<span className="min-w-0 break-words font-semibold">{author.author}</span></button>:<div className="flex flex-col items-center gap-2 text-center">{picture}<h3 className="break-words font-semibold">{author.author}</h3></div>;
}
export function CourseCommunity({organizationId,offeringId,token}:{organizationId:string;offeringId:string;token:string}) {
 const {i18n,t:translate}=useTranslation();const t=translations[i18n.language.startsWith('pt')?'pt':i18n.language.startsWith('en')?'en':'es'];
 const {notify}=useToast();
 const location=useLocation();
 // El aviso puede señalar una publicación fuera de la primera página.
 const [focus,setFocus]=useState(()=>new URLSearchParams(location.search).get('post'));
 const [data,setData]=useState<Feed|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 const [busy,setBusy]=useState(false),[create,setCreate]=useState(false),[kind,setKind]=useState<Post['kind']>('question'),[title,setTitle]=useState(''),[body,setBody]=useState('');
 const [opened,setOpened]=useState<string|null>(focus),[comments,setComments]=useState<Comment[]>([]),[comment,setComment]=useState(''),[commentLoading,setCommentLoading]=useState(false),[commentError,setCommentError]=useState(false);
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(5),[profile,setProfile]=useState<Author|null>(null);
 const [hide,setHide]=useState<{path:string;post:boolean}|null>(null);
 const url=`${import.meta.env.VITE_API_URL||'http://localhost:8000'}/api/v1/academic/organizations/${organizationId}/course-offerings/${offeringId}/community`;
 // Cancelar lecturas anteriores evita mezclar ofertas o respuestas obsoletas.
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError(false);
  void fetch(`${url}?page=${page}&page_size=${pageSize}${focus?`&focus=${encodeURIComponent(focus)}`:''}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal}).then(async r=>{if(r.status===404&&focus&&!controller.signal.aborted){setFocus(null);setOpened(null);setPage(1);notify(t.error,'info');throw Error();}if(!r.ok)throw Error();const v=await r.json() as Feed;if(!Number.isInteger(v.page)||!Number.isInteger(v.total))throw Error();return v;}).then(v=>{if(!controller.signal.aborted){setData(v);if(v.page!==page)setPage(v.page);}}).catch(()=>{if(!controller.signal.aborted){setError(true);setData(null);}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[url,token,revision,page,pageSize,focus]);
 useEffect(()=>{setComments([]);setCommentError(false);setCommentLoading(false);if(!opened)return;const controller=new AbortController();setCommentLoading(true);
  void fetch(`${url}/${opened}/comments`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return await r.json() as {items:Comment[]};}).then(v=>{if(!controller.signal.aborted)setComments(v.items);}).catch(()=>{if(!controller.signal.aborted)setCommentError(true);}).finally(()=>{if(!controller.signal.aborted)setCommentLoading(false);});return()=>controller.abort();},[opened,url,token,revision]);
 async function mutate(path:string,method:'POST'|'PUT'|'PATCH',payload:unknown,after:()=>void){if(busy)return;setBusy(true);try{const r=await fetch(url+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)});if(!r.ok)throw Error();after();notify(t.success,'success');setRevision(v=>v+1);}catch{notify(t.error,'info');}finally{setBusy(false);}}
 function publish(e:FormEvent){e.preventDefault();if(title.trim().length<3||body.trim().length<5)return;void mutate('','POST',{kind,title,body},()=>{setFocus(null);setCreate(false);setTitle('');setBody('');setPage(1);setOpened(null);});}
 const publicationPageLabel=i18n.language.startsWith('pt')?'Publicações por página':i18n.language.startsWith('en')?'Posts per page':'Publicaciones por página';
 const date=(v:string)=>new Date(v).toLocaleString(i18n.language);
 return <section role="tabpanel" className="min-w-0 space-y-4">
  <div className="app-panel rounded-2xl border border-[var(--app-panel-border)] p-4 space-y-3">
   <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-semibold"><MessageCircle size={22}/>{t.heading}</h2><div className="flex flex-wrap gap-2"><button className={secondary} disabled={loading||busy} onClick={()=>setRevision(v=>v+1)}><RefreshCw size={16}/>{t.refresh}</button>{data?.writable&&<button className={primary} disabled={busy} onClick={()=>{setKind(data.editor?'announcement':'question');setCreate(true);}}><Plus size={16}/>{t.new}</button>}</div></div>
   <p className="app-muted text-sm">{t.note}</p><p className="app-muted text-xs">{t.limit}</p>{data&&!data.writable&&<p className="app-muted text-sm">{t.readOnly}</p>}
  </div>
  {loading?<Spinner/>:error?<p role="alert">{t.error}</p>:!data?.items.length?<p className="app-muted">{t.empty}</p>:data.items.map(p=><article key={p.id} className={`app-panel rounded-2xl border p-4 space-y-3 min-w-0 ${focus===p.id?'border-[var(--app-primary-bg)]':'border-[var(--app-panel-border)]'}`}>
   <div className="flex flex-wrap justify-between gap-2"><div><CommunityAuthor author={p} onOpen={()=>setProfile(p)}/><p className="app-muted text-xs">{date(p.created_at)}</p></div><span className="app-workspace-state app-workspace-published rounded-lg border px-2 py-1 text-xs self-start">{t[p.kind]}</span></div>
   <h3 className="font-semibold break-words">{p.title}</h3><p className="whitespace-pre-wrap break-words text-sm">{p.body}</p>
   <div className="flex flex-wrap gap-2 border-t border-[var(--app-panel-border)] pt-3"><button aria-pressed={p.liked} className={secondary} disabled={!data.writable||busy} onClick={()=>void mutate(`/${p.id}/reaction`,'PUT',{liked:!p.liked},()=>{})}><Heart size={16} fill={p.liked?'currentColor':'none'}/>{t.like} · {p.likes}</button><button className={secondary} aria-expanded={opened===p.id} onClick={()=>{setOpened(opened===p.id?null:p.id);setComment('');}}><MessageCircle size={16}/>{t.comments}</button>{data.editor&&<button className={secondary} disabled={busy} onClick={()=>setHide({path:`/${p.id}/hide`,post:true})}><EyeOff size={16}/>{t.hide}</button>}</div>
   {opened===p.id&&<div className="space-y-3 border-t border-[var(--app-panel-border)] pt-3">{commentLoading?<Spinner/>:commentError?<p role="alert">{t.error}</p>:!comments.length?<p className="app-muted text-sm">{t.noComments}</p>:comments.map(c=><div key={c.id} className="rounded-xl border border-[var(--app-panel-border)] p-3 space-y-1"><div className="flex flex-wrap justify-between gap-2"><CommunityAuthor author={c} onOpen={()=>setProfile(c)}/><span className="app-muted text-xs">{date(c.created_at)}</span></div><p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>{data.editor&&<button className={secondary} disabled={busy} onClick={()=>setHide({path:`/${p.id}/comments/${c.id}/hide`,post:false})}><EyeOff size={14}/>{t.hide}</button>}</div>)}
    {data.writable&&<form className="space-y-2" onSubmit={e=>{e.preventDefault();if(comment.trim().length>=2)void mutate(`/${p.id}/comments`,'POST',{body:comment},()=>setComment(''));}}><textarea aria-label={t.comment} placeholder={t.comment} required minLength={2} maxLength={2000} rows={3} className={control} value={comment} onChange={e=>setComment(e.target.value)}/><button className={primary} disabled={busy} type="submit">{t.send}</button></form>}</div>}
  </article>)}
  {data&&!loading&&!error&&data.total>0&&<footer className="app-panel flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--app-panel-border)] p-3 text-sm">
   <span className="app-muted">{translate('common.records',{count:data.total,page:data.page,total:Math.max(1,Math.ceil(data.total/pageSize))})}</span>
   <div className="flex flex-wrap items-center gap-2"><span>{publicationPageLabel}</span><div className="w-24"><OptionSelect ariaLabel={publicationPageLabel} value={String(pageSize)} options={[5,10,20].map(n=>({value:String(n),label:String(n)}))} onChange={v=>{setFocus(null);setPageSize(Number(v));setPage(1);setOpened(null);}}/></div>
    <button type="button" aria-label={translate('common.previous')} className={secondary} disabled={data.page<=1||busy} onClick={()=>{setFocus(null);setPage(data.page-1);setOpened(null);}}><ChevronLeft size={16}/></button>
    <button type="button" aria-label={translate('common.next')} className={secondary} disabled={data.page*pageSize>=data.total||busy} onClick={()=>{setFocus(null);setPage(data.page+1);setOpened(null);}}><ChevronRight size={16}/></button></div>
  </footer>}
  {profile&&<AcademicProfileModal scope={{organizationId,offeringId,token}} target={profile.author_auth_id} name={profile.author} onClose={()=>setProfile(null)}/>}
  <Modal open={create} title={t.new} mobileSheet onClose={()=>{if(!busy)setCreate(false);}}><form className="space-y-3" onSubmit={publish}><select aria-label={t.new} className={control} value={kind} onChange={e=>setKind(e.target.value==='announcement'?'announcement':'question')}><option value="question">{t.question}</option>{data?.editor&&<option value="announcement">{t.announcement}</option>}</select><label className="block text-sm">{t.title}<input className={control} required minLength={3} maxLength={150} value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="block text-sm">{t.body}<textarea className={control} required minLength={5} maxLength={3000} rows={5} value={body} onChange={e=>setBody(e.target.value)}/></label><button className={primary} type="submit" disabled={busy}>{busy&&<Spinner compact/>}{t.send}</button></form></Modal>
  <Modal open={!!hide} title={t.hide} onClose={()=>{if(!busy)setHide(null);}} mobileSheet><p className="text-sm">{t.confirm}</p><div className="mt-4 flex justify-end gap-2"><button className={secondary} disabled={busy} onClick={()=>setHide(null)}>{t.cancel}</button><button className={primary} disabled={busy} onClick={()=>{if(hide)void mutate(hide.path,'PATCH',undefined,()=>{if(hide.post){setOpened(null);setFocus(null);}setHide(null);});}}>{t.hide}</button></div></Modal>
 </section>;
}

/** Bandeja privada del topbar. No confundir con los avisos transitorios de Toast. */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Bell, CheckCheck, Lightbulb, RefreshCw, X, ClipboardList, ClipboardCheck, GraduationCap, Megaphone, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { courseOfferingPath, courseTaskPath, taskSubmissionsPath } from '../../routes';
import { Spinner } from './Spinner';
import { useToast } from './Toast';

// Tipos cerrados: ningún destino de navegación se acepta como URL externa.
type EventType = 'recommendation_created'|'task_published'|'task_submitted'|'grade_issued'|'community_announcement'|'community_question'|'community_reply';
const eventIcons = {recommendation_created:Lightbulb,task_published:ClipboardList,task_submitted:ClipboardCheck,grade_issued:GraduationCap,community_announcement:Megaphone,community_question:MessageCircle,community_reply:MessageCircle};
const eventLabels = {
 es:{recommendation_created:'Nueva recomendación docente',task_published:'Nueva tarea disponible',task_submitted:'Nueva entrega de tarea',grade_issued:'Nueva calificación oficial',community_announcement:'Nuevo anuncio',community_question:'Nueva pregunta en Comunidad',community_reply:'Nuevo comentario en tu publicación'},
 en:{recommendation_created:'New teacher recommendation',task_published:'New task available',task_submitted:'New task submission',grade_issued:'New official grade',community_announcement:'New announcement',community_question:'New community question',community_reply:'New comment on your post'},
 pt:{recommendation_created:'Nova recomendação docente',task_published:'Nova tarefa disponível',task_submitted:'Nova entrega de tarefa',grade_issued:'Nova nota oficial',community_announcement:'Novo anúncio',community_question:'Nova pergunta na comunidade',community_reply:'Novo comentário na sua publicação'},
};
type Item = {id:string; organization_id:string; offering_id:string; resource_id:string; event_type:EventType; target_id:string; title:string; created_at:string; read_at:string|null};
type Inbox = {unread:number;items:Item[]};
const API = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/notifications`;
const labels = {
 es:{heading:'Notificaciones',all:'Todas',unread:'Sin leer',readAll:'Marcar todas como leídas',empty:'Estás al día',error:'No se pudieron cargar las notificaciones.',failed:'No se pudo actualizar la notificación.',close:'Cerrar',refresh:'Actualizar',loading:'Cargando…',limited:'Hasta 50 avisos, primero los no leídos.'},
 en:{heading:'Notifications',all:'All',unread:'Unread',readAll:'Mark all as read',empty:"You're all caught up",error:'Could not load notifications.',failed:'Could not update notification.',close:'Close',refresh:'Refresh',loading:'Loading…',limited:'Up to 50 notifications, unread first.'},
 pt:{heading:'Notificações',all:'Todas',unread:'Não lidas',readAll:'Marcar todas como lidas',empty:'Tudo em dia',error:'Não foi possível carregar as notificações.',failed:'Não foi possível atualizar a notificação.',close:'Fechar',refresh:'Atualizar',loading:'Carregando…',limited:'Até 50 avisos, não lidos primeiro.'},
};

export function NotificationInbox({token}:{token:string}) {
 const {i18n}=useTranslation();
 const locale=i18n.language.startsWith('pt')?'pt':i18n.language.startsWith('en')?'en':'es';
 const t=labels[locale];
 const navigate=useNavigate(), {notify}=useToast();
 const [open,setOpen]=useState(false), [unreadOnly,setUnreadOnly]=useState(false);
 const [data,setData]=useState<Inbox|null>(null), [error,setError]=useState(false), [busy,setBusy]=useState(false);
 const root=useRef<HTMLDivElement>(null), trigger=useRef<HTMLButtonElement>(null), request=useRef<AbortController|null>(null), mutation=useRef<AbortController|null>(null);
 const panelId=useId();
 const refresh=useCallback(async()=>{
  if(mutation.current)return;
  request.current?.abort(); const controller=new AbortController(); request.current=controller;
  try {
   const response=await fetch(API,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal});
   if(!response.ok)throw new Error('load'); const result:Inbox=await response.json();
   if(!controller.signal.aborted){setData(result);setError(false);}
  } catch {if(!controller.signal.aborted)setError(true);}
  finally {if(request.current===controller)request.current=null;}
 },[token]);
 // No consultar en segundo plano; limpiar al desmontar o cambiar la sesión.
 useEffect(()=>{
  setBusy(false);void refresh();
  const visible=()=>{if(document.visibilityState==='visible')void refresh();};
  const timer=window.setInterval(visible,60000);
  document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible);
  return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible);request.current?.abort();mutation.current?.abort();mutation.current=null;};
 },[refresh]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent|FocusEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);document.removeEventListener('keydown',escape);};
 },[open]);
 async function mark(item?:Item){
  if(mutation.current)return;
  request.current?.abort();const controller=new AbortController();mutation.current=controller;setBusy(true);
  try{
   const response=await fetch(`${API}/${item?`${item.id}/read`:'read-all'}`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
   if(!response.ok)throw new Error('read');
   if(controller.signal.aborted)return;
   if(item){
    setOpen(false);
    const base=courseOfferingPath(item.organization_id,item.offering_id);
    if(item.event_type==='recommendation_created')navigate(`${base}?tab=recommendations&recommendation=${encodeURIComponent(item.resource_id)}`);
    else if(item.event_type==='task_submitted')navigate(taskSubmissionsPath(item.organization_id,item.offering_id,item.target_id));
    else if(item.event_type==='task_published'||item.event_type==='grade_issued')navigate(courseTaskPath(item.organization_id,item.offering_id,item.target_id));
    else navigate(`${base}?tab=community&post=${encodeURIComponent(item.target_id)}`);
   }
  }catch{if(!controller.signal.aborted)notify(t.failed,'info');}
  finally{if(mutation.current===controller){mutation.current=null;setBusy(false);void refresh();}}
 }
 const unread=data?.unread??0;
 const items=(data?.items??[]).filter(item=>!unreadOnly||!item.read_at);
 return <div ref={root}>
  <button ref={trigger} type="button" aria-label={`${t.heading}: ${unread} ${t.unread}`} aria-expanded={open} aria-controls={panelId} className="app-secondary-button relative rounded-xl border p-2.5" onClick={()=>{if(!open)void refresh();setOpen(!open);}}>
   <Bell size={21}/>{unread>0&&<span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-5 text-white">{unread>99?'99+':unread}</span>}
  </button>
  <div id={panelId} inert={!open} aria-hidden={!open} data-open={open} className="app-account-menu app-notification-inbox app-panel absolute right-3 top-full z-50 mt-2 w-[min(400px,calc(100vw-1.5rem))] rounded-2xl border border-[var(--app-panel-border)] shadow-2xl sm:right-5">
   <div className="space-y-3 p-4">
    <div className="flex items-center gap-2"><Bell size={18} className="app-accent"/><h2 className="flex-1 font-semibold">{t.heading}</h2><button type="button" aria-label={t.refresh} onClick={()=>void refresh()} className="rounded p-1"><RefreshCw size={16}/></button><button type="button" aria-label={t.close} className="rounded p-1" onClick={()=>{setOpen(false);trigger.current?.focus();}}><X size={17}/></button></div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="app-muted">{unread} {t.unread}</span><button type="button" disabled={busy||!unread} onClick={()=>void mark()} className="app-accent flex items-center gap-1 disabled:opacity-50"><CheckCheck size={15}/>{t.readAll}</button></div>
    <div className="grid grid-cols-2 gap-2">{[false,true].map(filter=><button key={String(filter)} type="button" aria-pressed={unreadOnly===filter} onClick={()=>setUnreadOnly(filter)} className={`app-secondary-button rounded-lg border p-2 text-xs ${unreadOnly===filter?'app-workspace-active':''}`}>{filter?t.unread:t.all}</button>)}</div>
   </div>
   <div className="max-h-[min(420px,50dvh)] overflow-y-auto border-t border-[var(--app-panel-border)]" aria-live="polite">
    {error?<p role="alert" className="app-warning p-4 text-sm">{t.error}</p>:!data?<div className="p-4"><Spinner label={t.loading}/></div>:items.length===0?<p className="app-muted p-6 text-center text-sm">{t.empty}</p>:items.map(item=>{const EventIcon=eventIcons[item.event_type]??Bell;return <button key={item.id} type="button" disabled={busy} onClick={()=>void mark(item)} className={`app-account-action flex w-full items-start gap-3 border-b border-[var(--app-panel-border)] p-3 text-left ${!item.read_at?'app-notification-unread':''}`}>
     <span className="app-accent shrink-0 rounded-lg p-2"><EventIcon size={19}/></span><span className="min-w-0 flex-1 space-y-1"><span className={`block text-sm ${!item.read_at?'font-semibold':''}`}>{eventLabels[locale][item.event_type]??t.heading}</span><span className="app-muted block break-words text-xs">{item.title}</span><span className="app-muted block text-xs">{new Date(item.created_at).toLocaleString(i18n.language)}</span></span>{!item.read_at&&<span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sky-500"/>}
    </button>;})}
   </div><p className="app-muted px-4 py-2 text-xs">{t.limited}</p>
  </div>
 </div>;
}

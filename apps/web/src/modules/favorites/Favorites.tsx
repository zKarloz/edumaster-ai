/** Favoritos locales por usuario, institución y rol; las rutas siguen protegidas por FastAPI. */
import {useEffect,useRef,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router';
import {Star,ArrowRight,ArrowUp,ArrowDown,Trash2,Pencil} from 'lucide-react';
import {Modal} from '../../components/shared/Modal';
import {useToast} from '../../components/shared/Toast';
import {favoriteKey,storageKey,parseFavorites,favoritePath,moveFavorite,MAX_FAVORITES,type Favorite,type FavoriteScope} from './favoriteRules';
const copy={es:{title:'Mis favoritos',add:'Añadir a favoritos',remove:'Quitar de favoritos',edit:'Editar favoritos',empty:'Guarda una pestaña de un curso, tarea o listado de entregas usando la estrella.',up:'Subir',down:'Bajar',close:'Cerrar',saved:'Favoritos actualizados',error:'No se pudo guardar la preferencia local.',limit:'Máximo 20 favoritos por vista.',denied:'No se pudo verificar el acceso a este destino.',submissions:'Entregas',task:'Tarea'},en:{title:'My favorites',add:'Add to favorites',remove:'Remove from favorites',edit:'Edit favorites',empty:'Save a course tab, assignment or submissions list using the star.',up:'Move up',down:'Move down',close:'Close',saved:'Favorites updated',error:'Could not save local preference.',limit:'Maximum 20 favorites per view.',denied:'Could not verify access to this destination.',submissions:'Submissions',task:'Assignment'},pt:{title:'Meus favoritos',add:'Adicionar aos favoritos',remove:'Remover dos favoritos',edit:'Editar favoritos',empty:'Salve uma aba do curso, tarefa ou lista de entregas usando a estrela.',up:'Mover para cima',down:'Mover para baixo',close:'Fechar',saved:'Favoritos atualizados',error:'Não foi possível salvar a preferência local.',limit:'Máximo de 20 favoritos por visão.',denied:'Não foi possível verificar o acesso ao destino.',submissions:'Entregas',task:'Tarefa'}};
function read(s:FavoriteScope){try{return parseFavorites(localStorage.getItem(storageKey(s)),s.role);}catch{return [];}}
function write(s:FavoriteScope,rows:Favorite[]){localStorage.setItem(storageKey(s),JSON.stringify(rows));}
function useCopy(){const {t,i18n}=useTranslation();const c=copy[i18n.language.startsWith('pt')?'pt':i18n.language.startsWith('en')?'en':'es'];return {c,t};}
const button='app-secondary-button inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50';
export function FavoriteStar({scopes,item,token}:{scopes:FavoriteScope[];item:Favorite;token:string}){
 const {c,t}=useCopy();const {notify}=useToast();const [revision,setRevision]=useState(0);const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const pending=useRef<AbortController|null>(null);
 useEffect(()=>{setBusy(false);return()=>{pending.current?.abort();pending.current=null;};},[token]);
 if(!scopes.length)return null;
 const has=(s:FavoriteScope)=>read(s).some(f=>favoriteKey(f)===favoriteKey(item));
 const all=scopes.every(has);
 async function toggle(s:FavoriteScope){
  if(pending.current)return;
  const ctrl=new AbortController();pending.current=ctrl;setBusy(true);
  try{const rows=read(s);if(has(s)){write(s,rows.filter(f=>favoriteKey(f)!==favoriteKey(item)));}else{
    if(rows.length>=MAX_FAVORITES){notify(c.limit);return;}
    let courseTitle:string;try{courseTitle=await verify(s,item,token,ctrl.signal);}catch{if(!ctrl.signal.aborted)notify(c.denied);return;}
    if(ctrl.signal.aborted)return;
    const current=read(s);if(current.length>=MAX_FAVORITES){notify(c.limit);return;}
    const title=(item.kind==='task'||item.kind==='submissions')&&courseTitle?`${item.title} · ${courseTitle}`:item.title;
    if(!has(s))write(s,[...current,{...item,title:title.slice(0,240)}]);
  }setRevision(v=>v+1);notify(c.saved,'success');}catch{if(!ctrl.signal.aborted)notify(c.error);}finally{if(pending.current===ctrl)pending.current=null;if(!ctrl.signal.aborted)setBusy(false);}
 }

 return <><button data-revision={revision} type="button" className={button} disabled={busy} aria-pressed={all} aria-label={all?c.remove:c.add} onClick={()=>{if(scopes.length===1&&scopes[0])void toggle(scopes[0]);else setOpen(true);}}><Star size={17} className={all?'fill-amber-400 text-amber-400':'app-accent'}/>{all?c.remove:c.add}</button><Modal open={open} title={c.title} onClose={()=>setOpen(false)}><div className="space-y-2">{scopes.map(s=><button key={s.role} type="button" className={`${button} w-full justify-between`} disabled={busy} aria-pressed={has(s)} onClick={()=>void toggle(s)}>{t(`account.role_${s.role}`)}<Star size={17} className={has(s)?'fill-amber-400 text-amber-400':'app-muted'}/></button>)}</div></Modal></>;
}
/** Revalidar el destino antes de navegar. El módulo vuelve a comprobar permisos al montar. */
async function verify(scope:FavoriteScope,f:Favorite,token:string,signal:AbortSignal){
 const root=`${import.meta.env.VITE_API_URL||'http://localhost:8000'}/api/v1/academic/organizations/${scope.organizationId}/course-offerings/${f.offeringId}`;
 const get=async(path:string)=>{const r=await fetch(root+path,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal});if(!r.ok)throw new Error('HTTP '+r.status);return r.json();};
 const w=await get('/workspace');const expected=scope.role==='institution_admin'||scope.role==='coordinator'?'manager':scope.role;if(w.role!==expected)throw new Error('Scope changed');
 if(f.kind==='task'||f.kind==='submissions'){const tasks=await get('/tasks');if(!Array.isArray(tasks.items)||!tasks.items.some((x:{id:string;status:string})=>x.id===f.taskId&&(f.kind!=='submissions'||x.status!=='draft')))throw new Error('Task unavailable');if(f.kind==='submissions'){if(tasks.role!=='editor')throw new Error('Scope changed');await get(`/tasks/${f.taskId}/submissions?limit=1&offset=0`);}}
 return typeof w.course?.title==='string'?w.course.title:'';
}
export function FavoritesPanel({scope,token}:{scope:FavoriteScope;token:string}){
 const {c,t}=useCopy();const {notify}=useToast();const navigate=useNavigate();const [rows,setRows]=useState(()=>read(scope));const [edit,setEdit]=useState(false);const [busy,setBusy]=useState(false);const pending=useRef<AbortController|null>(null);
 useEffect(()=>{setBusy(false);return()=>{pending.current?.abort();pending.current=null;};},[token]);
 function update(next:Favorite[]){try{write(scope,next);setRows(next);}catch{notify(c.error);}}
 async function open(f:Favorite){if(pending.current)return;const ctrl=new AbortController();pending.current=ctrl;setBusy(true);try{await verify(scope,f,token,ctrl.signal);if(!ctrl.signal.aborted)navigate(favoritePath(scope,f));}catch{if(!ctrl.signal.aborted)notify(c.denied);}finally{if(pending.current===ctrl)pending.current=null;if(!ctrl.signal.aborted)setBusy(false);}}
 const label=(f:Favorite)=>f.kind==='task'?c.task:f.kind==='submissions'?c.submissions:t(`workspace.${f.kind}`);
 return <section className="app-panel rounded-2xl border p-4 space-y-3"><div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-semibold"><Star size={19} className="text-amber-400"/>{c.title}</h3>{rows.length>0&&<button type="button" className={button} onClick={()=>setEdit(true)}><Pencil size={15}/>{c.edit}</button>}</div>{rows.length===0?<p className="app-muted text-sm">{c.empty}</p>:<div className="grid gap-2 sm:grid-cols-2">{rows.map(f=><button key={favoriteKey(f)} type="button" disabled={busy} className={`${button} justify-start text-left`} onClick={()=>void open(f)}><Star size={16} className="app-accent shrink-0"/><span className="min-w-0 flex-1 break-words">{f.title}<span className="app-muted block text-xs">{label(f)}</span></span><ArrowRight size={16} className="shrink-0"/></button>)}</div>}<Modal open={edit} title={c.edit} onClose={()=>setEdit(false)}><div className="space-y-2">{rows.map((f,i)=><div key={favoriteKey(f)} className="flex flex-wrap items-center gap-2 rounded-lg border p-2"><span className="min-w-0 flex-1 break-words text-sm">{f.title} · {label(f)}</span><button className={button} aria-label={c.up} disabled={i===0} onClick={()=>update(moveFavorite(rows,i,-1))}><ArrowUp size={16}/></button><button className={button} aria-label={c.down} disabled={i===rows.length-1} onClick={()=>update(moveFavorite(rows,i,1))}><ArrowDown size={16}/></button><button className={button} aria-label={c.remove} onClick={()=>update(rows.filter(x=>favoriteKey(x)!==favoriteKey(f)))}><Trash2 size={16}/></button></div>)}<button className={button} onClick={()=>setEdit(false)}>{c.close}</button></div></Modal></section>;
}

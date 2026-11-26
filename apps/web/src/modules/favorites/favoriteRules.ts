/** Destinos tipados: nunca se almacenan URLs arbitrarias ni credenciales. */
export const favoriteRoles = ['institution_admin','coordinator','instructor','student'] as const;
export type FavoriteRole = typeof favoriteRoles[number];
export type FavoriteScope = {userId:string;organizationId:string;role:FavoriteRole};
export const tabs = ['overview','content','tasks','community','recommendations'] as const;
export type FavoriteKind = typeof tabs[number] | 'task' | 'submissions';
export type Favorite = {offeringId:string;kind:FavoriteKind;taskId?:string;title:string};
export const MAX_FAVORITES=20;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function favoriteKey(f:Favorite){return `${f.offeringId}:${f.kind}:${f.taskId??''}`;}
export function storageKey(s:FavoriteScope){return `edumaster:favorites:v1:${encodeURIComponent(s.userId)}:${encodeURIComponent(s.organizationId)}:${s.role}`;}
export function isFavoriteRole(role:string):role is FavoriteRole{return favoriteRoles.some(r=>r===role);}
export function validForRole(role:FavoriteRole,kind:FavoriteKind){return kind!=='submissions'||role!=='student';}
export function parseFavorites(raw:string|null,role:FavoriteRole):Favorite[]{
 try{const rows:unknown=JSON.parse(raw??'[]');if(!Array.isArray(rows))return [];const result:Favorite[]=[];
 for(const row of rows){if(!row||typeof row!=='object'||typeof row.offeringId!=='string'||!uuid.test(row.offeringId)||typeof row.title!=='string'||!row.title.trim()||row.title.length>240)continue;
 const kind:unknown=row.kind;if(typeof kind!=='string'||![...tabs,'task','submissions'].includes(kind))continue;
 const k=kind as FavoriteKind;if(!validForRole(role,k))continue;const task=k==='task'||k==='submissions';if(task&&(typeof row.taskId!=='string'||!uuid.test(row.taskId)))continue;
 const item:Favorite={offeringId:row.offeringId,kind:k,title:row.title,...(task?{taskId:row.taskId}: {})};if(!result.some(f=>favoriteKey(f)===favoriteKey(item)))result.push(item);if(result.length>=MAX_FAVORITES)break;}
 return result;}catch{return [];}
}
export function favoritePath(s:FavoriteScope,f:Favorite){const root=`/academico/organizaciones/${s.organizationId}/ofertas/${f.offeringId}`;return f.kind==='task'||f.kind==='submissions'?`${root}/tareas/${f.taskId}${f.kind==='submissions'?'/entregas':''}`:`${root}?tab=${f.kind}`;}
/** El rol efectivo de FastAPI prevalece sobre la preferencia visual. */
export function matchingScopes(scopes:FavoriteScope[],effective:'manager'|'instructor'|'student'|'editor'){
 return scopes.filter(s=>effective==='manager'?s.role==='institution_admin'||s.role==='coordinator':effective==='editor'?s.role!=='student':s.role===effective);
}
export function moveFavorite(rows:Favorite[],index:number,delta:number){const next=index+delta;if(index<0||index>=rows.length||next<0||next>=rows.length)return rows;const copy=[...rows];const [item]=copy.splice(index,1);if(item)copy.splice(next,0,item);return copy;}

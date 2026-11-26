/** Perfil de curso con alcance académico; nunca consulta el directorio administrativo. */
import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Building2, BookOpen, GraduationCap} from 'lucide-react';
import {Modal} from '../../components/shared/Modal';
import {Spinner} from '../../components/shared/Spinner';
import {UserAvatar} from '../../components/shared/UserAvatar';
import {UserProfileLayout} from '../users/UserDetailModal';
import {useAvatar} from '../profile/useAvatar';
type Participant = {name:string; auth_user_id:string|null; organization_name:string; course_name:string; academic_role:'instructor'|'student'|'participant'};
type Scope = {organizationId:string; offeringId:string; token:string};
const labels={es:{teacher:'Docente asignado',instructor:'Docente',student:'Estudiante',participant:'Participante',organization:'Institución',course:'Curso',role:'Rol académico',none:'No hay docente asignado disponible.',error:'No se pudo consultar el perfil académico.',profile:'Perfil académico'},en:{teacher:'Assigned instructor',instructor:'Instructor',student:'Student',participant:'Participant',organization:'Institution',course:'Course',role:'Academic role',none:'No assigned instructor available.',error:'Could not load academic profile.',profile:'Academic profile'},pt:{teacher:'Docente atribuído',instructor:'Docente',student:'Estudante',participant:'Participante',organization:'Instituição',course:'Curso',role:'Papel acadêmico',none:'Nenhum docente atribuído disponível.',error:'Não foi possível consultar o perfil acadêmico.',profile:'Perfil acadêmico'}};
function useLabels(){const {i18n}=useTranslation();return labels[i18n.language.startsWith('pt')?'pt':i18n.language.startsWith('en')?'en':'es'];}
function useParticipants({organizationId,offeringId,token}:Scope,target:string|null,enabled:boolean){
 const url=`${import.meta.env.VITE_API_URL||'http://localhost:8000'}/api/v1/academic/organizations/${organizationId}/course-offerings/${offeringId}/community/participants${target?'?target='+encodeURIComponent(target):''}`;
 const [state,setState]=useState<{url:string;token:string;items:Participant[];error:boolean}|null>(null);
 useEffect(()=>{if(!enabled)return;const c=new AbortController();setState(null);
 void fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:c.signal}).then(async r=>{if(!r.ok)throw Error();return await r.json() as {items:Participant[]};}).then(v=>{if(!c.signal.aborted)setState({url,token,items:v.items,error:false});}).catch(()=>{if(!c.signal.aborted)setState({url,token,items:[],error:true});});return()=>c.abort();},[url,token,enabled]);
 return enabled&&state?.url===url&&state.token===token?state:null;
}
export function AcademicProfileModal({scope,target,name,onClose}:{scope:Scope;target:string|null;name:string;onClose:()=>void}){
 const t=useLabels();const state=useParticipants(scope,target,!!target);const person=state?.items[0];const avatar=useAvatar(person?.auth_user_id??null);
 return <Modal open title={t.profile} onClose={onClose} mobileSheet>{target&&!state?<Spinner/>:person?<UserProfileLayout name={person.name} authId={person.auth_user_id} photo={avatar.photo} loading={avatar.loading}>
  <div className="flex gap-3"><Building2 size={17} className="app-muted"/><div><dt className="app-muted text-xs">{t.organization}</dt><dd>{person.organization_name}</dd></div></div>
  <div className="flex gap-3"><BookOpen size={17} className="app-muted"/><div><dt className="app-muted text-xs">{t.course}</dt><dd>{person.course_name}</dd></div></div>
  <div className="flex gap-3"><GraduationCap size={17} className="app-muted"/><div><dt className="app-muted text-xs">{t.role}</dt><dd>{t[person.academic_role]}</dd></div></div>
 </UserProfileLayout>:<><UserProfileLayout name={name} authId={null} photo={null} loading={false}>{null}</UserProfileLayout><p role="alert" className="app-muted text-sm">{t.error}</p></>}</Modal>;
}
function Teacher({person,onOpen}:{person:Participant;onOpen:()=>void}){const avatar=useAvatar(person.auth_user_id);return <button type="button" onClick={onOpen} className="flex items-center gap-3 text-left hover:underline"><UserAvatar userId={person.auth_user_id??person.name} name={person.name} photo={avatar.photo} loading={avatar.loading}/><span className="font-semibold break-words">{person.name}</span></button>;}
export function AssignedInstructor(scope:Scope){const t=useLabels();const state=useParticipants(scope,null,true);const [selected,setSelected]=useState<Participant|null>(null);
 return <section className="app-panel rounded-2xl border border-[var(--app-panel-border)] p-5 space-y-3"><h2 className="flex items-center gap-2 font-semibold"><GraduationCap size={20}/>{t.teacher}</h2>{!state?<Spinner/>:state.error?<p role="alert">{t.error}</p>:!state.items.length?<p className="app-muted text-sm">{t.none}</p>:state.items.map(p=><Teacher key={p.auth_user_id??p.name} person={p} onOpen={()=>setSelected(p)}/>)}{selected&&<AcademicProfileModal scope={scope} target={selected.auth_user_id} name={selected.name} onClose={()=>setSelected(null)}/>}</section>;
}

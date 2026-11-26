/** Inicio por contexto: consultas existentes, sin ampliar permisos ni simular estadísticas. */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Building2, Users, GraduationCap, BookOpen, Wallet, MapPinned, Activity, ShieldCheck, BrainCircuit, ClipboardList, type LucideIcon } from 'lucide-react';
import { Panel, Stat } from './DashboardComponents';
import { AcademicDashboard } from './AcademicDashboard';
import { Spinner } from '../../components/shared/Spinner';
import { OptionSelect } from '../../components/shared/OptionSelect';
import { InstitutionMap } from '../organizations/InstitutionMap';
import { concepts, demoMonth, seedIncome, summarize } from '../income/demoIncome';
import type { Organization } from '../organizations/types';
import type { InstitutionMembership } from '../../lib/institutionContext';
import type { Section } from '../../routes';
import { availableDashboardRoles, knownTotal, type DashboardRole } from './dashboardScope';
const API=import.meta.env.VITE_API_URL||'http://localhost:8000';
const words={
 es:{welcome:'Bienvenido',view:'Vista de Inicio',global:'Administración global',choose:'Selecciona una institución',institutions:'Instituciones consultadas',students:'Alumnos registrados',enrollments:'Matrículas registradas',located:'Instituciones geolocalizadas',offers:'Ofertas publicadas',teachers:'Docentes activos consultados',map:'Mapa institucional',quick:'Accesos rápidos',service:'Conexión con FastAPI',online:'Disponible',offline:'No disponible',checking:'Comprobando',finance:'Resumen financiero DEMO',paid:'Ingresos recibidos',pending:'Pendiente de pago',month:'Noviembre 2026 · Datos ficticios iniciales',assignment:'Asignaciones docentes',assigned:'Con docente',unassigned:'Sin docente',sample:'Ofertas no canceladas consultadas (máximo 200)',limited:'Directorio consultado (máximo 250)',empty:'Sin registros disponibles',failed:'No se pudieron consultar algunos datos.',later:'Tu Inicio especializado se incorporará en el próximo incremento.',enrollment:'Matrículas',monthly:'Mensualidades',course:'Venta de cursos',certificate:'Certificaciones'},
 en:{welcome:'Welcome',view:'Home view',global:'Global administration',choose:'Select an institution',institutions:'Institutions retrieved',students:'Registered students',enrollments:'Registered enrollments',located:'Geolocated institutions',offers:'Published offerings',teachers:'Active instructors retrieved',map:'Institution map',quick:'Quick actions',service:'FastAPI connection',online:'Available',offline:'Unavailable',checking:'Checking',finance:'DEMO financial summary',paid:'Income received',pending:'Outstanding',month:'November 2026 · Initial fictional data',assignment:'Instructor assignments',assigned:'Assigned',unassigned:'Unassigned',sample:'Non-cancelled offerings retrieved (up to 200)',limited:'Directory retrieved (up to 250)',empty:'No records available',failed:'Some data could not be retrieved.',later:'Your specialized home will be added in the next increment.',enrollment:'Enrollments',monthly:'Monthly fees',course:'Course sales',certificate:'Certificates'},
 pt:{welcome:'Bem-vindo',view:'Visão inicial',global:'Administração global',choose:'Selecione uma instituição',institutions:'Instituições consultadas',students:'Alunos registrados',enrollments:'Matrículas registradas',located:'Instituições geolocalizadas',offers:'Ofertas publicadas',teachers:'Docentes ativos consultados',map:'Mapa institucional',quick:'Acessos rápidos',service:'Conexão com FastAPI',online:'Disponível',offline:'Indisponível',checking:'Verificando',finance:'Resumo financeiro DEMO',paid:'Receitas recebidas',pending:'Valor pendente',month:'Novembro 2026 · Dados fictícios iniciais',assignment:'Atribuições docentes',assigned:'Com docente',unassigned:'Sem docente',sample:'Ofertas não canceladas consultadas (até 200)',limited:'Diretório consultado (até 250)',empty:'Sem registros disponíveis',failed:'Não foi possível consultar alguns dados.',later:'Sua visão inicial especializada será adicionada na próxima versão.',enrollment:'Matrículas',monthly:'Mensalidades',course:'Venda de cursos',certificate:'Certificações'}
};
type Offering={id:string;course_title:string;instructor_id:string|null};
type Snapshot={offers:number|null;teachers:number|null;assignments:Offering[]|null;failed:boolean};
const empty:Snapshot={offers:null,teachers:null,assignments:null,failed:false};
interface Props {name:string;token:string|null;globalRoles:string[];memberships:InstitutionMembership[];organizationId:string;organizations:Organization[];loading:boolean;error:string;apiStatus:'checking'|'online'|'offline';access:Record<Section,boolean>;onNavigate:(s:Section)=>void;}
const shortcuts: [Section,LucideIcon][]=[['organizations',Building2],['users',Users],['courses',BookOpen],['students',GraduationCap],['enrollments',ClipboardList],['activity',Activity],['income',Wallet],['intelligence',BrainCircuit],['security',ShieldCheck],['profile',Users],['settings',Activity]];
export function DashboardPage(props:Props){
 const {t,i18n}=useTranslation();const lang=i18n.language.startsWith('pt')?'pt':i18n.language.startsWith('en')?'en':'es';const c=words[lang];
 const roles=availableDashboardRoles(props.globalRoles,props.memberships,props.organizationId);
 const [chosen,setChosen]=useState<DashboardRole|null>(null);const role=chosen&&roles.includes(chosen)?chosen:roles[0];
 const manager=role==='institution_admin'||role==='coordinator';const global=role==='superadmin';
 const org=props.organizations.find(o=>o.id===props.organizationId);
 const [mapId,setMapId]=useState<string|null>(null);
 const [snapshot,setSnapshot]=useState<{key:string;value:Snapshot}>({key:'',value:empty});
 const scopeKey=manager?`${props.organizationId}:${role}`:'';
 const data=snapshot.key===scopeKey?snapshot.value:empty;
 const [busy,setBusy]=useState(false);
 // Solo gestores consultan estos endpoints. Se descartan resultados de un contexto anterior.
 useEffect(()=>{if(!manager||!props.token||!props.organizationId)return;const ctrl=new AbortController();setBusy(true);setSnapshot({key:scopeKey,value:empty});
 const root=`${API}/api/v1/academic/organizations/${encodeURIComponent(props.organizationId)}`;
 const get=async(path:string)=>{const res=await fetch(root+path,{headers:{Authorization:`Bearer ${props.token}`},signal:ctrl.signal});if(!res.ok)throw new Error(String(res.status));return res.json();};
 void Promise.allSettled([get('/course-offerings?limit=1'),get('/instructors'),get('/activity/offerings')]).then(([a,b,d])=>{if(ctrl.signal.aborted)return;setSnapshot({key:scopeKey,value:{offers:a.status==='fulfilled'&&typeof a.value.total==='number'?a.value.total:null,teachers:b.status==='fulfilled'&&Array.isArray(b.value.items)?b.value.items.length:null,assignments:d.status==='fulfilled'&&Array.isArray(d.value.items)?d.value.items:null,failed:[a,b,d].some(x=>x.status==='rejected')}});setBusy(false);});return()=>ctrl.abort();},[manager,props.token,props.organizationId,scopeKey]);
 const scopedOrgs=global?props.organizations:org?[org]:[];
 const totalsReady=!props.loading&&!props.error&&(global||Boolean(org));
 const money=(n:number)=>new Intl.NumberFormat(lang==='es'?'es-PE':lang==='pt'?'pt-BR':'en-US',{style:'currency',currency:'PEN'}).format(n/100);
 const finance=seedIncome.filter(r=>r.date.startsWith(demoMonth));const totals=summarize(finance);
 const assigned=data.assignments?.filter(o=>Boolean(o.instructor_id)).length;
 // Accesos visuales por vista, intersectados con la política central existente.
 const allowed:Section[]=global?['organizations','users','courses','intelligence','security']:role==='institution_admin'?['users','courses','students','enrollments','activity','income']:role==='coordinator'?['courses','students','enrollments','activity']:role==='instructor'?['courses','activity']:role==='student'?['courses']:role==='ml_engineer'?['intelligence']:[];
 return <div className="space-y-5">
 <section className="rounded-2xl bg-gradient-to-r from-sky-900 to-blue-700 p-6 text-white"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-sky-100">{new Intl.DateTimeFormat(lang,{dateStyle:'full'}).format(new Date())}</p><h2 className="mt-2 text-2xl font-semibold">{c.welcome}, {props.name}</h2><p className="mt-2 text-sm text-sky-100">{global?c.global:org?.name??c.choose} · {t(`account.role_${role??'user'}`)}</p></div><GraduationCap size={58} className="opacity-70"/></div></section>
 {roles.length>1&&<div className="max-w-sm"><OptionSelect ariaLabel={c.view} value={role??''} onChange={v=>setChosen(v as DashboardRole)} options={roles.map(r=>({value:r,label:t(`account.role_${r}`)}))}/></div>}
 {(global||manager)&&<><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
 {global?<><Stat title={c.institutions} value={totalsReady?scopedOrgs.length:null} Icon={Building2}/><Stat title={c.located} value={totalsReady?scopedOrgs.filter(o=>o.latitude!=null&&o.longitude!=null).length:null} Icon={MapPinned}/></>:<><Stat title={c.offers} value={data.offers} Icon={BookOpen}/><Stat title={c.teachers} value={data.teachers} Icon={Users} hint={c.limited}/></>}
 <Stat title={c.students} value={totalsReady?knownTotal(scopedOrgs.map(o=>o.student_count)):null} Icon={GraduationCap}/><Stat title={c.enrollments} value={totalsReady?knownTotal(scopedOrgs.map(o=>o.enrollment_count)):null} Icon={ClipboardList}/></div>
 {(props.loading||(manager&&busy))&&<Spinner label={t('common.loading')}/>}{(props.error||data.failed)&&<p role="alert" className="app-warning rounded-xl border p-3 text-sm">{c.failed}</p>}
 <div className="grid gap-4 lg:grid-cols-2">
 {global&&<Panel title={c.map}><div className="h-[380px]"><InstitutionMap organizations={scopedOrgs} selectedId={mapId} onSelect={setMapId}/></div></Panel>}
 {manager&&<Panel title={c.assignment}><p className="app-muted text-xs">{c.sample}</p><div className="grid grid-cols-2 gap-3"><Stat title={c.assigned} value={assigned} Icon={Users}/><Stat title={c.unassigned} value={data.assignments&&assigned!==undefined?data.assignments.length-assigned:null} Icon={Users}/></div>{data.assignments?.length===0&&<p className="app-muted text-sm">{c.empty}</p>}{data.assignments?.slice(0,5).map(o=><div key={o.id} className="flex justify-between gap-3 border-b border-current/10 pb-2 text-sm"><span>{o.course_title}</span><span className="app-muted">{o.instructor_id?c.assigned:c.unassigned}</span></div>)}</Panel>}
 {role==='institution_admin'&&props.access.income&&<Panel title={c.finance}><p className="app-muted text-xs">{c.month}</p><div className="grid grid-cols-2 gap-3"><Stat title={c.paid} value={money(totals.paid)} Icon={Wallet}/><Stat title={c.pending} value={money(totals.pending)} Icon={Wallet}/></div>{concepts.map(k=>{const n=summarize(finance.filter(r=>r.concept===k)).paid;return <div key={k}><div className="flex justify-between text-sm"><span>{c[k]}</span><span>{money(n)}</span></div><div className="mt-1 h-2 rounded-full" style={{background:'var(--app-control-hover)'}}><div className="h-full rounded-full bg-sky-500" style={{width:`${totals.paid?n/totals.paid*100:0}%`}}/></div></div>})}<button onClick={()=>props.onNavigate('income')} className="app-accent flex items-center gap-2 text-sm">{t('nav.income')}<ArrowRight size={16}/></button></Panel>}
 {global&&<Panel title={c.service}><p role="status" className="flex items-center gap-2"><Activity className="app-accent"/>{c[props.apiStatus]}</p></Panel>}
 </div></>}
 {(role==='student'||role==='instructor')&&props.token&&props.organizationId&&props.access.courses&&<AcademicDashboard key={`${role}:${props.organizationId}`} organizationId={props.organizationId} token={props.token} role={role}/>}
 {!global&&!manager&&role!=='student'&&role!=='instructor'&&<Panel title={t(`account.role_${role??'user'}`)}><p className="app-muted text-sm">{c.later}</p></Panel>}
 <Panel title={c.quick}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{shortcuts.filter(([s])=>(allowed.includes(s)||s==='profile'||s==='settings')&&props.access[s]).map(([s,Icon])=><button key={s} onClick={()=>props.onNavigate(s)} className="app-secondary-button flex items-center gap-2 rounded-xl border p-3 text-left text-sm"><Icon size={20} className="app-accent"/><span className="flex-1">{s==='profile'?t('account.viewProfile'):t(`nav.${s}`)}</span><ArrowRight size={15}/></button>)}</div></Panel>
 </div>;
}

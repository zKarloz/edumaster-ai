/** Inicio especializado: inventario conceptual y configuración DEMO, sin ampliar permisos. */
import { ArrowRight, BrainCircuit, Database, Layers, Cpu, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { normalizeLocale } from '../../i18n';
import { AcademicReadiness } from '../intelligence/components/AcademicReadiness';
import dataset from '../intelligence/ml/demoDataset.json';
import { Panel, Stat } from './DashboardComponents';

const copy = {
 es: { sources:'Fuentes académicas previstas', inventory:'Catálogo de fuentes; no indica disponibilidad ni cantidad de registros.', labels:['Matrículas','Ofertas académicas','Eventos de aprendizaje','Actividades académicas','Evaluaciones','Progreso académico','Entregas','Calificaciones oficiales','Evidencias de competencias'], access:'Acceso a datos institucionales', restricted:'Las estadísticas institucionales del analista requieren una autorización específica, aún pendiente. No se consultan registros personales.', authorized:'Esta cuenta también tiene permisos de superadministración para consultar el diagnóstico agregado.', demo:'Laboratorio neuronal DEMO', samples:'Registros sintéticos', inputs:'Variables de entrada', params:'Parámetros configurados', engine:'Motor', architecture:'Arquitectura configurada', split:'Distribución del dataset sintético', partitions:['Entrenamiento','Validación','Prueba'], note:'Configuración del laboratorio, no resultados de entrenamiento. No utiliza datos académicos reales.', real:'Entrenamiento institucional', unavailable:'No habilitado. Requiere datos suficientes, validación y autorización.', open:'Abrir laboratorio neuronal', denied:'El laboratorio no está autorizado en este contexto.' },
 en: { sources:'Planned academic sources', inventory:'Source catalog; does not indicate availability or record counts.', labels:['Enrollments','Course offerings','Learning events','Academic activities','Assessments','Academic progress','Submissions','Official grades','Skill evidence'], access:'Institutional data access', restricted:'Analyst access to institutional statistics requires a specific authorization, still pending. No personal records are queried.', authorized:'This account also has superadmin permission to query aggregate diagnostics.', demo:'DEMO neural lab', samples:'Synthetic records', inputs:'Input variables', params:'Configured parameters', engine:'Engine', architecture:'Configured architecture', split:'Synthetic dataset split', partitions:['Training','Validation','Test'], note:'Lab configuration, not training results. No real academic data is used.', real:'Institutional training', unavailable:'Not enabled. Requires sufficient data, validation and authorization.', open:'Open neural lab', denied:'The lab is not authorized in this context.' },
 pt: { sources:'Fontes acadêmicas previstas', inventory:'Catálogo de fontes; não indica disponibilidade nem quantidade de registros.', labels:['Matrículas','Ofertas acadêmicas','Eventos de aprendizagem','Atividades acadêmicas','Avaliações','Progresso acadêmico','Entregas','Notas oficiais','Evidências de competências'], access:'Acesso a dados institucionais', restricted:'As estatísticas institucionais do analista exigem autorização específica, ainda pendente. Não são consultados registros pessoais.', authorized:'Esta conta também tem permissão de superadministrador para consultar o diagnóstico agregado.', demo:'Laboratório neural DEMO', samples:'Registros sintéticos', inputs:'Variáveis de entrada', params:'Parâmetros configurados', engine:'Motor', architecture:'Arquitetura configurada', split:'Divisão do conjunto sintético', partitions:['Treinamento','Validação','Teste'], note:'Configuração do laboratório, não resultados de treinamento. Não utiliza dados acadêmicos reais.', real:'Treinamento institucional', unavailable:'Não habilitado. Requer dados suficientes, validação e autorização.', open:'Abrir laboratório neural', denied:'O laboratório não está autorizado neste contexto.' },
} as const;

interface Props {
  role: 'analyst' | 'ml_engineer';
  canUseLab: boolean;
  isSuperadmin: boolean;
  token: string | null;
  organizations: {id:string;name:string}[];
  onOpenLab: () => void;
}

export function SpecialistDashboard({role,canUseLab,isSuperadmin,token,organizations,onOpenLab}:Props) {
  const {i18n}=useTranslation();
  const locale=normalizeLocale(i18n.language);
  const c=copy[locale];
  // El diagnóstico existente exige superadmin también en FastAPI.
  const readiness=isSuperadmin&&token&&<AcademicReadiness locale={locale} token={token} organizations={organizations}/>;
  if(role==='analyst') return <div className="grid gap-4 lg:grid-cols-2">
    <Panel title={c.sources}><p className="app-muted text-sm">{c.inventory}</p><ul className="grid gap-2 sm:grid-cols-2">{c.labels.map(label=><li key={label} className="flex items-center gap-2 rounded-lg border border-[var(--app-control-border)] p-3 text-sm"><Database size={16} className="app-accent shrink-0"/>{label}</li>)}</ul></Panel>
    <Panel title={c.access}><ShieldCheck className="app-accent" size={28}/><p className="app-muted text-sm">{isSuperadmin?c.authorized:c.restricted}</p>{readiness}</Panel>
  </div>;
  if(!canUseLab) return <Panel title={c.demo}><p className="app-muted text-sm">{c.denied}</p></Panel>;
  // Misma topología configurada en el worker TensorFlow.js; no representa pesos aprendidos.
  const dimensions=[dataset.columns.length,8,4,1];
  const parameters=dimensions.slice(1).reduce((sum,width,i)=>sum+(dimensions[i]!+1)*width,0);
  const partitions=[dataset.splits.train.x.length,dataset.splits.validation.x.length,dataset.splits.test.x.length];
  const total=partitions.reduce((a,b)=>a+b,0);
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat title={c.samples} value={total} Icon={Database}/><Stat title={c.inputs} value={dimensions[0]} Icon={Layers}/><Stat title={c.params} value={parameters} Icon={BrainCircuit}/><Stat title={c.engine} value="TensorFlow.js" Icon={Cpu}/></div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={c.demo}><p className="app-muted text-sm">{c.note}</p><p className="text-sm font-medium">{c.architecture}</p><div className="flex flex-wrap items-center gap-2">{dimensions.map((n,i)=><div key={i} className="flex items-center gap-2">{i>0&&<ArrowRight size={15} className="app-muted"/>}<span className="app-secondary-button rounded-xl border border-[var(--app-control-border)] px-4 py-3 text-xl font-semibold tabular-nums">{n}</span></div>)}</div><button type="button" onClick={onOpenLab} className="app-accent flex items-center gap-2 text-sm">{c.open}<ArrowRight size={16}/></button></Panel>
      <Panel title={c.split}>{partitions.map((n,i)=><div key={i} className="space-y-1"><div className="flex justify-between gap-2 text-sm"><span>{c.partitions[i]}</span><span className="tabular-nums">{n}</span></div><div className="h-2 rounded-full bg-[var(--app-control-hover)]"><div className="h-full rounded-full bg-sky-500" style={{width:`${total?n/total*100:0}%`}}/></div></div>)}</Panel>
      <Panel title={c.real}><p className="app-muted text-sm">{c.unavailable}</p>{readiness}</Panel>
    </div>
  </div>;
}

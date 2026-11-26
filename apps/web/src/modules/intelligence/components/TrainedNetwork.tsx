/** Inspección del snapshot real del checkpoint DEMO; los pulsos solo ilustran su recorrido. */
import {useEffect,useState} from 'react';
import {Play,Pause,RotateCcw,Network} from 'lucide-react';
import type {Locale} from '../../../i18n';
import type {WorkerEvent} from '../ml/protocol';
import {buildGraph} from '../ml/graph';
type Result=Extract<WorkerEvent,{type:'done'}>;
const texts={
 es:{title:'Arquitectura entrenada',note:'Inferencia real sobre datos sintéticos. Los pulsos reproducen visualmente el recorrido; no son entrenamiento en vivo.',focus:'El enfoque no modifica los datos ni la predicción.',sample:'Ejemplo de prueba',all:'Vista general',play:'Reproducir',pause:'Pausar',resume:'Continuar',input:'Entradas',hidden:'Capa oculta',output:'Finalización en 30 días',weight:'Peso',bias:'Sesgo',activation:'Activación',raw:'Original',normalized:'Normalizado',contribution:'Entrada × peso',positive:'Peso positivo',negative:'Peso negativo',zero:'Peso cero',inspect:'Selecciona una neurona o conexión',group:'Categoría',groups:['Uso de plataforma','Rendimiento','Progreso y entregas','Interacciones','Contexto del curso','Otra variable'],best:'Mejor época',stage:'Etapa',edge:'Conexión',node:'Neurona',none:'Asistencias y comentarios no son entradas del modelo actual.'},
 en:{title:'Trained architecture',note:'Actual inference on synthetic data. Pulses replay the path visually; they are not live training.',focus:'Focus does not change data or prediction.',sample:'Test example',all:'Overview',play:'Replay',pause:'Pause',resume:'Resume',input:'Inputs',hidden:'Hidden layer',output:'Completion in 30 days',weight:'Weight',bias:'Bias',activation:'Activation',raw:'Raw',normalized:'Normalized',contribution:'Input × weight',positive:'Positive weight',negative:'Negative weight',zero:'Zero weight',inspect:'Select a node or connection',group:'Category',groups:['Platform usage','Performance','Progress and submissions','Interactions','Course context','Other feature'],best:'Best epoch',stage:'Stage',edge:'Connection',node:'Neuron',none:'Attendance and comments are not inputs of the current model.'},
 pt:{title:'Arquitetura treinada',note:'Inferência real com dados sintéticos. Os pulsos reproduzem o percurso visualmente; não são treinamento ao vivo.',focus:'O foco não altera os dados nem a previsão.',sample:'Exemplo de teste',all:'Visão geral',play:'Reproduzir',pause:'Pausar',resume:'Continuar',input:'Entradas',hidden:'Camada oculta',output:'Conclusão em 30 dias',weight:'Peso',bias:'Viés',activation:'Ativação',raw:'Original',normalized:'Normalizado',contribution:'Entrada × peso',positive:'Peso positivo',negative:'Peso negativo',zero:'Peso zero',inspect:'Selecione um neurônio ou conexão',group:'Categoria',groups:['Uso da plataforma','Desempenho','Progresso e entregas','Interações','Contexto do curso','Outra variável'],best:'Melhor época',stage:'Etapa',edge:'Conexão',node:'Neurônio',none:'Presença e comentários não são entradas do modelo atual.'}
} as const;
const features:Record<string,[number,string,string,string]>={
 active_days_14d:[0,'Días activos (14 d)','Active days (14 d)','Dias ativos (14 d)'],sessions_14d:[0,'Sesiones (14 d)','Sessions (14 d)','Sessões (14 d)'],days_since_last_activity:[0,'Días sin actividad','Days since activity','Dias sem atividade'],completion_ratio:[2,'Proporción de avance','Completion ratio','Proporção de progresso'],assessment_mean:[1,'Promedio de notas','Assessment mean','Média de notas'],has_assessments:[1,'Tiene evaluaciones','Has assessments','Tem avaliações'],assessment_trend:[1,'Tendencia de notas','Assessment trend','Tendência de notas'],late_submissions_30d:[2,'Entregas tardías (30 d)','Late submissions (30 d)','Entregas atrasadas (30 d)'],content_engagement:[3,'Interacciones con contenido','Content engagement','Interações com conteúdo'],skill_evidence_score:[1,'Evidencia DEMO (notas)','DEMO evidence (grades)','Evidência DEMO (notas)'],level_basico:[4,'Nivel básico','Basic level','Nível básico'],level_intermedio:[4,'Nivel intermedio','Intermediate level','Nível intermediário'],level_avanzado:[4,'Nivel avanzado','Advanced level','Nível avançado']
};
const fmt=(v:number)=>v.toFixed(4);
// Misma apariencia eléctrica que la vista conceptual, con una sola pasada por etapa.
const PULSE_MAX_MS=1760;
const PHASE_DURATION_MS=PULSE_MAX_MS+80;
function TrainedSignalPulse({x1,y1,x2,y2,weightColor,index}:{x1:number;y1:number;x2:number;y2:number;weightColor:string;index:number}) {
 const duration=(1.4+(index%4)*0.12).toFixed(2);
 const length=Math.hypot(x2-x1,y2-y1)||1;
 const ux=(x2-x1)/length,uy=(y2-y1)/length;
 // La señal sale y llega al borde de los nodos, sin cubrir sus centros.
 return <g className="neural-signal-pulse" style={{color:weightColor}}>
  <line x1="-17" y1="0" x2="-3" y2="0" className="neural-signal-tail"/>
  <circle r="6.5" className="neural-signal-glow" filter="url(#trained-neural-pulse-blur)"/>
  <circle r="2.5" className="neural-signal-core"/>
  <animateMotion path={`M ${x1+10*ux} ${y1+10*uy} L ${x2-10*ux} ${y2-10*uy}`} dur={`${duration}s`} repeatCount="1" rotate="auto" fill="freeze"/>
 </g>;
}
/** Etiqueta opaca para que las conexiones no dificulten leer la activación. */
function ActivationLabel({x,y,value}:{x:number;y:number;value:string}) {
 const width=Math.max(50,value.length*7+10);
 return <g pointerEvents="none">
  <rect x={x} y={y-9} width={width} height={18} rx={4} fill="#0b1728" stroke="var(--app-panel-border)" strokeWidth="0.7"/>
  <text x={x+width/2} y={y+4} textAnchor="middle" fontSize="11" fontWeight="600" fill="#f1f5f9">{value}</text>
 </g>;
}
export function TrainedNetwork({locale,result,sampleIndex,onSample,allowMotion}:{locale:Locale;result:Result;sampleIndex:number;onSample:(i:number)=>void;allowMotion:boolean}){
 const t=texts[locale]; const sample=result.samples[sampleIndex]!;
 const {values,edges}=buildGraph(result.columns,result.weights,sample);
 const [node,setNode]=useState<{layer:number;index:number}|null>(null);
 const [edge,setEdge]=useState<number|null>(null);
 const [group,setGroup]=useState<number|null>(null);
 const [phase,setPhase]=useState(values.length-1);const [playing,setPlaying]=useState(false);const [replayKey,setReplayKey]=useState(0);
 const last=values.length-1;
 useEffect(()=>{setReplayKey(k=>k+1);setPhase(0);setPlaying(allowMotion);},[sampleIndex,result,allowMotion]);
 useEffect(()=>{if(!allowMotion||!playing||phase>=last)return;const timer=window.setTimeout(()=>setPhase(p=>p+1),PHASE_DURATION_MS);return ()=>window.clearTimeout(timer);},[allowMotion,playing,phase,last,replayKey]);
 const stage=allowMotion?phase:last;
 const selectedEdge=edge===null?undefined:edges[edge];
 const feature=(i:number)=>features[result.columns[i]!] ?? [5,result.columns[i]!,result.columns[i]!,result.columns[i]!] as const;
 const featureName=(i:number)=>feature(i)[locale==='es'?1:locale==='en'?2:3];
 const height=Math.max(420,Math.max(...values.map(v=>v.length))*35+70);
 const x=(l:number)=>235+l*185;
 const y=(l:number,i:number)=>height/2+(i-(values[l]!.length-1)/2)*35;
 const maxWeight=Math.max(1e-9,...edges.map(e=>Math.abs(e.weight)));
 const color=(w:number)=>w>0?'var(--neural-active)':w<0?'var(--neural-middle)':'var(--neural-line)';
 const inputFocused=(i:number)=>(group===null||feature(i)[0]===group)&&(node?.layer!==0||node.index===i);
 const name=(l:number,i:number)=>l===0?featureName(i):l===last?t.output:`${t.hidden} ${l} · N${i+1}`;
 const button='app-secondary-button rounded-lg border border-[var(--app-control-border)] px-3 py-2 text-sm';
 function chooseNode(l:number,i:number){setNode({layer:l,index:i});setEdge(null);setGroup(null);replay();}
 function replay(){setReplayKey(k=>k+1);setPhase(allowMotion?0:last);setPlaying(allowMotion);}
 return <section className="app-panel space-y-4 rounded-2xl border border-[var(--app-panel-border)] p-4" aria-label={t.title}>
 <header><h3 className="flex items-center gap-2 font-bold"><Network size={20} className="app-accent"/>{t.title} <span className="neural-demo-pill rounded-full px-2 py-1 text-xs">SYNTHETIC DEMO</span></h3><p className="app-muted mt-2 text-sm">{t.note}</p><p className="app-muted text-sm">{t.focus} {t.none}</p></header>
 <div className="flex flex-wrap items-center gap-2"><label className="text-sm">{t.sample} <select className={button} value={sampleIndex} onChange={e=>onSample(Number(e.target.value))}>{result.samples.map((_,i)=><option key={i} value={i}>{i+1}</option>)}</select></label><button type="button" className={button} onClick={()=>{setNode(null);setEdge(null);setGroup(null);}}>{t.all}</button><button type="button" className={button} onClick={replay}><RotateCcw className="inline" size={15}/> {t.play}</button><button type="button" className={button} disabled={!allowMotion||phase>=last} onClick={()=>setPlaying(p=>!p)}>{playing?<Pause className="inline" size={15}/>:<Play className="inline" size={15}/>} {playing?t.pause:t.resume}</button><span className="app-muted text-sm">{t.best}: {result.epoch} · {t.stage}: {stage}/{last}</span></div>
 <div className="flex flex-wrap gap-2">{t.groups.slice(0,5).map((g,i)=><button type="button" key={g} className={button} aria-pressed={group===i} style={group===i?{background:'var(--neural-focus)',borderColor:'var(--neural-active)'}:undefined} onClick={()=>{setGroup(group===i?null:i);setNode(null);setEdge(null);replay();}}>{g}</button>)}</div>
 <div className="overflow-x-auto rounded-xl border border-[var(--app-panel-border)]" style={{background:'var(--neural-scene)'}}><svg viewBox={`0 0 ${x(last)+150} ${height}`} style={{minWidth:x(last)+150,width:'100%'}} aria-label={t.title}>
 <defs><filter id="trained-neural-pulse-blur" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="3.5"/></filter></defs>
 {values.map((v,l)=><text key={l} x={x(l)} y={24} textAnchor="middle" fontSize="13" fill="var(--neural-label)">{l===0?t.input:l===last?'Sigmoid':`${t.hidden} ${l} · ReLU`} ({v.length})</text>)}
 {edges.map((e,i)=>{const focused=(e.layer!==0||inputFocused(e.from))&&(!node||node.layer===0||(node.layer===e.layer&&node.index===e.from)||(node.layer===e.layer+1&&node.index===e.to))&&(edge===null||edge===i);const a=x(e.layer),b=x(e.layer+1),c=y(e.layer,e.from),d=y(e.layer+1,e.to);return <g key={i} opacity={focused?(stage > e.layer ? .95 : .32):.08}><line x1={a} x2={b} y1={c} y2={d} stroke={color(e.weight)} strokeWidth={edge===i?4:0.6+2.4*Math.abs(e.weight)/maxWeight}/><line x1={a} x2={b} y1={c} y2={d} stroke="transparent" strokeWidth="7" style={{cursor:'pointer'}} onClick={()=>{setEdge(i);setNode(null);setGroup(null);replay();}}><title>{name(e.layer,e.from)} → {name(e.layer+1,e.to)}: {fmt(e.weight)}</title></line>{allowMotion&&playing&&focused&&stage===e.layer&&<g className="neural-signals" pointerEvents="none"><TrainedSignalPulse key={replayKey} x1={a} y1={c} x2={b} y2={d} weightColor={color(e.weight)} index={i}/></g>}</g>;})}
 {values.map((v,l)=>v.map((value,i)=><g key={`${l}-${i}`} role="button" tabIndex={0} aria-label={`${name(l,i)}: ${fmt(value)}`} aria-pressed={node?.layer===l&&node.index===i} onClick={()=>chooseNode(l,i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseNode(l,i);}}} style={{cursor:'pointer'}} opacity={l===0 && !inputFocused(i) ? .22 : stage<l ? .45 : 1}><title>{name(l,i)}: {fmt(value)}</title>{l===0&&<text x={x(l)-17} y={y(l,i)+4} textAnchor="end" fontSize="11" fill="var(--neural-label)">{featureName(i)}</text>}<circle cx={x(l)} cy={y(l,i)} r={node?.layer===l&&node.index===i?13:10} stroke={l===last?'var(--neural-output)':'var(--neural-active)'} strokeWidth="2" fill="var(--neural-scene)"/><circle cx={x(l)} cy={y(l,i)} r="4" fill="var(--neural-active)" opacity={value===0 ? .22 : 1}/>{l>0&&<ActivationLabel x={x(l)+15} y={y(l,i)} value={l===last?`${(sample.prediction*100).toFixed(2)}%`:fmt(value)}/>}</g>))}
 </svg></div>
 <p className="flex flex-wrap gap-4 text-xs"><span style={{color:color(1)}}>● {t.positive}</span><span style={{color:color(-1)}}>◆ {t.negative}</span><span style={{color:color(0)}}>○ {t.zero}</span></p>
 <label className="block text-sm">{t.edge} <select className={`${button} max-w-full`} value={edge??''} onChange={e=>{setEdge(e.target.value===''?null:Number(e.target.value));setNode(null);setGroup(null);replay();}}><option value="">—</option>{edges.map((e,i)=><option key={i} value={i}>{name(e.layer,e.from)} → {name(e.layer+1,e.to)}</option>)}</select></label>
 <div className="rounded-xl border border-[var(--app-panel-border)] p-3 text-sm" aria-live="polite">{selectedEdge?<><strong>{name(selectedEdge.layer,selectedEdge.from)} → {name(selectedEdge.layer+1,selectedEdge.to)}</strong><p>{t.weight}: {fmt(selectedEdge.weight)} · {t.contribution}: {fmt(selectedEdge.contribution)}</p></>:node?<><strong>{name(node.layer,node.index)}</strong>{node.layer===0?<p>{t.group}: {t.groups[feature(node.index)[0]]} · {t.raw}: {fmt(sample.raw[node.index]!)} · {t.normalized}: {fmt(sample.normalized[node.index]!)}</p>:<p>{t.activation}: {fmt(values[node.layer]![node.index]!)} · {t.bias}: {fmt(result.weights[node.layer-1]!.bias[node.index]!)}</p>}</>:t.inspect}</div>
 </section>;
}

/** Laboratorio local separado del visualizador conceptual. No realiza llamadas a API. */
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { BrainCircuit, Play, Square } from 'lucide-react';
import { Spinner } from '../../../components/shared/Spinner';
import type { Locale } from '../../../i18n';
import { defaults, validConfig, type TrainingConfig, type WorkerEvent } from '../ml/protocol';
import { ExperimentDetails, TrainingHistory, ConfigEditor } from './ExperimentDetails';
const labels = {
  es: {metric:'Métrica',title:'Laboratorio neuronal local',note:'Modelo experimental entrenado con datos sintéticos. No válido para decisiones académicas.',start:'Entrenar modelo DEMO',stop:'Cancelar',busy:'Procesando en tu dispositivo',epoch:'Época',engine:'Motor',loss:'Pérdida',val:'Validación',done:'Entrenamiento completado',best:'Mejor época',error:'No se pudo entrenar. Revisa la compatibilidad del navegador.',cancel:'Entrenamiento cancelado',test:'Evaluación de prueba',sample:'Inferencia de ejemplo sintético',acts:'Activaciones reales del ejemplo',base:'Regresión logística',network:'Red neuronal',idle:'Preparado para iniciar',layer:'Capa'},
  en: {metric:'Metric',title:'Local neural laboratory',note:'Experimental model trained on synthetic data. Not valid for academic decisions.',start:'Train DEMO model',stop:'Cancel',busy:'Processing on your device',epoch:'Epoch',engine:'Backend',loss:'Loss',val:'Validation',done:'Training completed',best:'Best epoch',error:'Training failed. Check browser compatibility.',cancel:'Training cancelled',test:'Test evaluation',sample:'Synthetic sample inference',acts:'Actual sample activations',base:'Logistic regression',network:'Neural network',idle:'Ready to start',layer:'Layer'},
  pt: {metric:'Métrica',title:'Laboratório neural local',note:'Modelo experimental treinado com dados sintéticos. Não válido para decisões acadêmicas.',start:'Treinar modelo DEMO',stop:'Cancelar',busy:'Processando no dispositivo',epoch:'Época',engine:'Motor',loss:'Perda',val:'Validação',done:'Treinamento concluído',best:'Melhor época',error:'Falha no treinamento. Verifique a compatibilidade do navegador.',cancel:'Treinamento cancelado',test:'Avaliação de teste',sample:'Inferência de exemplo sintético',acts:'Ativações reais do exemplo',base:'Regressão logística',network:'Rede neural',idle:'Pronto para iniciar',layer:'Camada'},
} as const;
type Result = Extract<WorkerEvent,{type:'done'}>;
type Epoch = Extract<WorkerEvent,{type:'epoch'}>;
export function LocalTrainingPanel({locale}:{locale:Locale}) {
  const t=labels[locale];
  const worker=useRef<Worker|null>(null);
  const [status,setStatus]=useState<'idle'|'busy'|'done'|'error'|'cancel'>('idle');
  const [backend,setBackend]=useState('');
  const [epoch,setEpoch]=useState<Epoch|null>(null);
  const [config,setConfig]=useState<TrainingConfig>({...defaults});
  const [runEpochs,setRunEpochs]=useState(defaults.epochs);
  const [history,setHistory]=useState<Epoch[]>([]);
  const [result,setResult]=useState<Result|null>(null);
  // Terminar el trabajador también al salir del módulo o cerrar sesión.
  useEffect(()=>()=>{worker.current?.terminate();worker.current=null;},[]);
  function stop(){worker.current?.terminate();worker.current=null;setStatus('cancel');}
  function start(){
    if(worker.current||!validConfig(config))return;
    setRunEpochs(config.epochs);setResult(null);setEpoch(null);setHistory([]);setBackend('');setStatus('busy');
    try {
      const w=new Worker(new URL('../workers/training.worker.ts',import.meta.url),{type:'module'});
      worker.current=w;
      const finish=(next:'done'|'error')=>{if(worker.current!==w)return;w.terminate();worker.current=null;setStatus(next);};
      w.onerror=()=>finish('error');w.onmessageerror=()=>finish('error');
      w.onmessage=(event:MessageEvent<WorkerEvent>)=>{
        if(worker.current!==w)return;
        const data=event.data;
        if(data.type==='backend')setBackend(data.backend);
        // Confirmar el estado por mensaje, sin esperar al resultado final.
        if(data.type==='epoch')flushSync(()=>{setEpoch(data);setHistory(old=>[...old,data]);});
        if(data.type==='done'){setResult(data);finish('done');}
        if(data.type==='error')finish('error');
      };
      w.postMessage({type:'start',config});
    }catch{worker.current?.terminate();worker.current=null;setStatus('error');}
  }
  const format=(v:number|null|undefined)=>v==null?'—':v.toFixed(4);
  return <section className="app-panel space-y-4 rounded-2xl border border-[var(--app-panel-border)] p-5" aria-label={t.title}>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 font-bold"><BrainCircuit className="app-accent" size={21}/>{t.title}</h3><p className="app-muted mt-2 text-sm">{t.note}</p></div>
      <span className="neural-demo-pill rounded-full px-3 py-1 text-xs font-bold">SYNTHETIC DEMO</span>
    </header>
    <p className="app-muted text-sm">TensorFlow.js · Web Worker · 13 → 8 → 4 → 1 · 150 / 50 / 50 (train / validation / test)</p>
    <ConfigEditor locale={locale} config={config} onChange={setConfig} busy={status==='busy'}/>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={status==='busy'||!validConfig(config)} onClick={start} className="app-secondary-button inline-flex items-center gap-2 rounded-xl border border-[var(--app-control-border)] px-4 py-2 text-sm font-semibold"><Play size={16}/>{t.start}</button>
      {status==='busy'&&<button type="button" onClick={stop} className="app-secondary-button inline-flex items-center gap-2 rounded-xl border border-[var(--app-control-border)] px-4 py-2 text-sm"><Square size={15}/>{t.stop}</button>}
      {status==='busy'&&<Spinner label={t.busy}/>}
    </div>
    <div role="status" aria-live="polite" className="text-sm">{status==='idle'?t.idle:status==='done'?t.done:status==='error'?t.error:status==='cancel'?t.cancel:''}</div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[[t.engine,backend||'—'],[t.epoch,epoch?`${epoch.epoch}/${runEpochs}`:'—'],[t.loss,format(epoch?.loss)],[t.val,format(epoch?.validationLoss)]].map(([name,value])=><div key={name} className="app-secondary-button rounded-xl border border-[var(--app-control-border)] p-3"><p className="app-muted text-xs">{name}</p><p className="mt-1 font-semibold tabular-nums">{value}</p></div>)}
    </div>
    <TrainingHistory locale={locale} history={history} best={result?.epoch??epoch?.bestEpoch}/>
    {result&&<div className="space-y-3"><p className="app-info rounded-lg border p-3 text-sm">{result.stopReason==='earlyStopping'?({es:'Detención anticipada: sin mejora en validación.',en:'Early stopping: no validation improvement.',pt:'Parada antecipada: sem melhora na validação.'}[locale]):({es:'Se alcanzó el máximo de épocas.',en:'Maximum epochs reached.',pt:'Máximo de épocas atingido.'}[locale])} {result.completedEpochs}/{result.config.epochs} · {t.best}: {result.epoch}</p><h4 className="font-semibold">{t.test} · {t.best}: {result.epoch}</h4>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th scope="col">{t.metric}</th><th scope="col">{t.network}</th><th scope="col">{t.base}</th></tr></thead><tbody>{(['f1','roc_auc','brier','log_loss'] as const).map(key=><tr key={key} className="app-divider border-b border-[var(--app-panel-border)]"><th scope="row" className="py-2 font-medium">{key}</th><td>{format(result.metrics[key])}</td><td>{format(result.baseline[key])}</td></tr>)}</tbody></table></div>
      <ExperimentDetails locale={locale} result={result}/> 
    </div>}
  </section>;
}

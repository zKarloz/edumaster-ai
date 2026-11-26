/** Laboratorio local separado del visualizador conceptual. Registro remoto opcional separado del entrenamiento. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { BrainCircuit, Play, Square, Save, FolderOpen, Trash2 } from 'lucide-react';
import { Spinner } from '../../../components/shared/Spinner';
import { Modal } from '../../../components/shared/Modal';
import { useToast } from '../../../components/shared/Toast';
import type { Locale } from '../../../i18n';
import { defaults, validConfig, type TrainingConfig, type WorkerEvent } from '../ml/protocol';
import dataset from '../ml/demoDataset.json';
import { fitScaler } from '../ml/core';
import { validCheckpoint, type LocalCheckpoint } from '../ml/checkpoint';
import { saveCheckpoint, readCheckpoint, deleteCheckpoint } from '../ml/checkpointStorage';
import type { LabTab } from '../ml/labTabs';
import { RemoteModels } from './RemoteModels';
import { ExperimentDetails, TrainingHistory, ConfigEditor } from './ExperimentDetails';
const labels = {
  es: {metric:'Métrica',title:'Laboratorio neuronal local',note:'Modelo experimental entrenado con datos sintéticos. No válido para decisiones académicas.',start:'Entrenar modelo DEMO',stop:'Cancelar',busy:'Procesando en tu dispositivo',epoch:'Época',engine:'Motor',loss:'Pérdida',val:'Validación',done:'Entrenamiento completado',best:'Mejor época',error:'No se pudo entrenar. Revisa la compatibilidad del navegador.',cancel:'Entrenamiento cancelado',test:'Evaluación de prueba',sample:'Inferencia de ejemplo sintético',acts:'Activaciones reales del ejemplo',base:'Regresión logística',network:'Red neuronal',idle:'Preparado para iniciar',layer:'Capa'},
  en: {metric:'Metric',title:'Local neural laboratory',note:'Experimental model trained on synthetic data. Not valid for academic decisions.',start:'Train DEMO model',stop:'Cancel',busy:'Processing on your device',epoch:'Epoch',engine:'Backend',loss:'Loss',val:'Validation',done:'Training completed',best:'Best epoch',error:'Training failed. Check browser compatibility.',cancel:'Training cancelled',test:'Test evaluation',sample:'Synthetic sample inference',acts:'Actual sample activations',base:'Logistic regression',network:'Neural network',idle:'Ready to start',layer:'Layer'},
  pt: {metric:'Métrica',title:'Laboratório neural local',note:'Modelo experimental treinado com dados sintéticos. Não válido para decisões acadêmicas.',start:'Treinar modelo DEMO',stop:'Cancelar',busy:'Processando no dispositivo',epoch:'Época',engine:'Motor',loss:'Perda',val:'Validação',done:'Treinamento concluído',best:'Melhor época',error:'Falha no treinamento. Verifique a compatibilidade do navegador.',cancel:'Treinamento cancelado',test:'Avaliação de teste',sample:'Inferência de exemplo sintético',acts:'Ativações reais do exemplo',base:'Regressão logística',network:'Rede neural',idle:'Pronto para iniciar',layer:'Camada'},
} as const;
const storageLabels={
 es:{title:'Checkpoint local DEMO',note:'Un modelo guardado por perfil del navegador y origen. No se sincroniza ni se publica. Guardar reemplaza el anterior.',save:'Guardar modelo',load:'Recuperar modelo',remove:'Eliminar guardado',confirm:'¿Eliminar el checkpoint guardado? El modelo en memoria no se eliminará.',cancel:'Cancelar',saved:'Modelo guardado.',loaded:'Modelo recuperado; no se volvió a entrenar.',deleted:'Guardado eliminado.',missing:'No hay modelo guardado.',invalid:'Checkpoint incompatible o dañado.',error:'No se pudo acceder al almacenamiento local.'},
 en:{title:'Local DEMO checkpoint',note:'One saved model per browser profile and origin. Not synced or published. Saving replaces the previous checkpoint.',save:'Save model',load:'Restore model',remove:'Delete saved model',confirm:'Delete the saved checkpoint? The in-memory model will not be deleted.',cancel:'Cancel',saved:'Model saved.',loaded:'Model restored without retraining.',deleted:'Saved model deleted.',missing:'No saved model.',invalid:'Incompatible or damaged checkpoint.',error:'Local storage unavailable.'},
 pt:{title:'Checkpoint local DEMO',note:'Um modelo por perfil do navegador e origem. Não sincronizado nem publicado. Salvar substitui o anterior.',save:'Salvar modelo',load:'Recuperar modelo',remove:'Excluir salvo',confirm:'Excluir o checkpoint salvo? O modelo em memória não será excluído.',cancel:'Cancelar',saved:'Modelo salvo.',loaded:'Modelo recuperado sem novo treinamento.',deleted:'Modelo salvo excluído.',missing:'Nenhum modelo salvo.',invalid:'Checkpoint incompatível ou danificado.',error:'Armazenamento local indisponível.'}
} as const;
type Result = Extract<WorkerEvent,{type:'done'}>;
type Epoch = Extract<WorkerEvent,{type:'epoch'}>;
export function LocalTrainingPanel({locale,onResult,sampleIndex,onSample,tab,onTab,children,token,canRegister}:{token?:string;canRegister?:boolean;children?:ReactNode;tab:LabTab;onTab:(tab:LabTab)=>void;locale:Locale;onResult:(r:Result|null)=>void;sampleIndex:number;onSample:(i:number)=>void}) {
  const t=labels[locale];const st=storageLabels[locale];const {notify}=useToast();
  const worker=useRef<Worker|null>(null);
  const [status,setStatus]=useState<'idle'|'busy'|'done'|'error'|'cancel'>('idle');
  const [backend,setBackend]=useState('');
  const [epoch,setEpoch]=useState<Epoch|null>(null);
  const [config,setConfig]=useState<TrainingConfig>({...defaults});
  const [runEpochs,setRunEpochs]=useState(defaults.epochs);
  const [history,setHistory]=useState<Epoch[]>([]);
  const [result,setResult]=useState<Result|null>(null);
  const [storageBusy,setStorageBusy]=useState(false);
  const [remoteBusy,setRemoteBusy]=useState(false);
  const remoteLock=useRef(false);
  function remoteState(value:boolean){remoteLock.current=value;setRemoteBusy(value);}
  const [storageMessage,setStorageMessage]=useState<keyof typeof st|null>(null);
  const storageLock=useRef(false);
  const mounted=useRef(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [savedAt,setSavedAt]=useState<string|null>(null);
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
  function message(key:keyof typeof st){if(mounted.current){setStorageMessage(key);notify(st[key],['saved','loaded','deleted'].includes(key)?'success':'info');}}
  // Guardado explícito; solo snapshots sintéticos completos del mejor checkpoint.
  async function storage(action:'save'|'load'|'remove'){
    if(worker.current||storageLock.current||remoteLock.current)return;
    storageLock.current=true;setStorageBusy(true);setStorageMessage(null);
    try{
      if(action==='save'){
        if(!result)return;
        const value:LocalCheckpoint={version:1,classification:'SYNTHETIC DEMO',savedAt:new Date().toISOString(),backend,result,history,scaler:fitScaler(dataset.splits.train.x)};
        if(!validCheckpoint(value,dataset.sha256,dataset.columns,dataset.splits.test.x.length)){message('invalid');return;}
        await saveCheckpoint(value);if(mounted.current)setSavedAt(value.savedAt);message('saved');
      }else if(action==='load'){
        const value=await readCheckpoint();
        if(!mounted.current)return;
        if(value===undefined){message('missing');return;}
        if(!validCheckpoint(value,dataset.sha256,dataset.columns,dataset.splits.test.x.length)){message('invalid');return;}
        setResult(value.result);onResult(value.result);setHistory(value.history);setEpoch(value.history.at(-1)??null);setConfig({...value.result.config});setRunEpochs(value.result.config.epochs);setBackend(value.backend);setStatus('done');setSavedAt(value.savedAt);message('loaded');
      }else{await deleteCheckpoint();if(mounted.current)setSavedAt(null);message('deleted');}
    }catch{message('error');}finally{storageLock.current=false;if(mounted.current)setStorageBusy(false);}
  }
  // Terminar el trabajador también al salir del módulo o cerrar sesión.
  useEffect(()=>()=>{worker.current?.terminate();worker.current=null;},[]);
  function stop(){worker.current?.terminate();worker.current=null;setStatus('cancel');}
  function start(){
    if(worker.current||storageLock.current||remoteLock.current||!validConfig(config))return;
    setRunEpochs(config.epochs);setResult(null);onResult(null);setEpoch(null);setHistory([]);setBackend('');setStatus('busy');
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
        if(data.type==='done'){setResult(data);onResult(data);finish('done');}
        if(data.type==='error')finish('error');
      };
      w.postMessage({type:'start',config});
    }catch{worker.current?.terminate();worker.current=null;setStatus('error');}
  }
  const format=(v:number|null|undefined)=>v==null?'—':v.toFixed(4);
  function currentCheckpoint():LocalCheckpoint|null {
    if(!result)return null;
    return {version:1,classification:'SYNTHETIC DEMO',savedAt:new Date().toISOString(),backend,result,history,scaler:fitScaler(dataset.splits.train.x)};
  }
  function restoreRemote(value:unknown){
    if(!mounted.current||!validCheckpoint(value,dataset.sha256,dataset.columns,dataset.splits.test.x.length))return false;
    setResult(value.result);onResult(value.result);setHistory(value.history);setEpoch(value.history.at(-1)??null);setConfig({...value.result.config});setRunEpochs(value.result.config.epochs);setBackend(value.backend);setStatus('done');return true;
  }
  // El trabajador y su estado viven aquí, no en los paneles condicionales.
  const statusText=status==='idle'?t.idle:status==='done'?t.done:status==='error'?t.error:status==='cancel'?t.cancel:t.busy;
  const goTraining={es:'Ir a Entrenamiento',en:'Go to Training',pt:'Ir para Treinamento'}[locale];
  return <section className={tab==='architecture'?'min-w-0 space-y-4':'app-panel min-w-0 space-y-4 rounded-2xl border border-[var(--app-panel-border)] p-5'} aria-label={t.title}>
    <div className="app-panel flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--app-panel-border)] px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="neural-demo-pill rounded-full px-2.5 py-1 text-[10px] font-bold">SYNTHETIC DEMO</span>
        <span role="status">{statusText}{status==='busy'&&epoch?` · ${t.epoch} ${epoch.epoch}/${runEpochs}`:''}{backend?` · ${backend}`:''}</span>
      </div>
      {tab!=='training'&&(tab!=='architecture'||result)&&<button type="button" className="app-secondary-button rounded-lg border border-[var(--app-control-border)] px-3 py-2" onClick={()=>onTab('training')}>{goTraining}</button>}
    </div>
    {children}
    {tab==='training'&&<>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="flex items-center gap-2 font-bold"><BrainCircuit className="app-accent" size={21}/>{t.title}</h3><p className="app-muted mt-2 text-sm">{t.note}</p></div>
    </header>
    <p className="app-muted text-sm">TensorFlow.js · Web Worker · 13 → 8 → 4 → 1 · 150 / 50 / 50 (train / validation / test)</p>
    <ConfigEditor locale={locale} config={config} onChange={setConfig} busy={status==='busy'||storageBusy||remoteBusy}/>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={status==='busy'||storageBusy||remoteBusy||!validConfig(config)} onClick={start} className="app-secondary-button inline-flex items-center gap-2 rounded-xl border border-[var(--app-control-border)] px-4 py-2 text-sm font-semibold"><Play size={16}/>{t.start}</button>
      {status==='busy'&&<button type="button" onClick={stop} className="app-secondary-button inline-flex items-center gap-2 rounded-xl border border-[var(--app-control-border)] px-4 py-2 text-sm"><Square size={15}/>{t.stop}</button>}
      {status==='busy'&&<Spinner label={t.busy}/>}
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[[t.engine,backend||'—'],[t.epoch,epoch?`${epoch.epoch}/${runEpochs}`:'—'],[t.loss,format(epoch?.loss)],[t.val,format(epoch?.validationLoss)]].map(([name,value])=><div key={name} className="app-secondary-button rounded-xl border border-[var(--app-control-border)] p-3"><p className="app-muted text-xs">{name}</p><p key={String(value)} className="neural-epoch-value mt-1 font-semibold tabular-nums">{value}</p></div>)}
    </div>
    <TrainingHistory locale={locale} history={history} best={result?.epoch??epoch?.bestEpoch}/>
    {result&&<p className="app-muted text-sm">{result.stopReason==='earlyStopping'?({es:'Detención anticipada: sin mejora en validación.',en:'Early stopping: no validation improvement.',pt:'Parada antecipada: sem melhora na validação.'}[locale]):({es:'Se alcanzó el máximo de épocas.',en:'Maximum epochs reached.',pt:'Máximo de épocas atingido.'}[locale])} · {t.best}: {result.epoch}</p>}
    </>}
    {tab==='models'&&<section className="space-y-2 rounded-xl border border-[var(--app-panel-border)] p-4">
      <h4 className="font-semibold">{st.title}</h4><p className="app-muted text-sm">{st.note}</p>
      <div className="flex flex-wrap gap-2">{([{action:'save',icon:Save},{action:'load',icon:FolderOpen},{action:'remove',icon:Trash2}] as const).map(({action,icon:Icon})=><button key={action} type="button" className="app-secondary-button inline-flex items-center gap-2 rounded-lg border border-[var(--app-control-border)] px-3 py-2 text-sm" disabled={storageBusy||remoteBusy||status==='busy'||(action==='save'&&!result)} onClick={()=>{if(action==='remove')setConfirmDelete(true);else void storage(action);}}><Icon size={16}/>{st[action]}</button>)}</div>
      {savedAt&&<p className="app-muted text-xs">{new Date(savedAt).toLocaleString(locale)}</p>}
      <Modal open={confirmDelete} title={st.remove} onClose={()=>setConfirmDelete(false)}><p className="text-sm">{st.confirm}</p><div className="mt-4 flex justify-end gap-2"><button type="button" className="app-secondary-button rounded-lg border border-[var(--app-control-border)] px-3 py-2 text-sm" onClick={()=>setConfirmDelete(false)}>{st.cancel}</button><button type="button" className="app-secondary-button rounded-lg border border-[var(--app-control-border)] px-3 py-2 text-sm" onClick={()=>{setConfirmDelete(false);void storage('remove');}}>{st.remove}</button></div></Modal>
      {storageBusy&&<Spinner label={t.busy}/>}<p role="status" aria-live="polite" className="text-sm">{storageMessage?st[storageMessage]:''}</p>
    </section>}
    {canRegister&&token&&<div hidden={tab!=='models'}><RemoteModels visible={tab==='models'} locale={locale} token={token} blocked={storageBusy||status==='busy'} checkpoint={currentCheckpoint} onRestore={restoreRemote} onBusy={remoteState}/></div>}
    {tab==='evaluation'&&result&&<div className="space-y-3"><p className="app-info rounded-lg border p-3 text-sm">{result.stopReason==='earlyStopping'?({es:'Detención anticipada: sin mejora en validación.',en:'Early stopping: no validation improvement.',pt:'Parada antecipada: sem melhora na validação.'}[locale]):({es:'Se alcanzó el máximo de épocas.',en:'Maximum epochs reached.',pt:'Máximo de épocas atingido.'}[locale])} {result.completedEpochs}/{result.config.epochs} · {t.best}: {result.epoch}</p><h4 className="font-semibold">{t.test} · {t.best}: {result.epoch}</h4>
      <ExperimentDetails tab="evaluation" locale={locale} result={result} sampleIndex={sampleIndex} onSample={onSample}/> 
    </div>}
    {tab==='inspection'&&result&&<ExperimentDetails tab="inspection" locale={locale} result={result} sampleIndex={sampleIndex} onSample={onSample}/>}
    {(tab==='evaluation'||tab==='inspection')&&!result&&<p className="app-muted text-sm">{{es:'Entrena o recupera un modelo DEMO para consultar los resultados.',en:'Train or restore a DEMO model to view results.',pt:'Treine ou recupere um modelo DEMO para consultar os resultados.'}[locale]}</p>}
  </section>;
}

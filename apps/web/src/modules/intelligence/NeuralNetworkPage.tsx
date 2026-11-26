/**
 * Laboratorio DEMO: muestra exclusivamente la arquitectura del modelo entrenado.
 * No consulta APIs ni utiliza registros académicos personales.
 */
import { useEffect, useState } from 'react';
import { BrainCircuit, Network, Cpu, ChartNoAxesCombined, ScanSearch, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { normalizeLocale } from '../../i18n';
import { useSettings } from '../../providers/SettingsProvider';
import type { WorkerEvent } from './ml/protocol';
import { TrainedNetwork } from './components/TrainedNetwork';
import { type LabTab, LAB_TABS } from './ml/labTabs';
import { LocalTrainingPanel } from './components/LocalTrainingPanel';
import { NEURAL_TEXT } from './neuralNetworkConfig';

const tabLabels={es:['Arquitectura','Entrenamiento','Evaluación','Inspección','Modelos'],en:['Architecture','Training','Evaluation','Inspection','Models'],pt:['Arquitetura','Treinamento','Avaliação','Inspeção','Modelos']} as const;

export function NeuralNetworkPage() {
  const { i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const labels = NEURAL_TEXT[locale];
  const [tab, setTab] = useState<LabTab>('architecture');
  const [result, setResult] = useState<Extract<WorkerEvent,{type:'done'}> | null>(null);
  const [sampleIndex, setSampleIndex] = useState(0);
  const empty = {
    es: ['Modelo entrenado', 'Entrena o recupera un modelo DEMO para visualizar sus pesos y activaciones.', 'Ir a Entrenamiento', 'Recuperar desde Modelos'],
    en: ['Trained model', 'Train or restore a DEMO model to visualize its weights and activations.', 'Go to Training', 'Restore from Models'],
    pt: ['Modelo treinado', 'Treine ou recupere um modelo DEMO para visualizar seus pesos e ativações.', 'Ir para Treinamento', 'Recuperar em Modelos'],
  }[locale];
  const { animationsEnabled } = useSettings();
  const [systemReduced, setSystemReduced] = useState(false);

  // Además del ajuste de EduMaster, se respeta el sistema operativo. El
  // listener permite adaptarse al cambiar la preferencia con la página abierta.
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const allowMotion = animationsEnabled && !systemReduced;

  return <section className="space-y-5" aria-label={labels.visualTitle}>
    {/* Navegación única; el laboratorio permanece montado al cambiar de pestaña. */}
    <nav role="tablist" aria-label={labels.visualTitle} className="app-editor-section-tabs flex gap-2 overflow-x-auto rounded-xl p-2">
      {LAB_TABS.map((id,i)=>{
        const Icon=[Network,Cpu,ChartNoAxesCombined,ScanSearch,Database][i]!;
        return <button key={id} id={`neural-tab-${id}`} type="button" role="tab" aria-selected={tab===id}
          aria-controls="neural-tab-content" tabIndex={tab===id?0:-1} onClick={()=>setTab(id)}
          onKeyDown={event=>{
            // Navegación horizontal accesible, sin recrear el laboratorio.
            let next=i;
            if(event.key==='ArrowRight')next=(i+1)%LAB_TABS.length;
            else if(event.key==='ArrowLeft')next=(i+LAB_TABS.length-1)%LAB_TABS.length;
            else if(event.key==='Home')next=0;
            else if(event.key==='End')next=LAB_TABS.length-1;
            else return;
            event.preventDefault();
            const target=LAB_TABS[next]!;
            setTab(target);
            document.getElementById(`neural-tab-${target}`)?.focus();
          }} className="app-editor-section-tab flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold">
          <Icon size={17}/>{tabLabels[locale][i]}
        </button>;
      })}
    </nav>
    <div id="neural-tab-content" role="tabpanel" aria-labelledby={`neural-tab-${tab}`} tabIndex={0} className="min-w-0">
    <LocalTrainingPanel tab={tab} onTab={setTab} locale={locale} sampleIndex={sampleIndex} onSample={setSampleIndex} onResult={value=>{setResult(value);setSampleIndex(0);}}>
    {tab==='architecture' && <div className="space-y-5">
      {/* No se dibuja una topología ficticia cuando no hay checkpoint disponible. */}
      {result ? <TrainedNetwork locale={locale} result={result} sampleIndex={sampleIndex} onSample={setSampleIndex} allowMotion={allowMotion}/> :
        <section className="app-panel flex flex-col items-center gap-3 rounded-2xl border border-[var(--app-panel-border)] p-8 text-center">
          <BrainCircuit size={36} className="app-accent" aria-hidden="true"/>
          <h2 className="text-lg font-bold">{empty[0]}</h2>
          <p className="app-muted max-w-lg text-sm">{empty[1]}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="app-secondary-button rounded-lg border border-[var(--app-control-border)] px-4 py-2 text-sm" onClick={()=>setTab('training')}>{empty[2]}</button>
            <button type="button" className="app-secondary-button rounded-lg border border-[var(--app-control-border)] px-4 py-2 text-sm" onClick={()=>setTab('models')}>{empty[3]}</button>
          </div>
        </section>}
    </div>}
    </LocalTrainingPanel>
    </div>
  </section>;
}

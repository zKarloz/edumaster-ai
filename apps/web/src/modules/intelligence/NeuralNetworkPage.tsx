/**
 * DEMO didáctica: muestra selección y recorrido conceptual de una entrada.
 * No consulta APIs ni utiliza registros académicos personales.
 */
import { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, CircleHelp, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { normalizeLocale } from '../../i18n';
import { useSettings } from '../../providers/SettingsProvider';
import { LocalTrainingPanel } from './components/LocalTrainingPanel';
import { NeuralNetworkVisualizer } from './NeuralNetworkVisualizer';
import { NEURAL_INPUTS, NEURAL_OUTPUTS, NEURAL_TEXT, type InputId } from './neuralNetworkConfig';

const PHASE_DURATION_MS = 850;

export function NeuralNetworkPage() {
  const { i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const labels = NEURAL_TEXT[locale];
  const { animationsEnabled } = useSettings();
  const [selected, setSelected] = useState<InputId | null>(null);
  const [playing, setPlaying] = useState(true);
  const [phase, setPhase] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
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

  // Solo hay un temporizador vivo: cambio de entrada, pausa y desmontaje
  // cancelan el anterior. Nunca se anima ni se hace inferencia en el backend.
  useEffect(() => {
    if (selected === null || !playing || phase >= 3) return;
    const timer = window.setTimeout(() => setPhase(previous => Math.min(3, previous + 1)), allowMotion ? PHASE_DURATION_MS : 0);
    return () => window.clearTimeout(timer);
  }, [selected, playing, phase, replayKey, allowMotion]);

  const selectedInput = useMemo(() => NEURAL_INPUTS.find(item => item.id === selected), [selected]);
  const outputs = NEURAL_OUTPUTS.filter(output => selectedInput?.demoOutputs.includes(output.id));

  function selectInput(id: InputId) {
    setSelected(id);
    setPhase(0);
    setPlaying(true);
    setReplayKey(value => value + 1);
  }
  function showAll() {
    setSelected(null);
    setPhase(0);
    setPlaying(true);
    setReplayKey(value => value + 1);
  }
  function replay() {
    if (selected === null) return;
    setPhase(0);
    setPlaying(true);
    setReplayKey(value => value + 1);
  }

  return <section className="space-y-5" aria-label={labels.visualTitle}>
    <header className="app-panel neural-page-intro flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="neural-intro-icon rounded-xl p-2.5" aria-hidden="true"><BrainCircuit size={24}/></div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold sm:text-xl">{labels.visualTitle}</h2>
            <span className="neural-demo-pill rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider">{labels.badge}</span>
          </div>
          <p className="app-muted max-w-3xl text-sm leading-relaxed">{labels.introduction}</p>
        </div>
      </div>
    </header>

    <div className="grid min-w-0 gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="app-panel rounded-2xl border p-4" aria-label={labels.pick}>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles size={17} className="app-accent"/>{labels.pick}</div>
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-1" role="group" aria-label={labels.inputs}>
          {NEURAL_INPUTS.map((input, index) => <button type="button" key={input.id}
            aria-pressed={selected === input.id}
            className="neural-input-button app-secondary-button flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors"
            data-selected={selected === input.id} data-dimmed={selected !== null && selected !== input.id}
            onClick={() => selectInput(input.id)}>
            <span className="neural-input-number flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold" aria-hidden="true">{index + 1}</span>
            <span className="min-w-0 flex-1 font-medium">{input.labels[locale]}</span>
          </button>)}
        </div>
        <button type="button" className="app-secondary-button mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold"
          disabled={selected === null} onClick={showAll}>
          <RotateCcw size={16}/>{labels.all}
        </button>
      </aside>

      <div className="app-panel min-w-0 overflow-hidden rounded-2xl border">
        <div className="neural-visual-topbar app-divider flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="neural-live-dot" aria-hidden="true"/>
            {labels.visualTitle}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="app-secondary-button inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"
              onClick={() => setPlaying(value => !value)} disabled={selected === null || !allowMotion}
              title={!allowMotion ? labels.animationStopped : undefined}>
              {playing ? <Pause size={15}/> : <Play size={15}/>}
              {playing ? labels.pause : labels.resume}
            </button>
            <button type="button" className="app-secondary-button inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"
              onClick={replay} disabled={selected === null}>
              <RotateCcw size={15}/>{labels.replay}
            </button>
          </div>
        </div>
        <NeuralNetworkVisualizer locale={locale} selected={selected} phase={phase} playing={playing && allowMotion} onSelect={selectInput}/>
        <div className="neural-phase-row app-divider grid grid-cols-2 gap-2 border-t p-3 sm:grid-cols-4" aria-label={labels.visualTitle}>
          {labels.phases.map((caption,index)=> <div key={caption} className="neural-phase flex items-center gap-2 rounded-lg px-2 py-2 text-xs"
            data-active={selected !== null && phase >= index} aria-current={selected !== null && phase === index ? 'step' : undefined}>
            <span className="neural-phase-number flex size-6 shrink-0 items-center justify-center rounded-full font-bold" aria-hidden="true">{index+1}</span>
            <span>{caption}</span>
          </div>)}
        </div>
      </div>
    </div>

    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
      <section className="app-panel rounded-2xl border p-5" aria-live="polite" aria-atomic="true">
        <h3 className="mb-3 flex items-center gap-2 font-semibold"><CircleHelp size={18} className="app-accent"/>{labels.explanation}</h3>
        <p className="text-base font-semibold">{selectedInput ? selectedInput.labels[locale] : labels.all}</p>
        <p className="app-muted mt-2 text-sm leading-relaxed">{selectedInput?.descriptions[locale] ?? labels.allDescription}</p>
        {selectedInput && <>
          <p className="app-muted mt-2 text-sm leading-relaxed">{labels.selectionDescription}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider">{labels.concept}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {outputs.map(item=><span key={item.id} className="neural-output-pill rounded-full px-3 py-1 text-xs font-medium">{item.labels[locale]}</span>)}
          </div>
        </>}
      </section>
      <aside className="app-info rounded-2xl border p-5 text-sm leading-relaxed">
        <p className="font-semibold">{labels.badge}</p>
        <p className="mt-2">{labels.illustration}</p>
        <p className="mt-3">{labels.source}</p>
        <p className="mt-3 text-xs">{labels.note}</p>
      </aside>
    </div>
    <LocalTrainingPanel locale={locale}/>
  </section>;
}

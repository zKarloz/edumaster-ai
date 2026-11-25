/**
 * Red SVG conceptual. Los enlaces son una topología ilustrativa totalmente
 * conectada: una selección resalta el recorrido, nunca atribuye causalidad.
 */
import type { KeyboardEvent } from 'react';
import type { Locale } from '../../i18n';
import { NEURAL_INPUTS, NEURAL_OUTPUTS, NEURAL_TEXT, type InputId } from './neuralNetworkConfig';

interface Props {
  locale: Locale;
  selected: InputId | null;
  phase: number;
  playing: boolean;
  onSelect: (id: InputId) => void;
}

const INPUT_X = 188;
const HIDDEN_1_X = 442;
const HIDDEN_2_X = 658;
const OUTPUT_X = 888;
const inputY = (index: number) => 92 + index * 55;
const hidden1Y = (index: number) => 120 + index * 64;
const hidden2Y = (index: number) => 151 + index * 72;

/**
 * Pulso eléctrico didáctico: una estela luminosa avanza sobre un enlace SVG
 * recto. La línea base permanece continua y visible debajo de la estela.
 * No representa pesos ni activaciones de un modelo entrenado.
 */
interface SignalPulseProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  tone: 'input' | 'middle' | 'output';
  index: number;
}

function SignalPulse({ x1, y1, x2, y2, tone, index }: SignalPulseProps) {
  // Una pequeña variación de duración evita que todas las señales se muevan
  // exactamente al unísono, sin perder su dirección de origen a destino.
  const duration = (1.4 + (index % 4) * 0.12).toFixed(2);
  return <g className={`neural-signal-pulse neural-signal-pulse--${tone}`}>
    <line x1="-17" y1="0" x2="-3" y2="0" className="neural-signal-tail"/>
    <circle r="6.5" className="neural-signal-glow" filter="url(#neural-pulse-blur)"/>
    <circle r="2.5" className="neural-signal-core"/>
    <animateMotion path={`M ${x1} ${y1} L ${x2} ${y2}`} dur={`${duration}s`}
      repeatCount="indefinite" rotate="auto"/>
  </g>;
}

/** Selección accesible: los mismos seis botones existen fuera del SVG. */
function selectByKeyboard(event: KeyboardEvent<SVGGElement>, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}

export function NeuralNetworkVisualizer({ locale, selected, phase, playing, onSelect }: Props) {
  const texts = NEURAL_TEXT[locale];
  const input = NEURAL_INPUTS.find(item => item.id === selected);
  const relevant = input?.demoOutputs ?? [];
  const isGeneral = selected === null;
  const activated = (layer: number) => !isGeneral && phase >= layer;

  return <div className="neural-graph-scroll" role="region" aria-label={texts.visualTitle} tabIndex={0}>
    <svg className="neural-graph" viewBox="0 0 1060 445" xmlns="http://www.w3.org/2000/svg"
      role="group" aria-label={texts.visualTitle}>
      <defs>
        <pattern id="neural-grid-pattern" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" className="neural-grid-path" strokeWidth="0.6"/>
        </pattern>
        <filter id="neural-glow-filter" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        {/* La luminosidad se aplica solamente a las señales móviles. */}
        <filter id="neural-pulse-blur" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="3.5"/>
        </filter>
      </defs>
      <rect width="1060" height="445" fill="url(#neural-grid-pattern)" opacity="0.5"/>
      <g className="neural-col-headings" aria-hidden="true">
        <text x="188" y="39" textAnchor="middle">{texts.inputs}</text>
        <text x="442" y="39" textAnchor="middle">{texts.layer1}</text>
        <text x="658" y="39" textAnchor="middle">{texts.layer2}</text>
        <text x="888" y="39" textAnchor="middle">{texts.outputs}</text>
      </g>
      {/* Enlaces completos, continuos y siempre detrás de los nodos. */}
      <g className="neural-edges" aria-hidden="true">
        {NEURAL_INPUTS.flatMap((source, i) => Array.from({ length: 5 }, (_, j) =>
          <line key={`a-${source.id}-${j}`} x1={INPUT_X + 12} y1={inputY(i)} x2={HIDDEN_1_X - 12} y2={hidden1Y(j)}
            className="neural-edge" data-active={activated(1) && selected === source.id}
            data-flow={playing && activated(1) && selected === source.id}/>))}
        {Array.from({ length: 5 }, (_, i) => Array.from({ length: 4 }, (_, j) =>
          <line key={`b-${i}-${j}`} x1={HIDDEN_1_X + 12} y1={hidden1Y(i)} x2={HIDDEN_2_X - 12} y2={hidden2Y(j)}
            className="neural-edge neural-edge--middle" data-active={activated(2)}/>))}
        {Array.from({ length: 4 }, (_, i) => NEURAL_OUTPUTS.map((output, j) =>
          <line key={`c-${i}-${output.id}`} x1={HIDDEN_2_X + 12} y1={hidden2Y(i)} x2={OUTPUT_X - 12} y2={inputY(j)}
            className="neural-edge neural-edge--output" data-active={activated(3) && relevant.includes(output.id)}/>))}
      </g>
      {/* La señal se monta únicamente al reproducir; al pausar desaparece sin
          modificar las conexiones de fondo ni la etapa alcanzada. */}
      {playing && <g className="neural-signals" aria-hidden="true">
        {activated(1) && NEURAL_INPUTS.flatMap((source, i) =>
          source.id === selected ? Array.from({ length: 5 }, (_, j) =>
            <SignalPulse key={`pulse-a-${i}-${j}`} x1={INPUT_X + 12} y1={inputY(i)}
              x2={HIDDEN_1_X - 12} y2={hidden1Y(j)} tone="input" index={j}/>) : [])}
        {activated(2) && Array.from({ length: 5 }, (_, i) =>
          Array.from({ length: 4 }, (_, j) =>
            <SignalPulse key={`pulse-b-${i}-${j}`} x1={HIDDEN_1_X + 12} y1={hidden1Y(i)}
              x2={HIDDEN_2_X - 12} y2={hidden2Y(j)} tone="middle" index={i + j}/>))}
        {activated(3) && Array.from({ length: 4 }, (_, i) =>
          NEURAL_OUTPUTS.filter(output => relevant.includes(output.id)).map((output) => {
            const j = NEURAL_OUTPUTS.indexOf(output);
            return <SignalPulse key={`pulse-c-${i}-${output.id}`}
              x1={HIDDEN_2_X + 12} y1={hidden2Y(i)} x2={OUTPUT_X - 12}
              y2={inputY(j)} tone="output" index={i + j}/>;
          }))}
      </g>}
      <g className="neural-nodes neural-nodes--hidden" aria-hidden="true">
        {Array.from({length:5},(_,index)=><g key={`hidden-1-${index}`}>
          <circle cx={HIDDEN_1_X} cy={hidden1Y(index)} r="15" className="neural-node neural-node--hidden-1" data-active={activated(1)}/>
          <circle cx={HIDDEN_1_X} cy={hidden1Y(index)} r="3.8" className="neural-node-core"/>
        </g>)}
        {Array.from({length:4},(_,index)=><g key={`hidden-2-${index}`}>
          <circle cx={HIDDEN_2_X} cy={hidden2Y(index)} r="15" className="neural-node neural-node--hidden-2" data-active={activated(2)}/>
          <circle cx={HIDDEN_2_X} cy={hidden2Y(index)} r="3.8" className="neural-node-core"/>
        </g>)}
      </g>
      <g className="neural-nodes--inputs">
        {NEURAL_INPUTS.map((node,index)=>{
          const focused = selected === node.id;
          const faded = !isGeneral && !focused;
          return <g key={node.id} role="button" tabIndex={0} focusable="true"
            aria-label={node.labels[locale]} aria-pressed={focused}
            className="neural-input-node" data-dimmed={faded} data-selected={focused}
            onClick={()=>onSelect(node.id)} onKeyDown={event=>selectByKeyboard(event,()=>onSelect(node.id))}>
            <title>{node.labels[locale]}</title>
            <text x="151" y={inputY(index)+4.5} textAnchor="end" className="neural-node-label">{node.labels[locale]}</text>
            <circle cx={INPUT_X} cy={inputY(index)} r="19" className="neural-hit-area"/>
            <circle cx={INPUT_X} cy={inputY(index)} r="13" className="neural-node neural-node--input" data-active={focused}/>
            <circle cx={INPUT_X} cy={inputY(index)} r="4" className="neural-node-core"/>
          </g>;
        })}
      </g>
      <g className="neural-nodes--outputs" aria-hidden="true">
        {NEURAL_OUTPUTS.map((output,index)=>{
          const focused = activated(3) && relevant.includes(output.id);
          return <g key={output.id} className="neural-output-node" data-dimmed={!isGeneral && !focused}>
            <circle cx={OUTPUT_X} cy={inputY(index)} r="12" className="neural-node neural-node--output" data-active={focused}/>
            <circle cx={OUTPUT_X} cy={inputY(index)} r="3.5" className="neural-node-core"/>
            <text x={OUTPUT_X+24} y={inputY(index)+4.5} className="neural-node-label">{output.labels[locale]}</text>
          </g>;
        })}
      </g>
    </svg>
  </div>;
}

/**
 * Catálogo didáctico de la arquitectura neuronal.
 * No representa pesos aprendidos, importancia de características ni predicciones reales.
 * Las salidas destacadas son asociaciones expositivas, NO relaciones causales.
 */
import type { Locale } from '../../i18n';

export type InputId = 'platform' | 'performance' | 'participation' | 'interactions' | 'attendance' | 'comments';
export type OutputId = 'recommendations' | 'paths' | 'alerts' | 'predictions' | 'progress' | 'certificates';

export interface NeuralInput {
  id: InputId;
  labels: Record<Locale, string>;
  descriptions: Record<Locale, string>;
  /** Ejemplo conceptual, nunca una importancia o conexión calculada por ML. */
  demoOutputs: readonly OutputId[];
}
export interface NeuralOutput { id: OutputId; labels: Record<Locale, string> }

export const NEURAL_INPUTS: readonly NeuralInput[] = [
  { id:'platform', labels:{es:'Uso de plataforma',en:'Platform usage',pt:'Uso da plataforma'}, descriptions:{es:'Frecuencia de acceso y actividad dentro del LMS.',en:'Access frequency and activity in the LMS.',pt:'Frequência de acesso e atividade no LMS.'}, demoOutputs:['recommendations','alerts'] },
  { id:'performance', labels:{es:'Rendimiento',en:'Performance',pt:'Desempenho'}, descriptions:{es:'Calificaciones, evolución de evaluaciones y progreso académico.',en:'Grades, assessment trends, and academic progress.',pt:'Notas, evolução das avaliações e progresso acadêmico.'}, demoOutputs:['predictions','progress'] },
  { id:'participation', labels:{es:'Participación',en:'Participation',pt:'Participação'}, descriptions:{es:'Participación en actividades y tareas del curso.',en:'Participation in course activities and assignments.',pt:'Participação em atividades e tarefas do curso.'}, demoOutputs:['recommendations','paths'] },
  { id:'interactions', labels:{es:'Interacciones',en:'Interactions',pt:'Interações'}, descriptions:{es:'Actividad relacionada con contenidos y recursos educativos.',en:'Activity involving educational content and resources.',pt:'Atividade com conteúdos e recursos educacionais.'}, demoOutputs:['paths','predictions'] },
  { id:'attendance', labels:{es:'Asistencias',en:'Attendance',pt:'Presenças'}, descriptions:{es:'Registros de presencia en las sesiones correspondientes.',en:'Attendance records for scheduled sessions.',pt:'Registros de presença nas sessões.'}, demoOutputs:['alerts','progress'] },
  { id:'comments', labels:{es:'Comentarios',en:'Comments',pt:'Comentários'}, descriptions:{es:'Observaciones y retroalimentación académica estructurada.',en:'Structured academic observations and feedback.',pt:'Observações e comentários acadêmicos estruturados.'}, demoOutputs:['recommendations','paths'] },
] as const;

export const NEURAL_OUTPUTS: readonly NeuralOutput[] = [
  {id:'recommendations',labels:{es:'Recomendaciones',en:'Recommendations',pt:'Recomendações'}},
  {id:'paths',labels:{es:'Rutas de aprendizaje',en:'Learning paths',pt:'Percursos de aprendizagem'}},
  {id:'alerts',labels:{es:'Alertas inteligentes',en:'Smart alerts',pt:'Alertas inteligentes'}},
  {id:'predictions',labels:{es:'Predicciones',en:'Predictions',pt:'Previsões'}},
  {id:'progress',labels:{es:'Rendimiento',en:'Performance',pt:'Desempenho'}},
  {id:'certificates',labels:{es:'Certificaciones',en:'Certifications',pt:'Certificações'}},
] as const;

export const NEURAL_TEXT: Record<Locale, {
  badge:string; introduction:string; illustration:string; pick:string; all:string;
  pause:string; resume:string; replay:string; inputs:string; layer1:string; layer2:string;
  outputs:string; explanation:string; allDescription:string; selectionDescription:string;
  concept:string; source:string; animationStopped:string; animationRunning:string;
  phases:readonly [string,string,string,string]; visualTitle:string; note:string;
}> = {
  es:{
    badge:'SIMULACIÓN DEMO',introduction:'Explora cómo una señal académica podría recorrer una arquitectura neuronal. Selecciona una entrada para seguir su propagación por capas.',
    illustration:'Las conexiones y las salidas destacadas son ilustrativas: no son pesos, activaciones ni predicciones de un modelo entrenado.',
    pick:'Selecciona una entrada',all:'Vista general',pause:'Pausar',resume:'Reanudar',replay:'Repetir señal',inputs:'ENTRADAS',layer1:'CAPA OCULTA 1',layer2:'CAPA OCULTA 2',outputs:'SALIDAS',
    explanation:'¿Qué muestra la selección?',allDescription:'Todas las entradas están visibles. Al elegir una, las demás se atenúan para facilitar la explicación de su recorrido.',
    selectionDescription:'La entrada seleccionada se destaca. Las restantes solo se atenúan visualmente; una red entrenada puede considerar simultáneamente todas las variables.',
    concept:'Salidas destacadas en esta demostración',source:'En este incremento no se consultan alumnos, notas reales, Supabase ni el modelo de regresión logística del laboratorio.',
    animationStopped:'Animación pausada',animationRunning:'Animación en reproducción',phases:['Entrada seleccionada','Señal hacia la primera capa','Señal hacia la segunda capa','Salidas conceptuales destacadas'],
    visualTitle:'Arquitectura neuronal interactiva',note:'No se otorgan certificaciones ni se toman decisiones académicas automáticamente.'
  },
  en:{
    badge:'DEMO SIMULATION',introduction:'Explore how an academic signal could travel across a neural architecture. Select an input to follow its progression through the layers.',
    illustration:'Connections and highlighted outputs are illustrative, not trained model weights, activations, or predictions.',
    pick:'Select an input',all:'Overview',pause:'Pause',resume:'Resume',replay:'Replay signal',inputs:'INPUTS',layer1:'HIDDEN LAYER 1',layer2:'HIDDEN LAYER 2',outputs:'OUTPUTS',
    explanation:'What is shown?',allDescription:'All inputs are visible. Select one to dim the others and explain its path.',
    selectionDescription:'Only the chosen input is highlighted. Other inputs are visually dimmed; a trained network can use all variables simultaneously.',
    concept:'Illustrative highlighted outputs',source:'This version does not access students, real grades, Supabase, or the lab’s logistic regression model.',
    animationStopped:'Animation paused',animationRunning:'Animation playing',phases:['Input selected','Signal to first layer','Signal to second layer','Illustrative outputs highlighted'],
    visualTitle:'Interactive neural architecture',note:'Certificates are not issued and academic decisions are not automated.'
  },
  pt:{
    badge:'SIMULAÇÃO DEMO',introduction:'Explore como um sinal acadêmico poderia percorrer uma arquitetura neural. Selecione uma entrada para acompanhar a propagação por camadas.',
    illustration:'As conexões e saídas destacadas são ilustrativas, não pesos, ativações ou previsões de um modelo treinado.',
    pick:'Selecione uma entrada',all:'Visão geral',pause:'Pausar',resume:'Continuar',replay:'Repetir sinal',inputs:'ENTRADAS',layer1:'CAMADA OCULTA 1',layer2:'CAMADA OCULTA 2',outputs:'SAÍDAS',
    explanation:'O que mostra a seleção?',allDescription:'Todas as entradas estão visíveis. Ao escolher uma, as demais são atenuadas para facilitar a explicação do percurso.',
    selectionDescription:'Apenas a entrada escolhida fica destacada. As demais são atenuadas visualmente; uma rede treinada pode usar todas as variáveis simultaneamente.',
    concept:'Saídas ilustrativas destacadas',source:'Esta versão não acessa estudantes, notas reais, Supabase nem a regressão logística do laboratório.',
    animationStopped:'Animação pausada',animationRunning:'Animação em reprodução',phases:['Entrada selecionada','Sinal à primeira camada','Sinal à segunda camada','Saídas ilustrativas destacadas'],
    visualTitle:'Arquitetura neural interativa',note:'Certificações não são emitidas e decisões acadêmicas não são automatizadas.'
  },
};

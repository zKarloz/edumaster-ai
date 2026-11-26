import type { LayerWeights, Sample } from './protocol';
/** El kernel Dense de TensorFlow.js se ordena [entrada, salida]. No recalcula inferencias. */
export function buildGraph(columns:string[], weights:LayerWeights[], sample:Sample) {
 const values=[sample.normalized,...sample.activations];
 if(values.length!==weights.length+1 || columns.length!==values[0]?.length || sample.raw.length!==columns.length) throw new Error('Invalid topology');
 const edges=weights.flatMap((w,l)=>{
  if(w.input!==values[l]?.length||w.output!==values[l+1]?.length||w.kernel.length!==w.input*w.output||w.bias.length!==w.output) throw new Error('Invalid dense layer');
  return Array.from({length:w.input*w.output},(_,k)=>{const from=Math.floor(k/w.output),to=k%w.output,weight=w.kernel[k]!;return {layer:l,from,to,weight,contribution:values[l]![from]!*weight};});
 });
 return {values,edges};
}

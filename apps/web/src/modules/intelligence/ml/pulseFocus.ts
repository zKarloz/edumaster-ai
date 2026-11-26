/** Limita las conexiones adyacentes al elemento inspeccionado sin cortar las demás etapas.
 * Es un enfoque gráfico: no representa causalidad ni modifica las activaciones. */
export interface PulseEdge {layer:number;from:number;to:number}
export interface PulseNode {layer:number;index:number}
export function pulseFocused(e:PulseEdge,node:PulseNode|null,selected:PulseEdge|undefined):boolean {
 if(selected){
  if(e.layer===selected.layer)return e.from===selected.from&&e.to===selected.to;
  if(e.layer===selected.layer-1)return e.to===selected.from;
  if(e.layer===selected.layer+1)return e.from===selected.to;
 }
 if(node){
  if(e.layer===node.layer)return e.from===node.index;
  if(e.layer===node.layer-1)return e.to===node.index;
 }
 return true;
}

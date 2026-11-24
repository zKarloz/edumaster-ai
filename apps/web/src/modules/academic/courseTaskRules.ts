/** Reglas de presentación; las decisiones finales siempre pertenecen a FastAPI. */
export type AssignmentState = 'draft'|'published'|'closed';

/** No muestra enviar si hay una condición de bloqueo conocida. */
export function canSendTextSubmission(
  canSubmit:boolean, editor:boolean, status:AssignmentState,
  dueAt:string|null, usedAttempts:number, allowedAttempts:number, nowMs=Date.now(),
):boolean {
  if(editor||!canSubmit||status!=='published'||usedAttempts>=allowedAttempts) return false;
  if(dueAt!==null&&new Date(dueAt).getTime()<nowMs) return false;
  return true;
}

/** Convierte un horario local visible a ISO con offset implícito del navegador. */
export function taskLocalDateToISO(value:string):string|null {
  if(!value)return null;
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))throw new Error('Fecha de entrega inválida');
  return date.toISOString();
}

/** Se admite texto, solo adjuntos o ambos; los límites reales los impone FastAPI. */
export function hasSubmissionContent(text:string, attachmentCount:number):boolean {
  return text.trim().length>0 || (Number.isInteger(attachmentCount) && attachmentCount>0);
}

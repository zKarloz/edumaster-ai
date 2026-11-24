/** Serialización compatible con el validador editorial FastAPI.
 * No interpreta HTML ni elimina bloques no admitidos de manera silenciosa.
 */
import type { JSONContent } from '@tiptap/core';

/** Restringe atributos a los admitidos por el validador Python. Nunca convierte HTML. */
export function canonicalLessonDocument(raw: JSONContent): JSONContent {
  const nodes = new Set(['doc','paragraph','heading','text','hardBreak','blockquote','bulletList','orderedList','listItem']);
  const marks = new Set(['bold','italic','underline','link']);
  const walk = (node: JSONContent): JSONContent => {
    if (!node.type || !nodes.has(node.type)) throw new Error('Formato de documento no admitido');
    const result: JSONContent = {type:node.type};
    if (node.type==='text') {
      if (!node.text) throw new Error('Texto de documento inválido');
      result.text=node.text;
      if (node.marks?.length) result.marks=node.marks.map(mark=>{
        if (!mark.type || !marks.has(mark.type)) throw new Error('Formato de texto no admitido');
        if (mark.type!=='link') return {type:mark.type};
        const href=String(mark.attrs?.href ?? '');
        const url=new URL(href);
        if (url.protocol!=='https:' || !url.hostname || url.username || url.password) throw new Error('El enlace debe utilizar HTTPS');
        return {type:'link',attrs:{href,target:'_blank',rel:'noopener noreferrer nofollow'}};
      });
    } else {
      if (node.type==='heading') result.attrs={level:node.attrs?.level};
      if (node.type==='orderedList' && Number.isInteger(node.attrs?.start)) result.attrs={start:node.attrs!.start};
      if (node.content?.length) result.content=node.content.map(walk);
    }
    return result;
  };
  return walk(raw);
}


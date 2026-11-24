/** Editor compartido de texto rico: Tiptap OSS con nodos restringidos por FastAPI.
 * Sin HTML arbitrario, recursos adjuntos ni extensiones de pago en v29.1.
 */
import { useState, type FormEvent } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Heading1, Heading2, Heading3, Italic, Link2, Link2Off, List, ListOrdered,
  Quote, Redo2, RotateCcw, Underline as UnderlineIcon, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { canonicalLessonDocument } from '../../modules/academic/lessonDocument';

interface Props {
  value: JSONContent;
  onChange?: (document: JSONContent) => void;
  readOnly?: boolean;
}

export function RichTextEditor({value,onChange,readOnly=false}:Props) {
  const {t}=useTranslation();
  const [linkOpen,setLinkOpen]=useState(false);
  const [linkHref,setLinkHref]=useState('');
  const [linkError,setLinkError]=useState('');
  const [range,setRange]=useState<{from:number;to:number}|null>(null);
  const editor=useEditor({
    extensions:[StarterKit.configure({
      heading:{levels:[1,2,3]},
      // El backend aún no admite estas marcas ni nodos.
      strike:false, code:false, codeBlock:false, horizontalRule:false,
      link:{openOnClick:readOnly, autolink:false, HTMLAttributes:{target:'_blank',rel:'noopener noreferrer nofollow'}},
    })],
    content:value,
    editable:!readOnly,
    immediatelyRender:false,
    editorProps:{attributes:{class:'app-rich-editor-content outline-none', 'aria-label':t('lessonEditor.pageTitle')}},
    onUpdate:({editor:instance})=>onChange?.(canonicalLessonDocument(instance.getJSON())),
  },[readOnly]);

  // Tiptap 3 no vuelve a renderizar la barra en React automáticamente.
  // La suscripción actualiza cada botón al activar una marca (incluso sin escribir)
  // y también cuando cambia la selección, sin repintar en cada pulsación innecesaria.
  const toolbarState=useEditorState({
    editor,
    selector:({editor:current})=>current?{
      bold:current.isActive('bold'),
      italic:current.isActive('italic'),
      underline:current.isActive('underline'),
      paragraph:current.isActive('paragraph'),
      h1:current.isActive('heading',{level:1}),
      h2:current.isActive('heading',{level:2}),
      h3:current.isActive('heading',{level:3}),
      bullets:current.isActive('bulletList'),
      numbers:current.isActive('orderedList'),
      quote:current.isActive('blockquote'),
      link:current.isActive('link'),
      canUndo:current.can().undo(),
      canRedo:current.can().redo(),
    }:null,
  });
  if (!editor) return <div className="app-panel min-h-48 rounded-xl border p-4" aria-busy="true"/>;

  function tool(label:string, Icon:typeof Bold, execute:()=>void, active=false, enabled=true) {
    return <button key={label} type="button" aria-label={label} title={label} aria-pressed={active}
      disabled={!enabled} onClick={execute}
      className={`app-editor-tool rounded-lg p-2 disabled:opacity-35 ${active?'app-editor-tool-active':''}`}>
      <Icon size={17}/>
    </button>;
  }
  function openLink() {
    // useEditor puede devolver null; la comprobación local protege este callback.
    if (!editor) return;
    const {from,to}=editor.state.selection;
    setRange({from,to}); setLinkHref(String(editor.getAttributes('link').href ?? ''));
    setLinkError(''); setLinkOpen(true);
  }
  function addLink(event:FormEvent) {
    event.preventDefault();
    // Evita que el formulario use una instancia que todavía no existe.
    if (!editor) return;
    try {
      const url=new URL(linkHref.trim());
      if (url.protocol!=='https:' || !url.hostname || url.username || url.password || /[\\\u0000-\u001f]/.test(linkHref)) throw new Error();
      const chain=editor.chain().focus();
      if (range) chain.setTextSelection(range);
      chain.setLink({href:linkHref.trim()}).run();
      setLinkOpen(false);
    } catch {setLinkError(t('lessonEditor.linkError'));}
  }

  return <>
    <div className="app-rich-editor rounded-xl border overflow-hidden">
      {!readOnly && <div role="toolbar" aria-label={t('lessonEditor.format')} className="app-rich-editor-toolbar flex items-center gap-1 overflow-x-auto p-2">
        {tool(t('lessonEditor.bold'),Bold,()=>editor.chain().focus().toggleBold().run(),toolbarState?.bold ?? false)}
        {tool(t('lessonEditor.italic'),Italic,()=>editor.chain().focus().toggleItalic().run(),toolbarState?.italic ?? false)}
        {tool(t('lessonEditor.underline'),UnderlineIcon,()=>editor.chain().focus().toggleUnderline().run(),toolbarState?.underline ?? false)}
        <span className="app-editor-toolbar-separator mx-1 h-6 w-px shrink-0"/>
        {tool(t('lessonEditor.paragraph'),RotateCcw,()=>editor.chain().focus().setParagraph().run(),toolbarState?.paragraph ?? false)}
        {tool(t('lessonEditor.h1'),Heading1,()=>editor.chain().focus().toggleHeading({level:1}).run(),toolbarState?.h1 ?? false)}
        {tool(t('lessonEditor.h2'),Heading2,()=>editor.chain().focus().toggleHeading({level:2}).run(),toolbarState?.h2 ?? false)}
        {tool(t('lessonEditor.h3'),Heading3,()=>editor.chain().focus().toggleHeading({level:3}).run(),toolbarState?.h3 ?? false)}
        <span className="app-editor-toolbar-separator mx-1 h-6 w-px shrink-0"/>
        {tool(t('lessonEditor.bullets'),List,()=>editor.chain().focus().toggleBulletList().run(),toolbarState?.bullets ?? false)}
        {tool(t('lessonEditor.numbers'),ListOrdered,()=>editor.chain().focus().toggleOrderedList().run(),toolbarState?.numbers ?? false)}
        {tool(t('lessonEditor.quote'),Quote,()=>editor.chain().focus().toggleBlockquote().run(),toolbarState?.quote ?? false)}
        {tool(t('lessonEditor.link'),Link2,openLink,toolbarState?.link ?? false)}
        {tool(t('lessonEditor.removeLink'),Link2Off,()=>editor.chain().focus().unsetLink().run(),false,toolbarState?.link ?? false)}
        <span className="app-editor-toolbar-separator mx-1 h-6 w-px shrink-0"/>
        {tool(t('lessonEditor.undo'),Undo2,()=>editor.chain().focus().undo().run(),false,toolbarState?.canUndo ?? false)}
        {tool(t('lessonEditor.redo'),Redo2,()=>editor.chain().focus().redo().run(),false,toolbarState?.canRedo ?? false)}
      </div>}
      <EditorContent editor={editor} className={readOnly?'app-rich-preview':'app-rich-editor-surface'}/>
    </div>
    <Modal open={linkOpen} title={t('lessonEditor.link')} onClose={()=>setLinkOpen(false)}>
      <form onSubmit={addLink} className="space-y-3">
        <label className="block space-y-1 text-sm font-medium"><span>{t('lessonEditor.linkUrl')}</span>
          <input className="app-input w-full rounded-lg border px-3 py-2" value={linkHref} onChange={e=>setLinkHref(e.target.value)}
            placeholder="https://example.org" inputMode="url" autoComplete="url" required/>
        </label>
        {linkError && <p role="alert" className="app-warning rounded-lg border p-2 text-sm">{linkError}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="app-secondary-button rounded-lg border px-3 py-2 text-sm" onClick={()=>setLinkOpen(false)}>{t('common.cancel')}</button>
          <button className="app-primary-button rounded-lg px-3 py-2 text-sm" type="submit">{t('lessonEditor.insertLink')}</button>
        </div>
      </form>
    </Modal>
  </>;
}

// Ayuda flotante reutilizable anclada a una etiqueta.
// Animación de entrada/salida, clic exterior y Escape; no modifica el alto del formulario.
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { CircleHelp, X } from 'lucide-react';
import { useSettings } from '../../providers/SettingsProvider';

interface HelpPopoverProps {
  htmlFor: string;
  label: string;
  title: string;
  children: ReactNode;
}

export function HelpPopover({ htmlFor, label, title, children }: HelpPopoverProps) {
  const { animationsEnabled } = useSettings();
  const id = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  // Mantener un instante el panel montado permite animar también la salida.
  useEffect(() => {
    if (open || !mounted) return;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!animationsEnabled || prefersReducedMotion) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), 180);
    return () => window.clearTimeout(timer);
  }, [animationsEnabled, mounted, open]);

  useEffect(() => {
    if (!open) return;
    function onOutside(event: PointerEvent) {
      if (event.target instanceof Node && !anchorRef.current?.contains(event.target)) close();
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      // La ayuda se cierra primero; el Escape no debe cerrar el modal principal.
      event.preventDefault();
      event.stopPropagation();
      close();
      triggerRef.current?.focus();
    }
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onEscape, true);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onEscape, true);
    };
  }, [open, close]);

  return <div ref={anchorRef} className="relative z-30 flex w-full items-center gap-1.5">
    <label htmlFor={htmlFor}>{label}</label>
    <button ref={triggerRef} type="button" title={`Ayuda: ${label}`}
      aria-label={`Ver ayuda sobre ${label.toLowerCase()}`} aria-haspopup="dialog"
      aria-expanded={open} aria-controls={mounted ? id : undefined}
      onClick={() => {
        if (open) close();
        else { setMounted(true); setOpen(true); }
      }}
      className="app-secondary-button inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-[#345578]">
      <CircleHelp aria-hidden="true" size={15}/>
    </button>
    {mounted && <div id={id} role="dialog" aria-label={title} aria-hidden={!open}
      className={`app-help-popover absolute left-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(15rem,50vh)] w-[min(19rem,calc(100vw-5rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-xs font-normal leading-5 text-slate-800 shadow-xl dark:border-[#345578] dark:bg-[#0D2B52] dark:text-slate-100 ${open ? 'app-help-popover-enter' : 'app-help-popover-leave'}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <strong className="font-semibold">{title}</strong>
        <button type="button" tabIndex={open ? 0 : -1} onClick={() => { close(); triggerRef.current?.focus(); }}
          aria-label="Cerrar ayuda" className="app-secondary-button rounded-lg p-1"><X size={15}/></button>
      </div>
      {children}
    </div>}
  </div>;
}

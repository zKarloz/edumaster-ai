// Modal compartido: portal a <body> para evitar contextos de apilamiento de Leaflet,
// bloqueo de scroll del documento y navegación por teclado (Escape y foco contenido).
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ModalBackdrop } from './ModalBackdrop';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** En teléfonos se presenta como panel inferior; en escritorio sigue centrado. */
  mobileSheet?: boolean;
}

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Modal({ open, title, onClose, children, mobileSheet = false }: ModalProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const body = document.body;
    const oldHtmlOverflow = html.style.overflow;
    const oldBodyOverflow = body.style.overflow;

    // Se bloquea solo el documento de fondo. El contenido del diálogo
    // tiene su propia zona scrollable para pantallas pequeñas.
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(element => element.getClientRects().length > 0);
      if (!nodes.length) {
        event.preventDefault();
        closeRef.current?.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      html.style.overflow = oldHtmlOverflow;
      body.style.overflow = oldBodyOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <ModalBackdrop onClose={() => onCloseRef.current()} mobileBottom={mobileSheet}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`app-modal flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#0D2B52] sm:max-h-[calc(100dvh-3rem)] ${mobileSheet ? 'app-mobile-sheet' : ''}`}>
        {mobileSheet && <div aria-hidden="true" className="app-mobile-sheet-handle"/>}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-[#345578] sm:px-6">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar diálogo"
            className="app-modal-close shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"><X size={20}/></button>
        </div>
        <div className="app-modal-content min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {children}
        </div>
      </section>
    </ModalBackdrop>,
    document.body,
  );
}

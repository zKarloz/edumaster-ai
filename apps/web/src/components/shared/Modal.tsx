// Modal compartido: portal a <body> para evitar contextos de apilamiento de Leaflet,
// bloqueo de scroll del documento y navegación por teclado (Escape y foco contenido).
import { useEffect, useId, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
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
  // El desplazamiento táctil queda restringido al tirador del panel móvil.
  const dragRef = useRef<{ pointerId: number; startY: number; startAt: number; offset: number } | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
    if (closeTimerRef.current !== null) clearTimeout(closeTimerRef.current);
    settleTimerRef.current = null;
    closeTimerRef.current = null;
  }

  /** Una apertura parcial vuelve suavemente a su lugar sin cerrar el modal. */
  function restoreSheet() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
    dialog.dataset.dragging = 'false';
    dialog.dataset.settling = 'true';
    dialog.style.transform = 'translate3d(0, 0, 0)';
    dialog.style.opacity = '1';
    settleTimerRef.current = setTimeout(() => {
      if (dialogRef.current !== dialog) return;
      dialog.dataset.settling = 'false';
      dialog.style.transform = '';
      dialog.style.opacity = '';
    }, 190);
  }

  function onHandlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!mobileSheet || !window.matchMedia('(max-width: 639px)').matches) return;
    if (!event.isPrimary || event.button !== 0 || dragRef.current) return;
    clearTimers();
    dragRef.current = { pointerId: event.pointerId, startY: event.clientY, startAt: performance.now(), offset: 0 };
    const dialog = dialogRef.current;
    if (dialog) {
      dialog.dataset.dragging = 'true';
      dialog.dataset.settling = 'false';
      dialog.style.transform = 'translate3d(0, 0, 0)';
    }
    // La captura permite terminar el gesto aunque el dedo salga de la barra.
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onHandlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.max(0, event.clientY - drag.startY);
    drag.offset = distance;
    if (dialogRef.current) dialogRef.current.style.transform = `translate3d(0, ${distance}px, 0)`;
  }

  function finishHandlePointer(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const elapsed = Math.max(1, performance.now() - drag.startAt);
    // Un tirón corto no cierra: umbral por distancia o intención rápida de bajar.
    const dismiss = !cancelled && (drag.offset >= 100 || (drag.offset >= 40 && drag.offset / elapsed > 0.7));
    if (!dismiss) { restoreSheet(); return; }
    const dialog = dialogRef.current;
    if (!dialog) return;
    // La preferencia de movimiento reducido también se aplica al cierre táctil.
    const animate = document.documentElement.dataset.motion !== 'off'
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    dialog.dataset.dragging = 'false';
    dialog.dataset.settling = 'true';
    dialog.style.transform = 'translate3d(0, 100%, 0)';
    dialog.style.opacity = '0.75';
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onCloseRef.current();
      // Si el formulario impidió cerrar por estar guardando, restaurar la vista.
      settleTimerRef.current = setTimeout(() => {
        if (dialogRef.current === dialog) restoreSheet();
      }, 30);
    }, animate ? 180 : 0);
  }

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
      clearTimers();
      dragRef.current = null;
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
        {mobileSheet && <div aria-hidden="true" className="app-mobile-sheet-drag-area"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={event => finishHandlePointer(event)}
          onPointerCancel={event => finishHandlePointer(event, true)}>
          <span className="app-mobile-sheet-handle"/>
        </div>}
        <div className="app-modal-heading flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
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

/** Menú de acciones compartido.
 * En escritorio usa un desplegable anclado al botón sin recortar tarjetas con overflow.
 * En teléfonos reutiliza el panel inferior accesible de Perfil, con gesto de cierre.
 * No decide permisos: el módulo entrega únicamente las acciones autorizadas.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { BottomSheet } from './BottomSheet';

export interface ResponsiveAction {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
}

interface Props {
  label: string;
  sheetTitle: string;
  actions: ResponsiveAction[];
  className?: string;
}

const MOBILE_QUERY = '(max-width: 639px)';
const POPOVER_WIDTH = 224;
const VIEWPORT_GAP = 12;

export function ResponsiveActionMenu({ label, sheetTitle, actions, className = '' }: Props) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Un cambio de orientación o de tamaño no debe dejar un menú flotante desubicado.
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const onChange = () => { setMobile(query.matches); setOpen(false); };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  function toggle() {
    if (!open && !mobile && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const left = Math.max(VIEWPORT_GAP,
        Math.min(rect.right - POPOVER_WIDTH, window.innerWidth - POPOVER_WIDTH - VIEWPORT_GAP));
      // Si falta espacio inferior, abrir hacia arriba sin salir del viewport.
      const estimatedHeight = actions.length * 44 + 16;
      const below = rect.bottom + 8;
      setPosition({
        left,
        top: below + estimatedHeight > window.innerHeight - VIEWPORT_GAP
          ? Math.max(VIEWPORT_GAP, rect.top - estimatedHeight - 8) : below,
      });
    }
    setOpen(value => !value);
  }

  useEffect(() => {
    if (!open || mobile) return;
    const onOutside = (event: PointerEvent | FocusEvent) => {
      if (event.target instanceof Node &&
          !triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('focusin', onOutside);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    // Mantener el teclado dentro de los controles al abrir el desplegable.
    menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('focusin', onOutside);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, mobile]);

  function choose(action: ResponsiveAction) {
    if (action.disabled) return;
    setOpen(false);
    action.onSelect();
  }

  function renderActions() {
    return actions.map(action => <button key={action.id} type="button" role="menuitem"
      disabled={action.disabled} onClick={() => choose(action)}
      className="app-context-menu-item flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40">
      <span aria-hidden="true" className="shrink-0">{action.icon}</span>
      <span>{action.label}</span>
    </button>);
  }

  return <>
    <button ref={triggerRef} type="button" aria-label={label} title={label}
      aria-haspopup="menu" aria-controls={id} aria-expanded={open}
      className={`app-course-appearance-trigger flex size-9 shrink-0 items-center justify-center rounded-lg border ${className}`}
      onClick={toggle}>
      <MoreHorizontal size={18}/>
    </button>
    {open && !mobile && createPortal(
      <div ref={menuRef} id={id} role="menu" aria-label={sheetTitle}
        className="app-context-menu app-panel fixed z-[100] rounded-xl border p-2 shadow-xl"
        style={{ top: position.top, left: position.left, width: POPOVER_WIDTH }}>
        {renderActions()}
      </div>, document.body)}
    <BottomSheet open={open && mobile} title={sheetTitle} onClose={() => setOpen(false)}>
      <div id={id} role="menu" aria-label={sheetTitle} className="space-y-1">{renderActions()}</div>
    </BottomSheet>
  </>;
}

/** Acordeón compartido: activación accesible por teclado y flecha giratoria.
 * Las acciones viven en la misma línea del encabezado. En móviles se concentran
 * en un menú de acciones para evitar botones apilados o títulos deformados.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';

interface AccordionProps {
  open: boolean;
  onToggle: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  actionsLabel?: string;
  children: ReactNode;
}

export function Accordion({
  open, onToggle, title, subtitle, icon, badge, actions,
  actionsLabel = 'Acciones', children,
}: AccordionProps) {
  const contentId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [menuOpen]);

  return <article className="app-panel overflow-visible rounded-2xl border">
    <div className="flex min-w-0 items-center gap-1.5 p-3 sm:gap-2 sm:p-4">
      <button type="button" onClick={() => { setMenuOpen(false); onToggle(); }} aria-expanded={open} aria-controls={contentId}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 sm:gap-3 sm:px-2">
        {icon && <span className="app-workspace-unit-symbol flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10">{icon}</span>}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{title}</span>
          {subtitle && <span className="app-muted mt-1 block truncate text-xs">{subtitle}</span>}
        </span>
        <ChevronDown aria-hidden="true" size={18}
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          className="app-accordion-arrow app-muted shrink-0"/>
      </button>
      {badge && <div className="hidden shrink-0 sm:block">{badge}</div>}
      {actions && <>
        <div className="hidden shrink-0 items-center gap-1 sm:flex">{actions}</div>
        <div className="relative shrink-0 sm:hidden" ref={menuRef}>
          <button type="button" className="app-workspace-icon-button" aria-label={actionsLabel}
            aria-expanded={menuOpen} aria-haspopup="true" onClick={() => setMenuOpen(value => !value)}>
            <MoreHorizontal size={18}/>
          </button>
          {menuOpen && <div className="app-accordion-mobile-actions absolute right-0 top-full z-20 mt-2 flex gap-2 rounded-xl border p-2 shadow-xl"
            onClick={() => setMenuOpen(false)}>
            {actions}
          </div>}
        </div>
      </>}
    </div>
    <div id={contentId} hidden={!open} className="app-workspace-unit-content space-y-3 rounded-b-2xl border-t p-4 sm:p-5">
      {children}
    </div>
  </article>;
}

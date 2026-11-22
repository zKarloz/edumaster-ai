// Selector compartido con opciones accesibles por teclado y lista flotante limitada
// a tres filas visibles. El portal evita que los modales recorten el desplegable.
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

// `suffix` sirve para códigos ISO, abreviaturas o metadatos breves a la derecha.
export interface SelectOption { value: string; label: string; suffix?: string }

interface OptionSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface Placement { top: number; left: number; width: number; maxHeight: number }

export function OptionSelect({ value, options, onChange, ariaLabel, placeholder, disabled = false, className = '' }: OptionSelectProps) {
  const { t } = useTranslation();
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const selectedIndex = options.findIndex(option => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  // Calculamos las coordenadas de la lista cuando se abre y cada vez que cambia
  // el tamaño/scroll del documento o del contenido desplazable del modal.
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const visibleRows = Math.min(options.length, 3);
      const estimatedHeight = Math.max(48, visibleRows * 44 + 8);
      const spaceBelow = window.innerHeight - rect.bottom;
      const showAbove = spaceBelow < estimatedHeight + 12 && rect.top > spaceBelow;
      const available = showAbove ? rect.top - 14 : spaceBelow - 14;
      const maxHeight = Math.max(44, Math.min(140, available));
      const top = showAbove ? Math.max(8, rect.top - maxHeight - 6) : rect.bottom + 6;
      const width = Math.min(rect.width, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setPlacement({ top, left, width, maxHeight });
    };
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    // Click fuera del desplegable: cerramos sin modificar el valor seleccionado.
    const closeOutside = (event: PointerEvent) => {
      if (triggerRef.current?.contains(event.target as Node) || popupRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    popupRef.current?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const choose = (index: number) => {
    const item = options[index];
    if (!item) return;
    onChange(item.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation(); // Escape primero cierra el selector, no el modal.
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      if (!open) {
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
        setOpen(true);
      } else {
        setActiveIndex(current => Math.max(0, Math.min(options.length - 1, current + direction)));
      }
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();
      choose(activeIndex);
      return;
    }
    if (event.key === 'Home' && open) { event.preventDefault(); setActiveIndex(0); }
    if (event.key === 'End' && open) { event.preventDefault(); setActiveIndex(Math.max(0, options.length - 1)); }
  };

  return <>
    <button ref={triggerRef} type="button" role="combobox" aria-label={ariaLabel}
      aria-controls={open ? listId : undefined} aria-expanded={open}
      aria-haspopup="listbox" aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
      disabled={disabled} onKeyDown={handleKeyDown}
      onClick={() => { setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0); setOpen(current => !current); }}
      className={`app-select-trigger flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-900 transition-colors dark:border-[#345578] dark:bg-[#112A48] dark:text-white ${className}`}>
      <span className={`min-w-0 flex-1 truncate ${selected ? '' : 'app-muted'}`}>{selected?.label ?? placeholder ?? t('common.select')}</span>
      {selected?.suffix && <span className="app-select-suffix shrink-0 text-xs app-muted" aria-hidden="true">{selected.suffix}</span>}
      <ChevronDown aria-hidden="true" size={17} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}/>
    </button>
    {open && placement && createPortal(
      <div ref={popupRef} id={listId} role="listbox" aria-label={ariaLabel}
        className="app-select-popup fixed z-[10050] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-[#345578] dark:bg-[#112A48]"
        style={{ top: placement.top, left: placement.left, width: placement.width, maxHeight: placement.maxHeight }}
        onMouseDown={event => event.preventDefault()}>
        {options.length === 0 && <p className="app-muted px-3 py-2 text-sm">{t('legacy.k19861bab53')}</p>}
        {options.map((option, index) => <button key={option.value} id={`${listId}-${index}`}
          data-option-index={index} type="button" role="option" aria-selected={option.value === value}
          tabIndex={-1} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(index)}
          className={`app-select-option flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${activeIndex === index ? 'app-select-option-active' : ''}`}>
          <span className="min-w-0 flex-1 truncate">{option.label}</span>
          {option.suffix && <span className="app-select-suffix shrink-0 text-xs app-muted" aria-hidden="true">{option.suffix}</span>}
          {option.value === value && <Check aria-hidden="true" size={16} className="shrink-0"/>}
        </button>)}
      </div>, document.body,
    )}
  </>;
}

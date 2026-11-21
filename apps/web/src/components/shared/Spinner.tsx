// Indicador compartido accesible. Soporta presentación compacta en avatares.
import { LoaderCircle } from 'lucide-react';

export function Spinner({ label = 'Cargando', compact = false, size = 17 }: { label?: string; compact?: boolean; size?: number }) {
  return (
    <span role="status" aria-label={label} className={compact
      ? 'inline-flex items-center justify-center text-white'
      : 'inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300'}>
      <LoaderCircle aria-hidden="true" size={size} className="animate-spin motion-reduce:animate-none" />
      {!compact && label}
    </span>
  );
}

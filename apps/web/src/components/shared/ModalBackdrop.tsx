// Capa visual reutilizable para TODOS los modales de EduMaster.ai.
// La preferencia local controla si el sombreado incluye desenfoque de fondo.
import type { ReactNode } from 'react';
import { useSettings } from '../../providers/SettingsProvider';

interface ModalBackdropProps {
  children: ReactNode;
  onClose: () => void;
}

export function ModalBackdrop({ children, onClose }: ModalBackdropProps) {
  const { modalBackdrop } = useSettings();
  return <div className={`app-modal-overlay fixed inset-0 z-[10000] overflow-y-auto overscroll-contain bg-slate-950/70 px-4 py-4 sm:py-6 ${modalBackdrop === 'blur' ? 'backdrop-blur-[3px]' : ''}`}>
    <div className="flex min-h-full items-center justify-center" onMouseDown={event => {
      // El clic en el exterior cierra; los controles internos siguen operativos.
      if (event.target === event.currentTarget) onClose();
    }}>
      {children}
    </div>
  </div>;
}

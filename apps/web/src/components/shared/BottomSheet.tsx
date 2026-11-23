// Diálogo adaptable compartido: en teléfonos sube desde abajo y en escritorio
// conserva el modal convencional, su gestión de foco y el bloqueo de scroll.
// Se reutiliza en acciones de fotografía y edición del nombre; no duplica portales.
import type { ReactNode } from 'react';
import { Modal } from './Modal';

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  return <Modal open={open} title={title} onClose={onClose} mobileSheet>{children}</Modal>;
}

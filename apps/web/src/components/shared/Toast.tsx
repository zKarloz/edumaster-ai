// Sistema de notificaciones compartido: posiciones configurables y animaciones accesibles.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info, X } from 'lucide-react';
import { useSettings } from '../../providers/SettingsProvider';

type ToastMessage = { id: number; text: string; type: 'success' | 'info' };
type ToastContextValue = { notify: (text: string, type?: ToastMessage['type']) => void };
const ToastContext = createContext<ToastContextValue | null>(null);
let nextToastId = 0;

function ToastItem({ message, dismiss }: { message: ToastMessage; dismiss: (id: number) => void }) {
  const [closing, setClosing] = useState(false);
  const { toastPosition } = useSettings();
  useEffect(() => {
    const timeout = window.setTimeout(() => setClosing(true), 4700);
    return () => window.clearTimeout(timeout);
  }, []);
  useEffect(() => {
    if (!closing) return;
    const timeout = window.setTimeout(() => dismiss(message.id), 260);
    return () => window.clearTimeout(timeout);
  }, [closing, dismiss, message.id]);
  return <div className={`app-toast flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-xl dark:border-slate-600 dark:bg-[#15375E] dark:text-white ${closing ? (toastPosition.startsWith('top') ? 'toast-leave-top' : 'toast-leave-bottom') : toastPosition.startsWith('top') ? 'toast-enter-top' : 'toast-enter-bottom'}`}>
    {message.type === 'success' ? <CheckCircle2 size={19} className="shrink-0 text-emerald-500"/> : <Info size={19} className="shrink-0 text-sky-500"/>}
    <span className="min-w-0 flex-1">{message.text}</span>
    <button className="rounded-md p-1" type="button" aria-label="Cerrar aviso" onClick={() => setClosing(true)}><X size={16}/></button>
  </div>;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const { toastPosition } = useSettings();
  const notify = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    setMessages(previous => [...previous, { id: ++nextToastId, text, type }]);
  }, []);
  const dismiss = useCallback((id: number) => setMessages(previous => previous.filter(message => message.id !== id)), []);
  const isTop = toastPosition.startsWith('top');
  const isCenter = toastPosition.endsWith('center');
  return <ToastContext.Provider value={{ notify }}>
    {children}
    {createPortal(<div role="status" aria-live="polite" aria-atomic="false" className={`pointer-events-none fixed z-[11000] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2 ${isTop ? 'top-5' : 'bottom-5'} ${isCenter ? 'left-1/2 -translate-x-1/2' : 'right-4'} ${isTop ? '' : 'justify-end'}`}>
      {messages.map(message => <div className="pointer-events-auto" key={message.id}><ToastItem message={message} dismiss={dismiss}/></div>)}
    </div>, document.body)}
  </ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast debe usarse dentro de ToastProvider.');
  return value;
}

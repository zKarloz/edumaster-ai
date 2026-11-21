// Opciones de apariencia y notificaciones. Nuevas preferencias se agregarán aquí.
import { Bell, Check, Clapperboard, Layers3, MonitorCog, Send, SlidersHorizontal } from 'lucide-react';
import { useSettings, type ModalBackdropStyle, type ThemeName, type ToastPosition } from '../../providers/SettingsProvider';
import { useToast } from '../../components/shared/Toast';

const themes: { id: ThemeName; label: string; hint: string; swatch: string }[] = [
  { id: 'light', label: 'Claro', hint: 'Superficies luminosas', swatch: 'bg-[#f5f7fb] border-slate-300' },
  { id: 'dark', label: 'Oscuro', hint: 'Azul marino EduMaster', swatch: 'bg-[#06152B] border-[#20C8F5]' },
  { id: 'black', label: 'Negro', hint: 'Escala de grises', swatch: 'bg-[#090909] border-[#777777]' },
];
const positions: { id: ToastPosition; label: string }[] = [
  { id: 'bottom-right', label: 'Abajo a la derecha' },
  { id: 'top-right', label: 'Arriba a la derecha' },
  { id: 'top-center', label: 'Arriba al centro' },
  { id: 'bottom-center', label: 'Abajo al centro' },
];

export function SettingsPage() {
  const { theme, toastPosition, modalBackdrop, animationsEnabled, setTheme, setToastPosition, setModalBackdrop, setAnimationsEnabled } = useSettings();
  const { notify } = useToast();
  return <div className="grid gap-5 xl:grid-cols-2">
    <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#23456A] dark:bg-[#0A1F3D]">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><MonitorCog size={21}/> Apariencia</h3>
      <p className="app-muted mb-5 mt-2 text-sm text-slate-500 dark:text-slate-300">Elige la paleta de EduMaster.ai. Se aplicará a todos los módulos.</p>
      <fieldset className="grid gap-3">
        <legend className="sr-only">Tema de color</legend>
        {themes.map(option => <label key={option.id} className={`app-choice flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${theme === option.id ? 'app-choice-selected' : 'border-slate-200 dark:border-[#23456A]'}`}>
          <input className="sr-only" type="radio" name="theme" value={option.id} checked={theme === option.id} onChange={() => setTheme(option.id)}/>
          <span aria-hidden="true" className={`size-10 shrink-0 rounded-lg border-2 ${option.swatch}`}/>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{option.label}</span><span className="app-muted block text-xs text-slate-500 dark:text-slate-300">{option.hint}</span></span>
          {theme === option.id && <Check aria-label="Seleccionado" size={18} className="app-choice-check text-sky-500"/>}
        </label>)}
      </fieldset>
    </section>
    <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#23456A] dark:bg-[#0A1F3D]">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><Bell size={21}/> Notificaciones flotantes</h3>
      <p className="app-muted mb-5 mt-2 text-sm text-slate-500 dark:text-slate-300">Selecciona en qué parte de la pantalla aparecen los avisos.</p>
      <fieldset className="space-y-2">
        <legend className="sr-only">Posición de los avisos</legend>
        {positions.map(option => <label key={option.id} className="app-choice flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-[#23456A]">
          <input type="radio" name="toast-position" value={option.id} checked={toastPosition === option.id} onChange={() => setToastPosition(option.id)} className="app-preference-radio accent-sky-500"/>
          {option.label}
        </label>)}
      </fieldset>
      <button type="button" className="app-secondary-button mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium dark:border-[#23456A]" onClick={() => notify('Así se verán tus notificaciones.', 'success')}><Send size={16}/> Probar notificación</button>
    </section>
    <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#23456A] dark:bg-[#0A1F3D] xl:col-span-2">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><Layers3 size={21}/> Fondo de las ventanas emergentes</h3>
      <p className="app-muted mb-5 mt-2 text-sm text-slate-500 dark:text-slate-300">Configura cómo se oscurece el contenido detrás de todos los modales.</p>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Efecto de fondo de modales</legend>
        {([
          { id: 'blur', label: 'Desenfoque suave', detail: 'Sombreado y fondo ligeramente difuminado.' },
          { id: 'dim', label: 'Sombreado básico', detail: 'Oscurece el fondo, sin desenfocarlo.' },
        ] satisfies { id: ModalBackdropStyle; label: string; detail: string }[]).map(option =>
          <label key={option.id} className={`app-choice flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${modalBackdrop === option.id ? 'app-choice-selected' : 'border-slate-200 dark:border-[#23456A]'}`}>
            <input type="radio" name="modal-backdrop" value={option.id} checked={modalBackdrop === option.id}
              onChange={() => setModalBackdrop(option.id)} className="app-preference-radio accent-sky-500"/>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{option.label}</span><span className="app-muted mt-1 block text-xs">{option.detail}</span></span>
          </label>)}
      </fieldset>
    </section>
    <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 dark:border-[#23456A] dark:bg-[#0A1F3D] xl:col-span-2">
      <h3 className="flex items-center gap-2 text-lg font-semibold"><Clapperboard size={21}/> Animaciones de la interfaz</h3>
      <p className="app-muted mb-5 mt-2 text-sm text-slate-500 dark:text-slate-300">Puedes desactivar el movimiento en navegación, modales, ayudas y notificaciones. Las funciones seguirán disponibles.</p>
      <label className="app-choice flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-[#23456A]">
        <input type="checkbox" role="switch" checked={animationsEnabled} onChange={event => setAnimationsEnabled(event.target.checked)}
          className="app-preference-radio mt-0.5 size-5 shrink-0 accent-sky-500"/>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Activar animaciones</span>
          <span className="app-muted mt-1 block text-xs">{animationsEnabled ? 'Transiciones suaves habilitadas.' : 'Transiciones y movimientos desactivados.'} Siempre se respeta la opción «Reducir movimiento» del sistema.</span>
        </span>
      </label>
    </section>
    <section className="app-panel rounded-2xl border border-dashed border-slate-200 bg-white p-5 dark:border-[#23456A] dark:bg-[#0A1F3D] xl:col-span-2">
      <p className="flex items-center gap-2 text-sm font-medium"><SlidersHorizontal size={17}/> Preferencias locales</p>
      <p className="app-muted mt-2 text-sm text-slate-500 dark:text-slate-300">Por ahora, las preferencias se guardan por usuario en este navegador. Más adelante podrán sincronizarse con el perfil de Supabase.</p>
    </section>
  </div>;
}

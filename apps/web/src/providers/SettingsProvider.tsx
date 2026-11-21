// Preferencias visuales locales: separadas por usuario autenticado en este navegador.
// La sincronización entre dispositivos requerirá un endpoint de perfil en el backend.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type ThemeName = 'light' | 'dark' | 'black';
export type ToastPosition = 'bottom-right' | 'top-right' | 'top-center' | 'bottom-center';
export type ModalBackdropStyle = 'blur' | 'dim';
interface Preferences { theme: ThemeName; toastPosition: ToastPosition; modalBackdrop: ModalBackdropStyle; animationsEnabled: boolean }
interface SettingsContextValue extends Preferences {
  setTheme: (theme: ThemeName) => void;
  setToastPosition: (position: ToastPosition) => void;
  setModalBackdrop: (style: ModalBackdropStyle) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  selectPreferenceScope: (userId: string | null) => void;
}

const DEFAULTS: Preferences = { theme: 'dark', toastPosition: 'bottom-right', modalBackdrop: 'blur', animationsEnabled: true };
const THEMES: ThemeName[] = ['light', 'dark', 'black'];
const POSITIONS: ToastPosition[] = ['bottom-right', 'top-right', 'top-center', 'bottom-center'];
const storageKey = (scope: string) => `edumaster_preferences_v1_${scope}`;

function readPreferences(scope: string): Preferences {
  try {
    const saved = window.localStorage.getItem(storageKey(scope));
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        const candidate = parsed as Partial<Preferences>;
        return {
          theme: candidate.theme && THEMES.includes(candidate.theme) ? candidate.theme : DEFAULTS.theme,
          toastPosition: candidate.toastPosition && POSITIONS.includes(candidate.toastPosition) ? candidate.toastPosition : DEFAULTS.toastPosition,
          modalBackdrop: candidate.modalBackdrop === 'dim' ? 'dim' : DEFAULTS.modalBackdrop,
          // Preferencias anteriores no incluyen esta propiedad: conservar animaciones por defecto.
          animationsEnabled: typeof candidate.animationsEnabled === 'boolean' ? candidate.animationsEnabled : DEFAULTS.animationsEnabled,
        };
      }
    }
    // Migración del selector claro/oscuro del starter inicial.
    if (scope === 'guest') {
      const legacy = window.localStorage.getItem('edumaster_theme');
      if (legacy === 'light' || legacy === 'dark') return { ...DEFAULTS, theme: legacy };
    }
  } catch { /* Navegador en modo privado o preferencias no disponibles. */ }
  return DEFAULTS;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);
export function SettingsProvider({ children }: { children: ReactNode }) {
  const scopeRef = useRef('guest');
  const [preferences, setPreferences] = useState<Preferences>(() => readPreferences('guest'));

  // Guardamos por ámbito (invitado o usuario). La preferencia no se envía al servidor.
  useEffect(() => {
    try { window.localStorage.setItem(storageKey(scopeRef.current), JSON.stringify(preferences)); }
    catch { /* Sin almacenamiento. */ }
  }, [preferences]);
  const update = useCallback((partial: Partial<Preferences>) => {
    setPreferences(current => ({ ...current, ...partial }));
  }, []);
  const setTheme = useCallback((theme: ThemeName) => update({ theme }), [update]);
  const setToastPosition = useCallback((toastPosition: ToastPosition) => update({ toastPosition }), [update]);
  const setModalBackdrop = useCallback((modalBackdrop: ModalBackdropStyle) => update({ modalBackdrop }), [update]);
  const setAnimationsEnabled = useCallback((animationsEnabled: boolean) => update({ animationsEnabled }), [update]);
  const selectPreferenceScope = useCallback((userId: string | null) => {
    const nextScope = userId ? `user_${userId}` : 'guest';
    if (scopeRef.current === nextScope) return;
    scopeRef.current = nextScope;
    setPreferences(readPreferences(nextScope));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', preferences.theme !== 'light');
    root.classList.toggle('black-theme', preferences.theme === 'black');
    root.dataset.theme = preferences.theme;
  }, [preferences.theme]);

  // Un único atributo CSS controla transiciones y keyframes de toda la interfaz.
  // El CSS también respeta la preferencia del sistema 'reducir movimiento'.
  useEffect(() => {
    document.documentElement.dataset.motion = preferences.animationsEnabled ? 'on' : 'off';
  }, [preferences.animationsEnabled]);

  return <SettingsContext.Provider value={{ ...preferences, setTheme, setToastPosition, setModalBackdrop, setAnimationsEnabled, selectPreferenceScope }}>
    {children}
  </SettingsContext.Provider>;
}
export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings requiere SettingsProvider.');
  return value;
}

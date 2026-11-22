// Preferencias visuales locales: separadas por usuario autenticado en este navegador.
// La sincronización entre dispositivos requerirá un endpoint de perfil en el backend.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import i18n, { normalizeLocale, type Locale } from '../i18n';

export type ThemeName = 'light' | 'dark' | 'black';
export type ToastPosition = 'bottom-right' | 'top-right' | 'top-center' | 'bottom-center';
export type ModalBackdropStyle = 'blur' | 'dim';
export type SidebarMode = 'expanded' | 'collapsed' | 'dynamic';
interface Preferences { theme: ThemeName; toastPosition: ToastPosition; modalBackdrop: ModalBackdropStyle; animationsEnabled: boolean; blurEnabled: boolean; sidebarMode: SidebarMode; locale: Locale }
interface SettingsContextValue extends Preferences {
  setTheme: (theme: ThemeName) => void;
  setToastPosition: (position: ToastPosition) => void;
  setModalBackdrop: (style: ModalBackdropStyle) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setBlurEnabled: (enabled: boolean) => void;
  setSidebarMode: (mode: SidebarMode) => void;
  setLocale: (locale: Locale) => void;
  syncProfileLocale: (code: string | null) => void;
  selectPreferenceScope: (userId: string | null) => void;
}

const DEFAULTS: Preferences = { theme: 'dark', toastPosition: 'bottom-right', modalBackdrop: 'blur', animationsEnabled: true, blurEnabled: true, sidebarMode: 'expanded', locale: 'es' }; 
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
          // Versiones anteriores conservan los efectos de cristal hasta que el usuario decida.
          blurEnabled: typeof candidate.blurEnabled === 'boolean' ? candidate.blurEnabled : DEFAULTS.blurEnabled,
          sidebarMode: ['expanded', 'collapsed', 'dynamic'].includes(candidate.sidebarMode || '') ? candidate.sidebarMode! : (window.localStorage.getItem('edumaster_sidebar_collapsed') === 'true' ? 'collapsed' : 'expanded'),
          locale: normalizeLocale(candidate.locale),
        };
      }
    }
    // Migración del selector claro/oscuro del starter inicial.
    if (scope === 'guest') {
      const legacy = window.localStorage.getItem('edumaster_theme');
      if (legacy === 'light' || legacy === 'dark') return { ...DEFAULTS, theme: legacy };
    }
  } catch { /* Navegador en modo privado o preferencias no disponibles. */ }
  // Migramos el estado del sidebar de v17 sin escribir sobre la clave antigua.
  try { return { ...DEFAULTS, sidebarMode: window.localStorage.getItem('edumaster_sidebar_collapsed') === 'true' ? 'collapsed' : 'expanded' }; }
  catch { return DEFAULTS; }
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
  const setBlurEnabled = useCallback((blurEnabled: boolean) => update({ blurEnabled }), [update]);
  const setSidebarMode = useCallback((sidebarMode: SidebarMode) => update({ sidebarMode }), [update]);
  const setLocale = useCallback((locale: Locale) => {
    // Solo la selección manual establece prioridad frente al valor remoto.
    try { window.localStorage.setItem(`edumaster_language_selected_${scopeRef.current}`, 'true'); }
    catch { /* Sin almacenamiento local. */ }
    update({ locale });
  }, [update]);
  const syncProfileLocale = useCallback((code: string | null) => {
    if (!code || !['es', 'en', 'pt'].includes(code.toLowerCase().split('-')[0] || '')) return;
    try {
      if (window.localStorage.getItem(`edumaster_language_selected_${scopeRef.current}`)) return;
    } catch { /* Prefiere idioma remoto si no hay almacenamiento. */ }
    update({ locale: normalizeLocale(code) });
  }, [update]);
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

  // El idioma traduce textos visibles y cambia el formato regional del navegador.
  useEffect(() => {
    void i18n.changeLanguage(preferences.locale);
    document.documentElement.lang = preferences.locale === 'pt' ? 'pt-BR' : preferences.locale;
  }, [preferences.locale]);

  // Un único atributo CSS controla transiciones y keyframes de toda la interfaz.
  // El CSS también respeta la preferencia del sistema 'reducir movimiento'.
  useEffect(() => {
    document.documentElement.dataset.motion = preferences.animationsEnabled ? 'on' : 'off';
  }, [preferences.animationsEnabled]);

  // Desenfoque de superficies (topbar y ventanas); independiente de las animaciones.
  useEffect(() => {
    document.documentElement.dataset.blur = preferences.blurEnabled ? 'on' : 'off';
  }, [preferences.blurEnabled]);

  return <SettingsContext.Provider value={{ ...preferences, setTheme, setToastPosition, setModalBackdrop, setAnimationsEnabled, setBlurEnabled, setSidebarMode, setLocale, syncProfileLocale, selectPreferenceScope }}>
    {children}
  </SettingsContext.Provider>;
}
export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings requiere SettingsProvider.');
  return value;
}

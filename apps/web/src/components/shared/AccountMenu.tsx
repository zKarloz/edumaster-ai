// Menú de sesión: disclosure accesible, no altera el layout al abrirse.
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Contrast, LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { useSettings, type ThemeName } from '../../providers/SettingsProvider';
import { UserAvatar } from './UserAvatar';
import type { ProfileIdentity } from '../../modules/profile/types';

const THEMES = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'black', label: 'Negro', icon: Contrast },
] satisfies Array<{ value: ThemeName; label: string; icon: typeof Sun }>;

export function AccountMenu({ identity, roleLabel, userId, photo, photoLoading, onProfile, onSignOut }: {
  identity: ProfileIdentity; roleLabel: string; userId: string; photo: string | null; photoLoading?: boolean;
  onProfile: () => void; onSignOut: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const { theme, setTheme } = useSettings();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent | FocusEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  async function exit() {
    setBusy(true);
    try { await onSignOut(); } finally { setBusy(false); setOpen(false); }
  }
  return <div className="relative" ref={root}>
    <button ref={trigger} type="button" className="app-secondary-button flex max-w-[240px] items-center gap-3 rounded-xl border px-2 py-1.5 text-left sm:px-3"
      aria-label={t('account.menu')} aria-controls={id} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <UserAvatar userId={userId} name={identity.name} photo={photo} loading={photoLoading}/>
      <span className="hidden min-w-0 sm:block"><span className="block truncate text-sm font-semibold">{identity.name}</span><span className="app-muted block text-xs">{t('account.myAccount')}</span></span>
      <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}/>
    </button>
    <div id={id} inert={!open} aria-hidden={!open} data-open={open} className="app-account-menu app-panel absolute right-0 top-full z-50 mt-2 w-[min(300px,calc(100vw-2rem))] rounded-2xl border p-2 shadow-2xl">
      {/* La foto está únicamente en el botón del topbar: el menú abierto muestra rol y correo. */}
      <div className="min-w-0 px-3 py-3">
        <p className="text-sm font-semibold">{roleLabel}</p>
        <p className="app-muted mt-1 break-all text-xs">{identity.email}</p>
      </div>
      <div className="app-divider border-t px-3 py-3">
        <p className="app-muted mb-2 text-xs font-medium">{t('account.theme')}</p>
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label={t('account.chooseTheme')}>
          {THEMES.map(({ value, icon: Icon }) => <button key={value} type="button" aria-pressed={theme === value} onClick={() => setTheme(value)}
            className="app-secondary-button app-account-theme flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-xs"><Icon size={17}/>{t(`account.${value}`)}{theme === value && <Check size={12} aria-hidden="true"/>}</button>)}
        </div>
      </div>
      <div className="app-divider space-y-1 border-t pt-2">
        <button className="app-account-action flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm" type="button" onClick={() => { setOpen(false); onProfile(); }}><UserRound size={18}/> {t('account.viewProfile')}</button>
        <button className="app-account-action flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-red-600 dark:text-red-400" type="button" disabled={busy} onClick={() => void exit()}><LogOut size={18}/> {t(busy ? 'account.signingOut' : 'account.signout')}</button>
      </div>
    </div>
  </div>;
}

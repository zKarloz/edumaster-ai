// Cambio de contraseña en Modal compartido. La política real se aplica en Supabase Auth.
import { useState, type FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
import { KeyRound } from 'lucide-react';
import { Modal } from '../../components/shared/Modal';
import { useToast } from '../../components/shared/Toast';
import { supabase } from '../../lib/supabase';


/**
 * Verifica la contraseña actual contra Supabase Auth, sin alterar la sesión principal.
 *
 * La verificación se hace en una instancia aislada de Supabase: un signInWithPassword
 * sobre el cliente compartido reemplazaría la sesión y podría interrumpir la UI.
 * Este control protege el formulario; para impedir cambios por llamadas directas a
 * Supabase Auth TAMBIÉN debe habilitarse en el proyecto la política de servidor
 * «Require current password when changing password».
 */
async function verifyCurrentPassword(currentPassword: string): Promise<boolean> {
  const client = supabase;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!client || !url || !key) return false;

  // getUser() consulta Auth y evita confiar solamente en datos en caché del navegador.
  const { data: identity, error: identityError } = await client.auth.getUser();
  const user = identity.user;
  if (identityError || !user?.id || !user.email) return false;

  const verifier = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'edumaster-verificacion-contrasena',
    },
  });

  try {
    // Nunca se guardan ni registran contraseñas ni tokens del verificador.
    const { data, error } = await verifier.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    return !error && !!data.user?.id && data.user.id === user.id;
  } catch {
    // Si hay una caída de red, se deniega el cambio (fail closed).
    return false;
  } finally {
    // scope: local revoca SOLO la sesión temporal, no la sesión principal.
    await verifier.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }
}

const field = 'app-input w-full rounded-xl border px-3 py-2.5 text-sm';
const primary = 'app-primary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50';
const secondary = 'app-secondary-button inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50';

export function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notify } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [nonce, setNonce] = useState('');
  const [showNonce, setShowNonce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  function close() {
    if (saving || requesting) return;
    setCurrentPassword(''); setPassword(''); setRepeat(''); setNonce(''); setError(''); setShowNonce(false);
    onClose();
  }
  async function sendCode() {
    const client = supabase;
    if (!client) return;
    setRequesting(true); setError('');
    try {
      const { error: err } = await client.auth.reauthenticate();
      if (err) throw err;
      setShowNonce(true);
      notify('Código solicitado. Revisa tu correo.', 'success');
    } catch { setError('No se pudo solicitar el código de verificación.'); }
    finally { setRequesting(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const client = supabase;
    if (!client || !currentPassword || password.length < 8 || password !== repeat || password === currentPassword) {
      setError('La nueva contraseña debe ser diferente de la actual, tener al menos 8 caracteres y coincidir con la confirmación.');
      return;
    }
    setSaving(true);
    try {
      // Comprobación real de la contraseña actual con Supabase Auth.
      // Si es incorrecta (o Auth no responde), no se intenta cambiar la contraseña.
      const verified = await verifyCurrentPassword(currentPassword);
      if (!verified) {
        setError('No se pudo verificar la contraseña actual. Comprueba que sea correcta e inténtalo de nuevo.');
        return;
      }

      // El proyecto DEBE tener además activada la comprobación en el servidor:
      // Authentication → Sign In / Providers → Email → Require current password.
      const { error: err } = await client.auth.updateUser({
        password, current_password: currentPassword,
        ...(nonce.trim() ? { nonce: nonce.trim() } : {}),
      });
      if (err) {
        setError(err.code === 'same_password'
          ? 'La nueva contraseña debe ser distinta de la vigente.'
          : err.code === 'current_password_mismatch' || err.code === 'current_password_invalid'
            ? 'La contraseña actual es incorrecta.'
            : 'Supabase rechazó el cambio. Comprueba las políticas de seguridad y el código de verificación si corresponde.');
        return;
      }
      notify('Contraseña actualizada correctamente.', 'success');
      setCurrentPassword(''); setPassword(''); setRepeat(''); setNonce('');
      setError(''); setShowNonce(false);
      onClose();
    } catch { setError('No se pudo conectar con Supabase Auth.'); }
    finally { setSaving(false); }
  }
  return <Modal open={open} onClose={close} title="Cambiar contraseña">
    <form onSubmit={event => void submit(event)} className="space-y-4">
      <p className="app-muted text-sm">El cambio de contraseña se valida con Supabase Auth y no altera tus roles institucionales.</p>
      <label className="flex flex-col gap-1.5 text-sm font-medium">Contraseña actual
        <input className={field} type="password" required autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}/></label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">Nueva contraseña
        <input className={field} type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}/></label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">Confirmar nueva contraseña
        <input className={field} type="password" required minLength={8} autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)}/></label>
      <button type="button" className={`${secondary} text-xs`} disabled={saving || requesting} onClick={() => void sendCode()}>
        {requesting ? 'Solicitando...' : 'Solicitar código de verificación (si se requiere)'}</button>
      {showNonce && <label className="flex flex-col gap-1.5 text-sm font-medium">Código recibido
        <input className={field} autoComplete="one-time-code" value={nonce} onChange={e => setNonce(e.target.value)}/></label>}
      <p className="app-muted text-xs">No reutilices contraseñas antiguas. Supabase rechaza repetir la contraseña vigente; no existe una política de historial de contraseñas antiguas habilitada.</p>
      {error && <div role="alert" className="app-warning rounded-xl border p-3 text-sm">{error}</div>}
      <div className="app-divider flex flex-wrap justify-end gap-2 border-t pt-4">
        <button type="button" className={secondary} disabled={saving || requesting} onClick={close}>Cancelar</button>
        <button type="submit" className={primary} disabled={saving || requesting || !currentPassword || password.length < 8 || password !== repeat}>
          <KeyRound size={16}/>{saving ? 'Actualizando...' : 'Cambiar contraseña'}</button>
      </div>
    </form>
  </Modal>;
}

/** Finaliza una invitación autenticada sin que el administrador vea la contraseña. */
import { useState, type FormEvent } from 'react';
import { LockKeyhole } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props { email: string; onDone: () => void }

export function InvitePasswordSetup({ email, onDone }: Props) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || password.length < 12 || password !== repeat || busy) return;
    setBusy(true); setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) { setError('No se pudo establecer la contraseña. Comprueba que cumpla las reglas de seguridad.'); return; }
      setPassword(''); setRepeat(''); onDone();
    } catch { setError('Se perdió la conexión con Supabase Auth. Inténtalo nuevamente.'); }
    finally { setBusy(false); }
  }

  return <main className="app-shell flex min-h-screen items-center justify-center p-5">
    <form onSubmit={event => void submit(event)} className="app-panel w-full max-w-md space-y-4 rounded-2xl border p-7 shadow-lg">
      <div className="flex items-center gap-3"><LockKeyhole size={26}/><h1 className="text-xl font-bold">Activar cuenta de EduMaster</h1></div>
      <p className="app-muted text-sm">Invitación para <strong className="break-all">{email}</strong>. Establece tu propia contraseña; el administrador nunca podrá verla.</p>
      <label className="block space-y-1 text-sm font-medium">Contraseña (mínimo 12 caracteres)
        <input className="app-input w-full rounded-xl border p-3" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={event => setPassword(event.target.value)}/>
      </label>
      <label className="block space-y-1 text-sm font-medium">Confirmar contraseña
        <input className="app-input w-full rounded-xl border p-3" type="password" autoComplete="new-password" minLength={12} required value={repeat} onChange={event => setRepeat(event.target.value)}/>
      </label>
      {repeat && password !== repeat && <p role="alert" className="app-warning rounded-xl border p-3 text-sm">Las contraseñas no coinciden.</p>}
      {error && <p role="alert" className="app-warning rounded-xl border p-3 text-sm">{error}</p>}
      <button className="app-primary-button w-full rounded-xl px-4 py-3 font-semibold disabled:opacity-50" type="submit" disabled={busy || password.length < 12 || password !== repeat}>{busy ? 'Activando...' : 'Establecer contraseña y continuar'}</button>
    </form>
  </main>;
}

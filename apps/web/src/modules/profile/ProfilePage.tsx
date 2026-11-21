// Perfil propio. Datos y avatar en tarjetas; contraseña en Modal compartido.
import { useState, type FormEvent } from 'react';
import { Camera, ChevronRight, KeyRound, Save, Trash2, UserRound } from 'lucide-react';
import { UserAvatar } from '../../components/shared/UserAvatar';
import { useToast } from '../../components/shared/Toast';
import { PasswordDialog } from './PasswordDialog';
import { ProfileDetailsForm } from './ProfileDetailsForm';
import type { ProfileIdentity } from './types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const field = 'app-input w-full rounded-xl border px-3 py-2.5 text-sm';
const primary = 'app-primary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50';
const secondary = 'app-secondary-button inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50';

export function ProfilePage({ identity, token, userId, photo, photoLoading, onIdentity, onSavePhoto, onRemovePhoto }: {
  identity: ProfileIdentity; token: string; userId: string; photo: string | null; photoLoading?: boolean;
  onIdentity: (value: ProfileIdentity) => void; onSavePhoto: (file: File) => Promise<void>; onRemovePhoto: () => Promise<void>;
}) {
  const [name, setName] = useState(identity.name);
  const [savingName, setSavingName] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const { notify } = useToast();
  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSavingName(true);
    try {
      const response = await fetch(`${API}/api/v1/me/profile`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) });
      if (!response.ok) throw new Error('No se pudo guardar el nombre. Comprueba tu sesión y la API.');
      const updated = await response.json() as ProfileIdentity;
      onIdentity(updated); setName(updated.name); notify('Nombre actualizado.', 'success');
    } catch (cause) { notify(cause instanceof Error ? cause.message : 'No se pudo guardar el nombre.'); }
    finally { setSavingName(false); }
  }
  async function changePhoto(file?: File) {
    if (!file) return;
    setSavingPhoto(true);
    try { await onSavePhoto(file); notify('Foto de perfil actualizada.', 'success'); }
    catch (cause) { notify(cause instanceof Error ? cause.message : 'No se pudo actualizar la foto.'); }
    finally { setSavingPhoto(false); }
  }
  async function removePhoto() {
    setSavingPhoto(true);
    try { await onRemovePhoto(); notify('Foto eliminada.', 'success'); }
    catch (cause) { notify(cause instanceof Error ? cause.message : 'No se pudo eliminar la foto.'); }
    finally { setSavingPhoto(false); }
  }
  return <>
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <section className="app-panel rounded-2xl border p-5 sm:p-6">
        <div className="flex items-center gap-3"><UserRound size={21}/><h3 className="text-lg font-semibold">Información personal</h3></div>
        <div className="my-6 flex flex-wrap items-center gap-5">
          <UserAvatar userId={userId} name={identity.name} photo={photo} loading={photoLoading} large/>
          <div className="space-y-2"><p className="text-sm font-medium">Foto de perfil</p><p className="app-muted text-xs">JPG, PNG o WebP · máximo 5 MB · recorte cuadrado</p>
            <div className="flex flex-wrap gap-2">
              <label className={`${secondary} cursor-pointer ${savingPhoto ? 'pointer-events-none opacity-50' : ''}`}>
                <Camera size={16}/>{savingPhoto ? 'Procesando...' : 'Cambiar foto'}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={savingPhoto} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void changePhoto(file); }}/></label>
              {photo && <button type="button" disabled={savingPhoto} className={secondary} onClick={() => void removePhoto()}><Trash2 size={16}/> Quitar</button>}
            </div>
          </div>
        </div>
        <form className="space-y-4" onSubmit={event => void saveName(event)}>
          <label className="flex flex-col gap-1.5 text-sm font-medium">Nombre completo<input className={field} value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={180} autoComplete="name"/></label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">Correo electrónico<input className={`${field} opacity-70`} value={identity.email} readOnly aria-readonly="true" autoComplete="email"/></label>
          <p className="app-muted text-xs">El correo identifica tu cuenta y no puede cambiarse desde este formulario.</p>
          <button className={primary} disabled={savingName || name.trim() === identity.name || name.trim().length < 2}><Save size={17}/>{savingName ? 'Guardando...' : 'Guardar nombre'}</button>
        </form>
      </section>
      <button type="button" onClick={() => setPasswordModal(true)} className="app-panel group flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition-colors hover:brightness-105 sm:p-6">
        <span className="app-secondary-button rounded-xl border p-3"><KeyRound size={22}/></span>
        <span className="flex-1"><span className="block text-lg font-semibold">Seguridad de la cuenta</span>
          <span className="app-muted mt-1 block text-sm">Cambiar mi contraseña de forma segura</span>
          <span className="app-muted mt-2 block text-xs">Pulsa para abrir el formulario de cambio de contraseña.</span></span>
        <ChevronRight size={20} className="app-muted"/>
      </button>
    </div>
    <ProfileDetailsForm token={token}/>
    <PasswordDialog open={passwordModal} onClose={() => setPasswordModal(false)}/>
  </>;
}

// Perfil propio. Datos y avatar en tarjetas; contraseña en Modal compartido.
import { useRef, useState, type ChangeEvent, type FormEvent, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, ChevronRight, Eye, KeyRound, Pencil, Save, Trash2, UserRound } from 'lucide-react';
import { UserAvatar, avatarColor } from '../../components/shared/UserAvatar';
import { Modal } from '../../components/shared/Modal';
import { BottomSheet } from '../../components/shared/BottomSheet';
import { useToast } from '../../components/shared/Toast';
import { PasswordDialog } from './PasswordDialog';
import { ProfileDetailsForm } from './ProfileDetailsForm';
import type { ProfileIdentity } from './types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const field = 'app-input w-full rounded-xl border px-3 py-2.5 text-sm';
const primary = 'app-primary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50';

export function ProfilePage({ identity, token, userId, photo, photoLoading, onIdentity, onSavePhoto, onRemovePhoto }: {
  identity: ProfileIdentity; token: string; userId: string; photo: string | null; photoLoading?: boolean;
  onIdentity: (value: ProfileIdentity) => void; onSavePhoto: (file: File) => Promise<void>; onRemovePhoto: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(identity.name);
  const [savingName, setSavingName] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [nameModal, setNameModal] = useState(false);
  const [photoActionsOpen, setPhotoActionsOpen] = useState(false);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();
  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSavingName(true);
    try {
      const response = await fetch(`${API}/api/v1/me/profile`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) });
      if (!response.ok) throw new Error('No se pudo guardar el nombre. Comprueba tu sesión y la API.');
      const updated = await response.json() as ProfileIdentity;
      onIdentity(updated); setName(updated.name); setNameModal(false); notify('Nombre actualizado.', 'success');
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
  /** El input oculto mantiene la selección nativa de archivos también en móviles. */
  function onPhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void changePhoto(file);
  }
  // The cover uses a blurred, local copy of the avatar image. No photo or color
  // is sent to an external service. Without an image, fall back to its stable color.
  const coverStyle = { '--profile-cover-color': avatarColor(userId) } as CSSProperties;
  return <>
    <div className="space-y-5">
      <section className="app-panel overflow-hidden rounded-2xl border" aria-labelledby="profile-personal-title">
        <div className="app-profile-cover relative h-36 overflow-hidden sm:h-44" style={coverStyle}>
          {photo && !photoLoading && <img src={photo} alt="" aria-hidden="true"
            className="app-profile-cover-photo pointer-events-none absolute inset-0 size-full object-cover"/>}
          <div className="app-profile-cover-shade pointer-events-none absolute inset-0"/>
          <h2 id="profile-personal-title" className="relative z-10 px-5 pt-5 text-sm font-semibold text-white sm:px-8">
            <span className="inline-flex items-center gap-2"><UserRound size={17}/>{t('profile.personal')}</span>
          </h2>
        </div>
        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:gap-6">
            <button type="button" disabled={savingPhoto}
              onClick={() => setPhotoActionsOpen(true)}
              aria-label={t('profile.photoActions')} title={t('profile.photoActions')}
              className="group relative z-10 -mt-12 shrink-0 rounded-full border-4 border-[var(--app-panel-bg)] shadow-lg focus-visible:outline-offset-4 disabled:opacity-60 sm:-mt-14">
              <UserAvatar userId={userId} name={identity.name} photo={photo} loading={photoLoading} profile/>
              {/* El icono aparece en hover/foco de PC, y permanece visible en touch. */}
              <span aria-hidden="true" className="app-profile-photo-edit pointer-events-none absolute bottom-1 right-1 flex size-9 items-center justify-center rounded-full bg-black/75 text-white opacity-100 transition-opacity duration-200 sm:inset-0 sm:size-auto sm:bg-black/45 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
                <Pencil size={24}/>
              </span>
            </button>
            <div className="min-w-0 w-full flex-1 pb-1 pt-0 text-center sm:pt-3 sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h3 className="min-w-0 break-words text-2xl font-bold leading-tight sm:text-3xl">{identity.name}</h3>
                <button type="button" onClick={() => { setName(identity.name); setNameModal(true); }}
                  aria-label={t('profile.fullName')} title={t('profile.fullName')}
                  className="app-profile-edit-button inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors">
                  <Pencil size={17}/>
                </button>
              </div>
              <p className="app-muted mt-1 break-all text-sm">{identity.email}</p>
            </div>
          </div>
          <div className="mt-4 text-center sm:text-left">
            <p className="app-muted text-xs">{t('profile.photoHint')}</p>
          </div>
        </div>
      </section>
      <button type="button" onClick={() => setPasswordModal(true)} className="app-panel group flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition-colors hover:brightness-105 sm:p-6">
        <span className="app-secondary-button rounded-xl border p-3"><KeyRound size={22}/></span>
        <span className="flex-1"><span className="block text-lg font-semibold">{t('profile.security')}</span>
          <span className="app-muted mt-1 block text-sm">{t('profile.passwordChange')}</span>
          <span className="app-muted mt-2 block text-xs">{t('profile.passwordHint')}</span></span>
        <ChevronRight size={20} className="app-muted"/>
      </button>
    </div>
    <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp"
      className="sr-only" tabIndex={-1} disabled={savingPhoto} aria-label={t('profile.changePhoto')}
      onChange={onPhotoSelected}/>
    <BottomSheet open={photoActionsOpen} title={t('profile.photoActions')}
      onClose={() => { if (!savingPhoto) setPhotoActionsOpen(false); }}>
      <div className="space-y-2">
        <button type="button" disabled={!photo || photoLoading || savingPhoto}
          onClick={() => { setPhotoActionsOpen(false); setPhotoPreviewOpen(true); }}
          className="app-profile-action app-secondary-button flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm disabled:opacity-40">
          <Eye size={19}/> {t('profile.viewPhoto')}
        </button>
        <button type="button" disabled={savingPhoto}
          onClick={() => { setPhotoActionsOpen(false); photoInputRef.current?.click(); }}
          className="app-profile-action app-secondary-button flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm disabled:opacity-40">
          <Camera size={19}/> {t('profile.changePhoto')}
        </button>
        <button type="button" disabled={!photo || photoLoading || savingPhoto}
          onClick={() => { setPhotoActionsOpen(false); void removePhoto(); }}
          className="app-profile-action app-secondary-button flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm text-red-600 dark:text-red-300 disabled:opacity-40">
          <Trash2 size={19}/> {t('profile.remove')}
        </button>
      </div>
    </BottomSheet>
    <Modal open={photoPreviewOpen && Boolean(photo)} title={t('profile.viewPhoto')}
      onClose={() => setPhotoPreviewOpen(false)}>
      {photo && <img src={photo} alt={t('profile.photo')} className="mx-auto max-h-[65dvh] w-auto max-w-full rounded-xl object-contain"/>}
    </Modal>
    <BottomSheet open={nameModal} title={t('profile.editName')} onClose={() => { if (!savingName) setNameModal(false); }}>
      <form className="space-y-4" onSubmit={event => void saveName(event)}>
        <label className="flex flex-col gap-1.5 text-sm font-medium">{t('profile.fullName')}
          <input className={field} value={name} onChange={event => setName(event.target.value)}
            required minLength={2} maxLength={180} autoComplete="name"/>
        </label>
        <div className="flex justify-end">
          <button className={primary} disabled={savingName || name.trim() === identity.name || name.trim().length < 2}>
            <Save size={17}/>{t(savingName ? 'profile.saving' : 'profile.saveName')}
          </button>
        </div>
      </form>
    </BottomSheet>
    <ProfileDetailsForm token={token}/>
    <PasswordDialog open={passwordModal} onClose={() => setPasswordModal(false)}/>
  </>;
}

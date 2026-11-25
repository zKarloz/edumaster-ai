/** Invitación individual y directorio de usuarios de una institución.
 * La importación CSV usa una página propia: UsersCsvImportPage.
 * La autorización real corresponde al backend, nunca a este componente.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { FileSpreadsheet, MailPlus } from 'lucide-react';
import { useNavigate } from 'react-router';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { Modal } from '../../components/shared/Modal';
import { OptionSelect } from '../../components/shared/OptionSelect';
import { Spinner } from '../../components/shared/Spinner';
import { useToast } from '../../components/shared/Toast';
import { usersCsvImportPath } from '../../routes';
import type { Organization } from '../organizations/types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ROLES = [
  { value: 'student', label: 'Estudiante' },
  { value: 'instructor', label: 'Docente / Instructor' },
  { value: 'coordinator', label: 'Director / Coordinador' },
  { value: 'analyst', label: 'Analista de datos' },
  { value: 'ml_engineer', label: 'Ingeniero de ML' },
];
const styles = {
  input: 'app-input w-full rounded-xl border px-3 py-2.5 text-sm',
  button: 'app-primary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50',
  alt: 'app-secondary-button inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm disabled:opacity-50',
};
interface DirectoryMember { user_id: string; full_name: string; email: string; status: string; roles: string[] }
interface Props {
  token: string;
  organizations: Organization[];
  organizationId?: string;
  globalAdmin: boolean;
  onChange: () => void;
}

export function UserProvisioningPanel({ token, organizations, organizationId, globalAdmin, onChange }: Props) {
  const { notify } = useToast();
  const navigate = useNavigate();
  const [orgId, setOrgId] = useState('');
  // Las instituciones se cargan después de restaurar la sesión. No fijamos
  // organizationId al primer render: podría estar vacío y ocultar el directorio.
  const activeOrg = organizationId || (organizations.some(org => org.id === orgId) ? orgId : organizations[0]?.id ?? '');
  const ready = Boolean(activeOrg && organizations.some(org => org.id === activeOrg));
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('student');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [directory, setDirectory] = useState<DirectoryMember[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [reload, setReload] = useState(0);
  const roles = globalAdmin ? [...ROLES, { value: 'institution_admin', label: 'Administrador institucional' }] : ROLES;

  useEffect(() => {
    if (!globalAdmin || !ready || !token) {
      setDirectory([]);
      setDirectoryLoading(false);
      setDirectoryError('');
      return;
    }
    const controller = new AbortController();
    setDirectoryLoading(true);
    setDirectoryError('');
    void fetch(`${API}/api/v1/provisioning/organizations/${activeOrg}/members`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error(`No se pudo consultar el directorio (HTTP ${response.status}).`);
      return response.json() as Promise<{ items: DirectoryMember[] }>;
    }).then(result => { if (!controller.signal.aborted) setDirectory(result.items ?? []); })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setDirectoryError(cause instanceof Error ? cause.message : 'No se pudo consultar el directorio');
          setDirectory([]);
        }
      }).finally(() => { if (!controller.signal.aborted) setDirectoryLoading(false); });
    return () => controller.abort();
  }, [globalAdmin, ready, activeOrg, token, reload]);

  function startInvite() {
    if (!ready) return;
    setInviteOpen(true);
    setError(''); setConfirmed(false);
    setEmail(''); setFullName(''); setRole('student');
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || !ready || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`${API}/api/v1/provisioning/organizations/${activeOrg}/invite`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), full_name: fullName.trim(), role }),
      });
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'string'
          ? data.detail : `No se pudo enviar la invitación (HTTP ${response.status}).`;
        throw new Error(message);
      }
      notify('Invitación enviada. El usuario establecerá sus credenciales desde el correo.', 'success');
      setInviteOpen(false); setReload(value => value + 1); onChange();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo invitar al usuario'); }
    finally { setBusy(false); }
  }

  const columns: Column<DirectoryMember>[] = [
    { header: 'Usuario', key: 'full_name', render: item => <div><strong>{item.full_name}</strong><p className="app-muted text-xs">{item.email}</p></div> },
    { header: 'Rol', key: 'roles', render: item => item.roles.join(', ') || 'Sin rol' },
    { header: 'Estado', key: 'status', render: item => item.status === 'invited' ? 'Invitado (pendiente)' : item.status },
  ];

  return <>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={!ready} className={styles.button} onClick={startInvite}><MailPlus size={17}/> Invitar usuario</button>
      <button type="button" disabled={!ready} className={styles.alt}
        onClick={() => navigate(usersCsvImportPath(activeOrg))}><FileSpreadsheet size={17}/> Importar CSV</button>
      {globalAdmin && <div className="w-full sm:w-72"><OptionSelect ariaLabel="Institución para el directorio" value={activeOrg}
        options={organizations.map(org => ({ value: org.id, label: org.name }))} onChange={setOrgId}/></div>}
    </div>
    {globalAdmin && <div className="space-y-2">
      {directoryLoading && <Spinner label="Consultando directorio institucional..."/>}
      {directoryError && <div role="alert" className="app-warning rounded-xl border p-3 text-sm">{directoryError}</div>}
      {ready && <DataTable label="Directorio de usuarios por institución" rows={directory} columns={columns}/>}
      {!ready && <p role="status" className="app-info rounded-xl border p-3 text-sm">Selecciona una institución autorizada para consultar su directorio.</p>}
    </div>}
    <Modal open={inviteOpen} title="Invitar usuario a EduMaster" onClose={() => { if (!busy) setInviteOpen(false); }}>
      <form onSubmit={event => void invite(event)} className="space-y-4">
        <p className="app-info rounded-xl border p-3 text-sm">Supabase enviará un correo de invitación. No necesitas asignar contraseñas ni abrir el panel de Supabase.</p>
        {!organizationId && <div className="space-y-1"><label className="text-sm font-medium">Institución</label>
          <OptionSelect ariaLabel="Institución para invitar" value={activeOrg}
            onChange={value => { setOrgId(value); setConfirmed(false); }}
            options={organizations.map(org => ({ value: org.id, label: org.name }))}/></div>}
        <label className="block space-y-1 text-sm font-medium">Correo electrónico
          <input className={styles.input} type="email" maxLength={254} required value={email}
            onChange={event => setEmail(event.target.value)} placeholder="estudiante@institucion.edu"/></label>
        <label className="block space-y-1 text-sm font-medium">Nombres completos
          <input className={styles.input} minLength={3} maxLength={180} required value={fullName}
            onChange={event => setFullName(event.target.value)}/></label>
        <div className="space-y-1"><label className="text-sm font-medium">Rol institucional</label>
          <OptionSelect ariaLabel="Rol del nuevo usuario" value={role} onChange={setRole} options={roles}/></div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={confirmed}
          onChange={event => setConfirmed(event.target.checked)}/><span>Confirmo que tengo autorización para invitar a esta persona a la institución seleccionada.</span></label>
        {error && <p role="alert" className="app-warning rounded-xl border p-3 text-sm">{error}</p>}
        <div className="app-divider flex flex-wrap justify-end gap-2 border-t pt-4">
          <button type="button" disabled={busy} className={styles.alt} onClick={() => setInviteOpen(false)}>Cancelar</button>
          <button type="submit" disabled={busy || !confirmed || !ready} className={styles.button}>{busy ? 'Enviando...' : 'Enviar invitación'}</button>
        </div>
      </form>
    </Modal>
  </>;
}

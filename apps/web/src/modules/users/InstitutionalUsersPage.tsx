// Gestión institucional de usuarios. No crea contraseñas ni concede roles globales.
// Usa los componentes compartidos y los permisos se revalidan en FastAPI.
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Ellipsis, Info, Plus, Shield, UserRoundMinus, UserRoundPlus } from 'lucide-react';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { Modal } from '../../components/shared/Modal';
import { OptionSelect } from '../../components/shared/OptionSelect';
import { Spinner } from '../../components/shared/Spinner';
import { useToast } from '../../components/shared/Toast';
import type { Organization } from '../organizations/types';
import { UserDetailModal } from './UserDetailModal';

interface Member {
  membership_id: string;
  organization_id: string;
  user_id: string;
  full_name: string;
  email: string;
  status: 'active' | 'suspended' | 'invited' | 'revoked';
  roles: string[];
  is_protected: boolean;
  is_self: boolean;
}
interface Props { token: string; organizations: Organization[]; organizationId: string }
type Dialog = 'add' | 'grant' | 'remove' | 'status' | null;
type MemberRole = 'coordinator' | 'instructor' | 'student' | 'analyst' | 'ml_engineer';
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ROLES: Array<{ value: MemberRole; label: string }> = [
  { value: 'coordinator', label: 'Director / Coordinador' },
  { value: 'instructor', label: 'Docente / Instructor' },
  { value: 'student', label: 'Estudiante' },
  { value: 'analyst', label: 'Analista de datos' },
  { value: 'ml_engineer', label: 'Ingeniero de ML' },
];
const ROLE_LABELS: Record<string, string> = {
  institution_admin: 'Administrador institucional', coordinator: 'Coordinador',
  instructor: 'Docente', student: 'Estudiante', analyst: 'Analista',
  ml_engineer: 'Ingeniero de ML', auditor: 'Auditor',
};
const inputStyle = 'app-input w-full rounded-xl border px-3 py-2.5 text-sm';
const buttonPrimary = 'app-primary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';
const buttonSecondary = 'app-secondary-button inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-50';

function readableError(data: unknown, status: number) {
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map(value => value?.msg ?? '').filter(Boolean).join('; ');
  }
  return `La API respondió HTTP ${status}`;
}

export function InstitutionalUsersPage({ token, organizations, organizationId }: Props) {
  const { t } = useTranslation();
  const { notify } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const selectedAuthorized=organizations.some(org=>org.id===organizationId);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [target, setTarget] = useState<Member | null>(null);
  const [detailUser, setDetailUser] = useState<Member | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<MemberRole>('instructor');
  const [confirmed, setConfirmed] = useState(false);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');

  useEffect(() => {
    setMembers([]); setError('');
    if (!organizationId || !organizations.some(item => item.id === organizationId)) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    void fetch(`${API}/api/v1/institutional/organizations/${organizationId}/members`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    }).then(async response => {
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readableError(data, response.status));
      if (!controller.signal.aborted) {
        const payload = data && typeof data === 'object' ? (data as { items?: unknown }) : {};
        setMembers(Array.isArray(payload.items) ? payload.items as Member[] : []);
      }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo consultar el directorio');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, organizationId, organizations, refresh]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return members.filter(member => !search || [member.full_name, member.email, ...member.roles]
      .some(value => value.toLowerCase().includes(search)));
  }, [members, query]);
  const chosenOrg = organizations.find(item => item.id === organizationId);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const selectableRoles = ROLES.filter(option => !target?.roles.includes(option.value));
  const removableRoles = ROLES.filter(option => target?.roles.includes(option.value));
  const protectedMember = (item: Member) => item.is_protected || item.is_self;

  function openDialog(type: Dialog, member: Member | null = null) {
    setDialog(type); setTarget(member); setDialogError(''); setReview(false); setConfirmed(false);
    setEmail(''); setFullName('');
    setRole(type === 'grant' ? (ROLES.find(option => !member?.roles.includes(option.value))?.value ?? 'instructor')
      : type === 'remove' ? (ROLES.find(option => member?.roles.includes(option.value))?.value ?? 'instructor') : 'instructor');
  }

  function closeDialog() { if (!busy) openDialog(null); }

  async function mutate(method: string, path: string, body: unknown, message: string) {
    setBusy(true); setDialogError('');
    try {
      const response = await fetch(`${API}${path}`, {
        method, headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readableError(data, response.status));
      notify(message, 'success');
      openDialog(null);
      setRefresh(current => current + 1);
    } catch (cause) {
      setDialogError(cause instanceof Error ? cause.message : 'No se completó la operación');
    } finally { setBusy(false); }
  }

  function submitAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !validEmail || !confirmed || fullName.trim().length < 3) return;
    if (!review) { setReview(true); return; }
    void mutate('POST', `/api/v1/institutional/organizations/${organizationId}/members`,
      { email: email.trim().toLowerCase(), full_name: fullName.trim(), role }, 'Usuario incorporado a la institución.');
  }

  const base = `/api/v1/institutional/organizations/${organizationId}/members`;
  const columns: Column<Member>[] = [
    { header: 'Usuario', key: 'full_name', render: item => <div className="min-w-40"><p className="font-semibold">{item.full_name}</p><p className="app-muted text-xs break-all">{item.email}</p></div> },
    { header: 'Roles', key: 'roles', render: item => <div className="flex max-w-72 flex-wrap gap-1.5">{item.roles.length
      ? item.roles.map(value => <span key={value} className="app-secondary-button rounded-lg border px-2 py-1 text-xs">{ROLE_LABELS[value] ?? value}</span>)
      : <span className="app-muted text-xs">{t('legacy.kb51dc6112e')}</span>}</div> },
    { header: 'Estado', key: 'status', render: item => <span className={item.status === 'active'
      ? 'rounded-lg bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300'
      : 'app-warning rounded-lg border px-2 py-1 text-xs'}>{item.status === 'active' ? 'Activo' : item.status === 'suspended' ? 'Suspendido' : item.status}</span> },
    { header: 'Acciones', key: 'membership_id', render: item => <div className="flex w-max flex-nowrap items-center gap-2 whitespace-nowrap">
      <button type="button" aria-label={`Ver detalles de ${item.full_name}`} title="Ver detalles del usuario" onClick={() => setDetailUser(item)} className="app-secondary-button inline-flex items-center rounded-lg border p-2"><Ellipsis size={18}/></button>
      {protectedMember(item)
      ? <span className="app-muted inline-flex items-center gap-1 text-xs"><Shield size={14}/> {item.is_self ? 'Tu cuenta' : 'Cuenta protegida'}</span>
      : <div className="flex flex-nowrap items-center gap-2">
          <button type="button" className={buttonSecondary} disabled={item.status !== 'active'} onClick={() => openDialog('grant', item)} title={t('legacy.k23df5a5aa2')}><Plus size={15}/> {t('legacy.ka73f1345df')}</button>
          <button type="button" className={buttonSecondary} disabled={item.status !== 'active' || item.roles.length < 2 || !removableRolesFor(item)} onClick={() => openDialog('remove', item)} title="Retirar rol (se exige mantener al menos uno)"><UserRoundMinus size={15}/> {t('legacy.ka8e1962115')}</button>
          <button type="button" className={buttonSecondary} disabled={!['active', 'suspended'].includes(item.status)} onClick={() => openDialog('status', item)}>{item.status === 'active' ? 'Suspender' : 'Reactivar'}</button>
        </div>}</div> },
  ];

  return <>
    <UserDetailModal open={Boolean(detailUser)} userId={detailUser?.user_id ?? null} organizationId={organizationId || null} token={token} onClose={() => setDetailUser(null)}/>
    <section className="grid gap-4 sm:grid-cols-3">
      {[
        { label: 'Miembros', count: members.length },
        { label: 'Usuarios activos', count: members.filter(item => item.status === 'active').length },
        { label: 'Cuentas suspendidas', count: members.filter(item => item.status === 'suspended').length },
      ].map(item => <div className="app-panel rounded-2xl border p-5" key={item.label}><p className="app-muted text-sm">{item.label}</p><p className="mt-2 text-2xl font-semibold">{item.count}</p></div>)}
    </section>
    <section className="app-panel space-y-4 rounded-2xl border p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-lg font-semibold">{t('legacy.k43fafce483')}</h3><p className="app-muted mt-1 text-sm">{t('legacy.kb75e4247be')}</p></div>
        <button type="button" className={buttonPrimary} disabled={!selectedAuthorized} onClick={() => openDialog('add')}><UserRoundPlus size={17}/> {t('legacy.k354a7ee56f')}</button>
      </div>
      <div className="space-y-1.5"><label htmlFor="member-search" className="text-sm font-medium">{t('legacy.k950be1414e')}</label>
        <input id="member-search" className={inputStyle} placeholder={t('labels.kdcb280502d')} value={query} onChange={event=>setQuery(event.target.value)}/>
      </div>
      {!selectedAuthorized && organizations.length>0 && <p role="status" className="app-info rounded-xl border p-3 text-sm">La institución actual no está bajo tu administración. Selecciona una institución que administras desde Instituciones.</p>}
      {loading && <Spinner label="Cargando usuarios institucionales..."/>}
      {error && <div role="alert" className="app-warning rounded-xl border p-4 text-sm">{error}</div>}
      {!loading && !error && <DataTable<Member> key={organizationId} rows={filtered} label="Usuarios institucionales" columns={columns} pageSize={8}/>}
      {!loading && !error && members.length === 0 && <div className="app-info flex items-start gap-2 rounded-xl border p-4 text-sm"><Info size={18}/>{t('legacy.kc73ae30860')}</div>}
    </section>

    <Modal open={dialog === 'add'} title="Incorporar usuario institucional" onClose={closeDialog}>
      <form onSubmit={submitAdd} className="space-y-4">
        <div className="app-info flex items-start gap-2 rounded-xl border p-3 text-sm"><Info size={17} className="mt-0.5 shrink-0"/><p>{t('legacy.kdfa1848e08')}</p></div>
        <div className="space-y-1.5"><span className="text-sm font-medium">{t('legacy.kc342a804db')}</span><div className="app-panel rounded-xl border px-3 py-2 text-sm">{chosenOrg?.name ?? '—'}</div></div>
        <div className="space-y-1.5"><label htmlFor="new-member-email" className="text-sm font-medium">{t('legacy.k61c683173b')}</label><input id="new-member-email" required maxLength={254} type="email" className={inputStyle} value={email} placeholder="docente@institucion.edu" onChange={event => { setEmail(event.target.value); setReview(false); }}/></div>
        <div className="space-y-1.5"><label htmlFor="new-member-name" className="text-sm font-medium">{t('legacy.k171ef991ee')}</label><input id="new-member-name" required maxLength={180} minLength={3} className={inputStyle} value={fullName} placeholder={t('labels.kd9914a2026')} onChange={event => { setFullName(event.target.value); setReview(false); }}/></div>
        <div className="space-y-1.5"><label className="text-sm font-medium">{t('legacy.ke68b58f113')}</label><OptionSelect ariaLabel="Rol de usuario" value={role} onChange={value => { setRole(value as MemberRole); setReview(false); }} options={ROLES}/></div>
        {role === 'ml_engineer' && <div className="app-info rounded-xl border p-3 text-xs">{t('legacy.k3ae618bbf8')}</div>}
        <label className="flex cursor-pointer items-start gap-2 text-sm"><input className="mt-1 size-4 accent-sky-600" type="checkbox" checked={confirmed} onChange={event => { setConfirmed(event.target.checked); setReview(false); }}/><span>{t('legacy.k3a5463aeea')}</span></label>
        {review && <div className="app-panel space-y-1 rounded-xl border p-4 text-sm"><p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={16}/> {t('legacy.kcf945213c2')}</p><p><b>{t('legacy.kee1f457534')}</b> {email.trim().toLowerCase()}</p><p><b>{t('legacy.k8427b2fe18')}</b> {chosenOrg?.name}</p><p><b>{t('legacy.k92bb0dc23f')}</b> {ROLE_LABELS[role]}</p></div>}
        {dialogError && <div role="alert" className="app-warning rounded-xl border p-3 text-sm">{dialogError}</div>}
        <div className="flex justify-end gap-2 app-divider border-t pt-4"><button type="button" className={buttonSecondary} disabled={busy} onClick={closeDialog}>{t('legacy.kc111e0ab9d')}</button><button type="submit" className={buttonPrimary} disabled={busy || !confirmed || !validEmail || fullName.trim().length < 3}>{busy ? 'Guardando...' : review ? 'Confirmar incorporación' : 'Revisar asignación'}</button></div>
      </form>
    </Modal>
    <Modal open={dialog === 'grant'} title={t('labels.kacfb0564c1')} onClose={closeDialog}>
      <div className="space-y-4 text-sm"><p>{t('legacy.kee1f457534')} <b>{target?.full_name}</b></p>
        {selectableRoles.length === 0 ? <div className="app-info rounded-xl border p-3">{t('legacy.kcb3370b50f')}</div> :
          <div className="space-y-1.5"><label className="font-medium">{t('legacy.k94d14aaa82')}</label><OptionSelect ariaLabel="Rol adicional" value={role} options={selectableRoles} onChange={value => setRole(value as MemberRole)}/></div>}
        {dialogError && <div role="alert" className="app-warning rounded-xl border p-3">{dialogError}</div>}
        <div className="flex justify-end gap-2 app-divider border-t pt-4"><button type="button" className={buttonSecondary} disabled={busy} onClick={closeDialog}>{t('legacy.kc111e0ab9d')}</button><button className={buttonPrimary} type="button" disabled={busy || !target || !selectableRoles.length} onClick={() => target && void mutate('POST', `${base}/${target.membership_id}/roles`, { role }, 'Rol asignado.')}>{t('legacy.k23df5a5aa2')}</button></div>
      </div>
    </Modal>
    <Modal open={dialog === 'remove'} title="Retirar rol" onClose={closeDialog}>
      <div className="space-y-4 text-sm"><div className="app-warning flex gap-2 rounded-xl border p-3"><AlertTriangle size={18} className="shrink-0"/><span>{t('legacy.kb7cd6723ab')}</span></div>
        <p>{t('legacy.k5a75b050f4')} <b>{target?.full_name}</b></p><OptionSelect ariaLabel={t('labels.ke82631313e')} value={role} onChange={value => setRole(value as MemberRole)} options={removableRoles}/>
        {dialogError && <div role="alert" className="app-warning rounded-xl border p-3">{dialogError}</div>}
        <div className="flex justify-end gap-2 app-divider border-t pt-4"><button type="button" className={buttonSecondary} disabled={busy} onClick={closeDialog}>{t('legacy.kc111e0ab9d')}</button><button type="button" className={buttonPrimary} disabled={busy || !target || removableRoles.length === 0} onClick={() => target && void mutate('DELETE', `${base}/${target.membership_id}/roles/${encodeURIComponent(role)}`, undefined, 'Rol retirado.')}>{t('legacy.kb66c1adc2e')}</button></div>
      </div>
    </Modal>
    <Modal open={dialog === 'status'} title={target?.status === 'active' ? 'Suspender membresía' : 'Reactivar membresía'} onClose={closeDialog}>
      <div className="space-y-4 text-sm"><div className="app-warning flex items-start gap-2 rounded-xl border p-3"><AlertTriangle size={18} className="mt-0.5 shrink-0"/><p>{t('legacy.kf38d8997c6')}</p></div>
        <p>{t('legacy.kfe219a52df')} {target?.status === 'active' ? 'suspender' : 'reactivar'} {t('legacy.keb54822be7')} <b>{target?.full_name}</b>?</p>
        {dialogError && <div role="alert" className="app-warning rounded-xl border p-3">{dialogError}</div>}
        <div className="flex justify-end gap-2 app-divider border-t pt-4"><button type="button" className={buttonSecondary} disabled={busy} onClick={closeDialog}>{t('legacy.kc111e0ab9d')}</button><button type="button" className={buttonPrimary} disabled={busy || !target} onClick={() => target && void mutate('PATCH', `${base}/${target.membership_id}/status`, { status: target.status === 'active' ? 'suspended' : 'active' }, 'Estado de membresía actualizado.')}>{t('legacy.k81b4b67ff8')}</button></div>
      </div>
    </Modal>
  </>;
}

function removableRolesFor(member: Member): boolean {
  return member.roles.some(code => ROLES.some(role => role.value === code));
}

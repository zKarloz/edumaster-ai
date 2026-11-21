// Administración global de usuarios: asignación y revocación de administradores.
// Nunca se envían contraseñas ni claves de Supabase desde esta pantalla.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Ellipsis, Info, RefreshCw, ShieldCheck, UserPlus, UserRoundX } from 'lucide-react';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { Modal } from '../../components/shared/Modal';
import { OptionSelect } from '../../components/shared/OptionSelect';
import { Spinner } from '../../components/shared/Spinner';
import { useToast } from '../../components/shared/Toast';
import type { Organization } from '../organizations/types';
import { UserDetailModal } from './UserDetailModal';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ENDPOINT = `${API}/api/v1/admin/institution-admins`;

interface Administrator {
  membership_id: string;
  organization_id: string;
  organization_name: string;
  user_id: string;
  full_name: string;
  email: string;
  status: string;
  granted_at: string;
}

type Dialog = 'assign' | 'revoke' | null;

interface UsersPageProps {
  token: string;
  organizations: Organization[];
  canManage: boolean;
}

const inputClass = 'app-input w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-[#345578] dark:bg-[#112A48] dark:text-white';
const primaryButton = 'app-primary-button inline-flex items-center justify-center gap-2 rounded-xl bg-[#087FE5] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'app-secondary-button inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50';

function errorDetail(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map(item => item?.msg ?? '').filter(Boolean).join('; ') || fallback;
  }
  return fallback;
}

export function UsersPage({ token, organizations, canManage }: UsersPageProps) {
  const { notify } = useToast();
  const [items, setItems] = useState<Administrator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [filterOrg, setFilterOrg] = useState('all');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [detailUser, setDetailUser] = useState<Administrator | null>(null);
  const [dialogOrg, setDialogOrg] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [review, setReview] = useState(false);
  const [target, setTarget] = useState<Administrator | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(ENDPOINT, { headers: { Authorization: `Bearer ${token}` }, signal });
      const json: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorDetail(json, `La API respondió ${response.status}`));
      const payload = json as { items?: Administrator[] };
      if (!signal.aborted) setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo consultar usuarios');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!canManage) { setLoading(false); return; }
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [canManage, load, refresh]);

  const filtered = useMemo(() => items.filter(item => filterOrg === 'all' || item.organization_id === filterOrg), [filterOrg, items]);
  const activeCount = items.filter(item => item.status === 'active').length;
  const assignedOrganizations = new Set(items.filter(item => item.status === 'active').map(item => item.organization_id)).size;
  const activePerOrganization = useMemo(() => items.reduce<Record<string, number>>((acc, item) => {
    if (item.status === 'active') acc[item.organization_id] = (acc[item.organization_id] ?? 0) + 1;
    return acc;
  }, {}), [items]);
  const chosenOrg = organizations.find(item => item.id === dialogOrg);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const columns: Column<Administrator>[] = [
    { header: 'Administrador', key: 'full_name', render: item => <div className="min-w-40"><p className="font-semibold">{item.full_name}</p><p className="app-muted mt-0.5 text-xs break-all">{item.email}</p></div> },
    { header: 'Institución', key: 'organization_name' },
    { header: 'Rol', key: 'user_id', render: () => <span className="inline-flex items-center gap-1.5 text-xs"><ShieldCheck size={15}/> Administrador institucional</span> },
    { header: 'Estado', key: 'status', render: item => <span className={item.status === 'active' ? 'inline-flex rounded-lg bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300' : 'app-muted app-divider inline-flex rounded-lg border px-2 py-1 text-xs'}>{item.status === 'active' ? 'Activo' : item.status}</span> },
    { header: 'Acciones', key: 'membership_id', render: item => <div className="flex items-center gap-2"><button type="button" aria-label={`Ver detalles de ${item.full_name}`} title="Ver detalles del usuario" onClick={() => setDetailUser(item)} className="app-secondary-button inline-flex items-center rounded-lg border p-2"><Ellipsis size={18}/></button><button type="button" disabled={item.status !== 'active' || (activePerOrganization[item.organization_id] ?? 0) <= 1} title={(activePerOrganization[item.organization_id] ?? 0) <= 1 ? 'No se puede revocar al último administrador activo' : 'Revocar rol'}
      onClick={() => { setTarget(item); setDialog('revoke'); setDialogError(''); }}
      className="app-secondary-button inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"><UserRoundX size={15}/> Revocar</button></div> },
  ];

  function openAssign() {
    setDialog('assign'); setDialogError(''); setReview(false); setConfirmed(false);
    setEmail(''); setReason('');
    setDialogOrg(filterOrg !== 'all' ? filterOrg : (organizations[0]?.id ?? ''));
  }

  function closeDialog() {
    if (busy) return;
    setDialog(null); setDialogError(''); setTarget(null); setReview(false);
  }

  async function mutate(url: string, init: RequestInit, success: string) {
    setBusy(true); setDialogError('');
    try {
      let response: Response;
      try { response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) } }); }
      catch { throw new Error('No se pudo conectar con FastAPI. Comprueba el servidor y la configuración de CORS.'); }
      const json: unknown = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(errorDetail(json, `Error HTTP ${response.status}`));
      notify(success, 'success');
      setDialog(null); setTarget(null); setReview(false);
      setRefresh(current => current + 1);
    } catch (cause) {
      setDialogError(cause instanceof Error ? cause.message : 'No se pudo completar la operación');
    } finally { setBusy(false); }
  }

  function submitAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialogOrg || !emailValid || !confirmed) return;
    if (!review) { setReview(true); setDialogError(''); return; }
    void mutate(ENDPOINT, { method: 'POST', body: JSON.stringify({ organization_id: dialogOrg, email: email.trim().toLowerCase(), reason: reason.trim() || null }) }, 'Administrador institucional asignado.');
  }

  if (!canManage) return <section className="app-panel rounded-2xl border p-6"><ShieldCheck size={24}/><h3 className="mt-2 font-semibold">Administración global</h3><p className="app-muted mt-2 text-sm">La gestión global de administradores institucionales requiere rol superadministrador.</p></section>;

  return <>
    <section className="grid gap-4 sm:grid-cols-3">
      {[
        { title: 'Administradores activos', value: activeCount },
        { title: 'Instituciones con administrador', value: assignedOrganizations },
        { title: 'Instituciones registradas', value: organizations.length },
      ].map(card => <div className="app-panel rounded-2xl border p-5" key={card.title}><p className="app-muted text-sm">{card.title}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{card.value}</p></div>)}
    </section>

    <section className="app-panel space-y-4 rounded-2xl border p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-lg font-semibold">Administradores institucionales</h3><p className="app-muted mt-1 text-sm">Cada asignación pertenece a una institución. Una cuenta puede administrar más de una.</p></div>
        <div className="flex gap-2">
          <button type="button" className={secondaryButton} onClick={() => setRefresh(current => current + 1)} title="Actualizar lista"><RefreshCw size={17}/><span className="hidden sm:inline">Actualizar</span></button>
          <button type="button" onClick={openAssign} disabled={!organizations.length} className={primaryButton}><UserPlus size={17}/> Asignar administrador</button>
        </div>
      </div>
      <div className="max-w-sm space-y-1.5"><label className="text-sm font-medium">Filtrar por institución</label><OptionSelect value={filterOrg} onChange={setFilterOrg} ariaLabel="Filtrar administradores por institución" options={[{ value: 'all', label: 'Todas las instituciones' }, ...organizations.map(item => ({ value: item.id, label: item.name, suffix: item.code }))]}/></div>
      {loading && <Spinner label="Cargando administradores institucionales..."/>}
      {error && <div role="alert" className="app-warning rounded-xl border p-4 text-sm">{error}</div>}
      {!loading && !error && <DataTable key={filterOrg} label="Asignaciones institucionales" rows={filtered} columns={columns} pageSize={8}/>}
      {!loading && !error && items.length === 0 && <div className="app-info flex items-start gap-2 rounded-xl border p-4 text-sm"><Info size={18} className="shrink-0"/>Todavía no hay administradores asignados. Crea una cuenta confirmada en Supabase Auth y utiliza «Asignar administrador».</div>}
    </section>

    <UserDetailModal open={Boolean(detailUser)} userId={detailUser?.user_id ?? null} organizationId={detailUser?.organization_id ?? null} token={token} onClose={() => setDetailUser(null)}/>
    <Modal open={dialog === 'assign'} onClose={closeDialog} title="Asignar administrador institucional">
      <form className="space-y-4" onSubmit={submitAssign}>
        <div className="app-info flex items-start gap-2 rounded-xl border p-3 text-sm"><Info size={17} className="mt-0.5 shrink-0"/><p>En esta versión la cuenta debe existir en Supabase Authentication → Users y tener su correo confirmado. Aquí no se crean contraseñas.</p></div>
        <div className="space-y-1.5"><label className="text-sm font-medium">Institución *</label><OptionSelect value={dialogOrg} onChange={value => { setDialogOrg(value); setReview(false); }} ariaLabel="Institución del administrador" placeholder="Seleccionar institución" options={organizations.map(item => ({ value: item.id, label: item.name, suffix: item.code }))}/></div>
        <div className="space-y-1.5"><label htmlFor="institution-admin-email" className="text-sm font-medium">Correo de la cuenta *</label><input id="institution-admin-email" className={inputClass} type="email" maxLength={254} placeholder="administrador@institucion.edu" required value={email} onChange={event => { setEmail(event.target.value); setReview(false); }} autoComplete="email"/></div>
        <div className="space-y-1.5"><span className="text-sm font-medium">Rol que se asignará</span><div className="app-panel flex items-center gap-3 rounded-xl border p-3"><ShieldCheck size={19}/><span className="flex-1 text-sm font-medium">Administrador institucional</span><span className="app-muted text-xs">Rol fijo</span></div></div>
        <div className="space-y-1.5"><label htmlFor="institution-admin-reason" className="text-sm font-medium">Motivo (opcional)</label><textarea id="institution-admin-reason" className={inputClass} rows={2} maxLength={500} placeholder="Ej.: Responsable designado para el período académico" value={reason} onChange={event => { setReason(event.target.value); setReview(false); }}/></div>
        <label className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={event => { setConfirmed(event.target.checked); setReview(false); }} className="mt-1 size-4 accent-sky-600"/><span>Confirmo que esta cuenta estará autorizada a administrar la institución seleccionada.</span></label>
        {review && <div className="app-panel rounded-xl border p-4 text-sm"><p className="mb-2 flex items-center gap-2 font-semibold"><CheckCircle2 size={17}/> Confirmar la asignación</p><p><strong>Institución:</strong> {chosenOrg?.name ?? '—'}</p><p className="mt-1 break-all"><strong>Cuenta:</strong> {email.trim().toLowerCase()}</p><p className="mt-1"><strong>Rol:</strong> Administrador institucional</p><p className="app-muted mt-2 text-xs">La operación se guardará con auditoría. No modifica otras membresías del usuario.</p></div>}
        {dialogError && <div role="alert" className="app-warning rounded-xl border p-3 text-sm">{dialogError}</div>}
        <div className="flex flex-wrap justify-end gap-2 app-divider border-t pt-4"><button type="button" disabled={busy} className={secondaryButton} onClick={closeDialog}>Cancelar</button><button type="submit" disabled={busy || !dialogOrg || !emailValid || !confirmed} className={primaryButton}>{busy ? 'Guardando...' : review ? 'Confirmar asignación' : 'Revisar asignación'}</button></div>
      </form>
    </Modal>

    <Modal open={dialog === 'revoke'} title="Revocar administrador institucional" onClose={closeDialog}>
      <div className="space-y-4 text-sm"><div className="app-warning flex items-start gap-2 rounded-xl border p-4"><AlertTriangle size={19} className="mt-0.5 shrink-0"/><span>Esta operación eliminará el rol de administrador institucional, no la cuenta de Supabase Auth ni sus otros roles.</span></div>
        <p>¿Deseas revocar el rol de <strong>{target?.full_name}</strong> en <strong>{target?.organization_name}</strong>?</p>
        {dialogError && <p role="alert" className="app-warning rounded-xl border p-3">{dialogError}</p>}
        <div className="flex flex-wrap justify-end gap-2 app-divider border-t pt-4"><button type="button" disabled={busy} className={secondaryButton} onClick={closeDialog}>Cancelar</button><button type="button" disabled={busy || !target} onClick={() => target && void mutate(`${ENDPOINT}/${encodeURIComponent(target.membership_id)}`, { method: 'DELETE' }, 'Administrador institucional revocado.')} className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 font-semibold text-white hover:bg-rose-800 disabled:opacity-50"><UserRoundX size={16}/>{busy ? 'Revocando...' : 'Confirmar revocación'}</button></div>
      </div>
    </Modal>
  </>;
}

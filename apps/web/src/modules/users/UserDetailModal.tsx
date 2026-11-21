// Vista compartida de fichas de usuarios. El backend decide el alcance visible.
// No se presentan datos íntimos al administrador sin un fundamento de acceso.
import { useEffect, useState } from 'react';
import { Building2, Globe2, Languages, Mail, ShieldCheck } from 'lucide-react';
import { Modal } from '../../components/shared/Modal';
import { Spinner } from '../../components/shared/Spinner';
import { UserAvatar } from '../../components/shared/UserAvatar';
import { useAvatar } from '../profile/useAvatar';
import { countryName } from '../organizations/types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
interface Detail {
  user_id: string; auth_user_id: string; name: string; email: string;
  organization_name: string; membership_status: string; roles: string[];
  country_code: string | null; language_code: string | null;
}
const NAMES: Record<string, string> = {
  institution_admin: 'Administrador institucional', instructor: 'Docente', student: 'Estudiante',
  coordinator: 'Coordinador', analyst: 'Analista', ml_engineer: 'Ingeniero de ML', auditor: 'Auditor',
};
export function UserDetailModal({ open, userId, organizationId, token, onClose }: {
  open: boolean; userId: string | null; organizationId: string | null; token: string; onClose: () => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setData(null); setError('');
    if (!open || !userId || !organizationId) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    void fetch(`${API}/api/v1/directory/users/${encodeURIComponent(userId)}?organization_id=${encodeURIComponent(organizationId)}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error(response.status === 404 ? 'El usuario no pertenece a la institución o no tienes permisos para consultarlo.' : `No se pudo consultar la ficha (HTTP ${response.status}).`);
      return response.json() as Promise<Detail>;
    }).then(result => { if (!controller.signal.aborted) setData(result); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Error al consultar la ficha'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, userId, organizationId, token]);
  // Los avatares son privados: solo se cargan tras la autorización de FastAPI.
  const avatar = useAvatar(open && data ? data.auth_user_id : null);
  return <Modal open={open} onClose={onClose} title="Detalles del usuario">
    {loading && <div className="flex justify-center py-8"><Spinner label="Cargando ficha del usuario..."/></div>}
    {error && <div role="alert" className="app-warning rounded-xl border p-4 text-sm">{error}</div>}
    {data && !loading && <div className="space-y-5">
      <div className="flex flex-col items-center gap-2 pb-2 text-center">
        <UserAvatar userId={data.auth_user_id} name={data.name} photo={avatar.photo} loading={avatar.loading} large/>
        <h3 className="mt-2 text-lg font-semibold">{data.name}</h3>
        <span className="app-muted text-xs">{data.membership_status === 'active' ? 'Membresía activa' : `Estado: ${data.membership_status}`}</span>
      </div>
      <dl className="app-divider space-y-4 border-t pt-4 text-sm">
        <div className="flex items-start gap-3"><Mail size={17} className="app-muted mt-0.5"/><div><dt className="app-muted text-xs">Correo electrónico</dt><dd className="break-all font-medium">{data.email}</dd></div></div>
        <div className="flex items-start gap-3"><Building2 size={17} className="app-muted mt-0.5"/><div><dt className="app-muted text-xs">Institución</dt><dd className="font-medium">{data.organization_name}</dd></div></div>
        <div className="flex items-start gap-3"><ShieldCheck size={17} className="app-muted mt-0.5"/><div><dt className="app-muted text-xs">Roles</dt><dd className="mt-1 flex flex-wrap gap-2">{data.roles.length ? data.roles.map(role => <span key={role} className="app-secondary-button rounded-lg border px-2 py-1 text-xs">{NAMES[role] ?? role}</span>) : 'Sin rol asignado'}</dd></div></div>
        <div className="flex items-start gap-3"><Globe2 size={17} className="app-muted mt-0.5"/><div><dt className="app-muted text-xs">País</dt><dd>{data.country_code ? countryName(data.country_code) : 'No compartido'}</dd></div></div>
        <div className="flex items-start gap-3"><Languages size={17} className="app-muted mt-0.5"/><div><dt className="app-muted text-xs">Idioma preferido</dt><dd>{data.language_code ?? 'No compartido'}</dd></div></div>
      </dl>
      <p className="app-info rounded-lg border p-3 text-xs">La fecha de nacimiento y el sexo son datos privados. El usuario puede editarlos desde su Perfil, pero no aparecen en el directorio administrativo.</p>
    </div>}
  </Modal>;
}

import type { Section } from '../routes';
import type { InstitutionMembership } from './institutionContext';

/** Política de navegación, no autorización de recursos. FastAPI conserva sus controles.
 * Los roles institucionales nunca se trasladan de una institución a otra.
 * Sin contexto seleccionado aún, se conservan los accesos posibles durante la carga.
 */
export function moduleAccess(globalRoles: readonly string[], memberships: readonly InstitutionMembership[], organizationId: string): Record<Section, boolean> {
  const globalAdmin = globalRoles.includes('superadmin');
  const scoped = organizationId ? memberships.filter(m => m.organization_id === organizationId) : memberships;
  const has = (...roles: string[]) => scoped.some(m => m.roles.some(role => roles.includes(role)));
  const manager = has('institution_admin', 'coordinator');
  const institutionAdmin = has('institution_admin');
  return {
    dashboard: true,
    profile: true,
    settings: true,
    organizations: globalAdmin || memberships.some(m => m.roles.some(role => role === 'institution_admin' || role === 'coordinator')),
    users: globalAdmin || institutionAdmin,
    courses: globalAdmin || has('institution_admin', 'coordinator', 'instructor', 'student'),
    students: manager,
    enrollments: manager,
    activity: manager || has('instructor'),
    intelligence: globalAdmin || institutionAdmin || has('ml_engineer'),
    security: globalAdmin || institutionAdmin,
  };
}

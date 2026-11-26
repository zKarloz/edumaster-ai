import type { InstitutionMembership } from '../../lib/institutionContext';
/** Las vistas son preferencias visuales; nunca conceden permisos. */
export const dashboardRoles = ['superadmin','institution_admin','coordinator','instructor','student','analyst','ml_engineer'] as const;
export type DashboardRole = typeof dashboardRoles[number];
export function availableDashboardRoles(global: readonly string[], memberships: readonly InstitutionMembership[], orgId: string) {
  const local = orgId ? memberships.filter(m=>m.organization_id===orgId).flatMap(m=>m.roles) : [];
  return dashboardRoles.filter(r=>r==='superadmin'?global.includes(r):local.includes(r)||(['analyst','ml_engineer'].includes(r)&&global.includes(r)));
}
/** Un total desconocido no equivale a cero. */
export function knownTotal(values: readonly (number|null|undefined)[]): number|null {
  return values.every(v=>typeof v==='number'&&Number.isFinite(v)) ? values.reduce<number>((sum,v)=>sum+(v??0),0) : null;
}

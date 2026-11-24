/** CAMBIOS 21 v30.2.4 · Contexto institucional de interfaz.
 * Este módulo no autoriza recursos: FastAPI valida cada organización y matrícula.
 */
export interface InstitutionMembership {organization_id:string;roles:string[]}
export function maySelectAcademicInstitution(globalRoles:string[],memberships:InstitutionMembership[]):boolean{
  return globalRoles.includes('superadmin') || memberships.some(m=>m.roles.some(role=>
    role==='institution_admin'||role==='coordinator'));
}
/** El ID guardado es solo una preferencia de UI y debe validarse contra la API. */
export function chooseAcademicInstitution(ids:string[], current:string, stored:string|null, canChoose:boolean):string{
  if(!ids.length)return '';
  if(canChoose && stored && ids.includes(stored))return stored;
  if(current && ids.includes(current))return current;
  return ids[0]!;
}

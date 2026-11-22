/** Rutas públicas y privadas de EduMaster.ai. La API conserva la autoridad RBAC/ABAC. */
export const sectionPaths = {
  dashboard: '/app/inicio', organizations: '/app/instituciones',
  users: '/app/usuarios', courses: '/app/cursos', students: '/app/estudiantes',
  enrollments: '/app/matriculas', activity: '/app/actividad',
  security: '/app/seguridad', settings: '/app/configuracion', profile: '/app/perfil',
} as const;

export type Section = keyof typeof sectionPaths;

/** La ruta de la evidencia identifica institución, oferta y matrícula, sin ambigüedad. */
const activityDetailPattern = /^\/app\/actividad\/organizaciones\/([0-9a-f-]{36})\/ofertas\/([0-9a-f-]{36})\/matriculas\/([0-9a-f-]{36})\/?$/i;

export function activityDetail(path: string) {
  const result = activityDetailPattern.exec(path);
  return result ? { organizationId: result[1]!, offeringId: result[2]!, enrollmentId: result[3]! } : null;
}

export function sectionForPath(path: string): Section | null {
  if (activityDetail(path)) return 'activity';
  return (Object.entries(sectionPaths).find(([, value]) => value === path.replace(/\/$/, ''))?.[0] as Section | undefined) ?? null;
}
export function enrollmentHistoryPath(organizationId: string, offeringId: string, enrollmentId: string): string {
  return `/app/actividad/organizaciones/${organizationId}/ofertas/${offeringId}/matriculas/${enrollmentId}`;
}

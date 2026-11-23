/** URLs estables: los nombres visibles cambian de idioma, las rutas no. */
export const sectionPaths = {
  dashboard: '/inicio', organizations: '/gestion/instituciones', users: '/gestion/usuarios',
  courses: '/academico/cursos', students: '/academico/estudiantes',
  enrollments: '/academico/matriculas', activity: '/academico/actividad',
  security: '/sistema/seguridad', settings: '/sistema/configuracion',
  profile: '/cuenta/perfil',
} as const;
export type Section = keyof typeof sectionPaths;

// Nunca usaremos un identificador de estudiante sin matrícula y oferta.
const newDetail = /^\/academico\/actividad\/organizaciones\/([0-9a-f-]{36})\/ofertas\/([0-9a-f-]{36})\/matriculas\/([0-9a-f-]{36})\/?$/i;
const oldDetail = /^\/app\/actividad\/organizaciones\/([0-9a-f-]{36})\/ofertas\/([0-9a-f-]{36})\/matriculas\/([0-9a-f-]{36})\/?$/i;

/** Rutas profundas enlazables: siempre llevan institución y curso/oferta. */
const offeringWorkspace = /^\/academico\/organizaciones\/([0-9a-f-]{36})\/ofertas\/([0-9a-f-]{36})\/?$/i;
const baseWorkspace = /^\/academico\/organizaciones\/([0-9a-f-]{36})\/cursos\/([0-9a-f-]{36})\/?$/i;
export function courseWorkspaceDetail(path: string) {
  const offering = offeringWorkspace.exec(path);
  if (offering) return {organizationId:offering[1]!, offeringId:offering[2]!, courseId:undefined};
  const course = baseWorkspace.exec(path);
  return course ? {organizationId:course[1]!, offeringId:undefined, courseId:course[2]!} : null;
}
export function courseOfferingPath(organizationId:string, offeringId:string):string {
  return `/academico/organizaciones/${organizationId}/ofertas/${offeringId}`;
}
export function courseBasePath(organizationId:string, courseId:string):string {
  return `/academico/organizaciones/${organizationId}/cursos/${courseId}`;
}
export function activityDetail(path: string) {
  const result = newDetail.exec(path);
  return result ? { organizationId: result[1]!, offeringId: result[2]!, enrollmentId: result[3]! } : null;
}
export function enrollmentHistoryPath(organizationId: string, offeringId: string, enrollmentId: string): string {
  return `${sectionPaths.activity}/organizaciones/${organizationId}/ofertas/${offeringId}/matriculas/${enrollmentId}`;
}
/** Redirige favoritos antiguos, incluso historiales individuales, sin perder parámetros. */
export function legacyRedirect(pathname: string): string | null {
  const path = pathname.replace(/\/$/, '') || '/';
  if (path === '/' || path === '/app') return sectionPaths.dashboard;
  const detail = oldDetail.exec(path);
  if (detail) return enrollmentHistoryPath(detail[1]!, detail[2]!, detail[3]!);
  const alias = Object.entries(sectionPaths).find(([key]) => {
    const old: Record<Section, string> = {
      dashboard: '/app/inicio', organizations: '/app/instituciones', users: '/app/usuarios',
      courses: '/app/cursos', students: '/app/estudiantes', enrollments: '/app/matriculas',
      activity: '/app/actividad', security: '/app/seguridad', settings: '/app/configuracion', profile: '/app/perfil',
    };
    return old[key as Section] === path;
  });
  return alias ? alias[1] : null;
}
export function sectionForPath(path: string): Section | null {
  if (newDetail.test(path)) return 'activity';
  if (offeringWorkspace.test(path) || baseWorkspace.test(path)) return 'courses';
  const clean = path.replace(/\/$/, '') || '/';
  return (Object.entries(sectionPaths).find(([, value]) => value === clean)?.[0] as Section | undefined) ?? null;
}

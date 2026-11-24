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
/** Editor enlazable para una lección concreta: origen explícito evita confundir IDs. */
const offeringLessonEditor = /^\/academico\/organizaciones\/([0-9a-f-]{36})\/ofertas\/([0-9a-f-]{36})\/lecciones\/(base|offering)\/([0-9a-f-]{36})\/editar\/?$/i;
const baseLessonEditor = /^\/academico\/organizaciones\/([0-9a-f-]{36})\/cursos\/([0-9a-f-]{36})\/lecciones\/base\/([0-9a-f-]{36})\/editar\/?$/i;
export type LessonSource = 'base' | 'offering';
export function lessonEditorDetail(path: string) {
  const offering = offeringLessonEditor.exec(path);
  if (offering) return {organizationId:offering[1]!, offeringId:offering[2]!, courseId:undefined, source:offering[3]! as LessonSource, lessonId:offering[4]!};
  const base = baseLessonEditor.exec(path);
  return base ? {organizationId:base[1]!, offeringId:undefined, courseId:base[2]!, source:'base' as const, lessonId:base[3]!} : null;
}
export function lessonEditorPath(organizationId:string, lessonId:string, source:LessonSource, offeringId?:string, courseId?:string):string {
  if (offeringId) return `${courseOfferingPath(organizationId,offeringId)}/lecciones/${source}/${lessonId}/editar`;
  if (source==='base' && courseId) return `${courseBasePath(organizationId,courseId)}/lecciones/base/${lessonId}/editar`;
  throw new Error('El editor necesita el ID del curso o de la oferta');
}

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
  if (offeringWorkspace.test(path) || baseWorkspace.test(path) || offeringLessonEditor.test(path) || baseLessonEditor.test(path)) return 'courses';
  const clean = path.replace(/\/$/, '') || '/';
  return (Object.entries(sectionPaths).find(([, value]) => value === clean)?.[0] as Section | undefined) ?? null;
}

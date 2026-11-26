/** URLs estables: los nombres visibles cambian de idioma, las rutas no. */
export const sectionPaths = {
  dashboard: '/inicio', intelligence: '/inteligencia-artificial/red-neuronal', organizations: '/gestion/instituciones', users: '/gestion/usuarios',
  courses: '/academico/cursos', students: '/academico/estudiantes',
  enrollments: '/academico/matriculas', activity: '/academico/actividad',
  security: '/sistema/seguridad', settings: '/sistema/configuracion',
  profile: '/cuenta/perfil', income: '/gestion/ingresos',
} as const;
export type Section = keyof typeof sectionPaths;

/** Importación CSV en página propia, bajo los permisos del módulo Usuarios. */
export const usersCsvImportPath = (organizationId?: string): string =>
  `${sectionPaths.users}/importar-csv${organizationId ? `?institucion=${encodeURIComponent(organizationId)}` : ''}`;
export const isUsersCsvImportPath = (path: string): boolean =>
  path.replace(/\/$/, '') === `${sectionPaths.users}/importar-csv`;


// Nunca usaremos un identificador de estudiante sin matrícula y oferta.
const newDetail = /^\/academico\/actividad\/organizaciones\/([0-9a-f-]{36})\/ofertas\/([0-9a-f-]{36})\/matriculas\/([0-9a-f-]{36})\/?$/i;
const oldDetail = /^\/app\/actividad\/organizaciones\/([0-9a-f-]{36})\/ofertas\/([0-9a-f-]{36})\/matriculas\/([0-9a-f-]{36})\/?$/i;

/** Rutas profundas enlazables: siempre llevan institución y curso/oferta. */
const offeringWorkspace = /^\/academico\/organizaciones\/([0-9a-f-]{36})\/ofertas\/([0-9a-f-]{36})\/?$/i;
const baseWorkspace = /^\/academico\/organizaciones\/([0-9a-f-]{36})\/cursos\/([0-9a-f-]{36})\/?$/i;
/** Vista única de tarea para estudiantes y docentes; incluye crear borrador. */
const taskPage = /^\/academico\/organizaciones\/([0-9a-f-]{36})\/ofertas\/([0-9a-f-]{36})\/tareas\/([0-9a-f-]{36}|nueva)\/?$/i;
export function courseTaskDetail(path:string){
  const match=taskPage.exec(path);
  return match?{organizationId:match[1]!,offeringId:match[2]!,taskId:match[3]!}:null;
}
export function courseTaskPath(organizationId:string,offeringId:string,taskId:string):string{
  return `${courseOfferingPath(organizationId,offeringId)}/tareas/${taskId}`;
}
export function newCourseTaskPath(organizationId:string,offeringId:string):string{
  return courseTaskPath(organizationId,offeringId,'nueva');
}
/** Lista docente enlazable, acotada a institución/oferta/tarea. */
const taskSubmissions = /^\/academico\/organizaciones\/([0-9a-f-]{36})\/ofertas\/([0-9a-f-]{36})\/tareas\/([0-9a-f-]{36})\/entregas\/?$/i;
/** Historial individual del estudiante, sin identificadores de otras matrículas. */
const myTaskSubmissions = /^\/academico\/organizaciones\/([0-9a-f-]{36})\/ofertas\/([0-9a-f-]{36})\/tareas\/([0-9a-f-]{36})\/mis-entregas\/?$/i;
export function myTaskSubmissionsDetail(path:string){
  const match=myTaskSubmissions.exec(path);
  return match?{organizationId:match[1]!,offeringId:match[2]!,taskId:match[3]!}:null;
}
export function myTaskSubmissionsPath(organizationId:string,offeringId:string,taskId:string):string{
  return `${courseOfferingPath(organizationId,offeringId)}/tareas/${taskId}/mis-entregas`;
}
/** Revisión individual: la URL nunca autoriza el acceso por sí sola. */
const submissionReview = /^\/academico\/organizaciones\/([0-9a-f-]{36})\/ofertas\/([0-9a-f-]{36})\/tareas\/([0-9a-f-]{36})\/entregas\/([0-9a-f-]{36})\/revisar\/?$/i;
export function taskSubmissionsDetail(path:string){
  const match=taskSubmissions.exec(path);
  return match?{organizationId:match[1]!,offeringId:match[2]!,taskId:match[3]!}:null;
}
export function taskSubmissionsPath(organizationId:string,offeringId:string,taskId:string):string{
  return `${courseOfferingPath(organizationId,offeringId)}/tareas/${taskId}/entregas`;
}
export function taskReviewDetail(path:string){
  const match=submissionReview.exec(path);
  return match?{organizationId:match[1]!,offeringId:match[2]!,taskId:match[3]!,submissionId:match[4]!}:null;
}
export function taskReviewPath(organizationId:string,offeringId:string,taskId:string,submissionId:string):string{
  return `${taskSubmissionsPath(organizationId,offeringId,taskId)}/${submissionId}/revisar`;
}
/** Crear una lección en página completa, con unidad y origen explícitos.
 * La URL no evita las verificaciones de autorización de FastAPI. */
const newOfferingLesson = /^\/academico\/organizaciones\/([0-9a-f-]{36})\/ofertas\/([0-9a-f-]{36})\/unidades\/([0-9a-f-]{36})\/lecciones\/(base|offering)\/nueva\/?$/i;
const newBaseLesson = /^\/academico\/organizaciones\/([0-9a-f-]{36})\/cursos\/([0-9a-f-]{36})\/unidades\/([0-9a-f-]{36})\/lecciones\/base\/nueva\/?$/i;
export function newLessonDetail(path: string) {
  const offering = newOfferingLesson.exec(path);
  if (offering) return {organizationId:offering[1]!,offeringId:offering[2]!,courseId:undefined,
    unitId:offering[3]!,source:offering[4]! as LessonSource};
  const base = newBaseLesson.exec(path);
  return base ? {organizationId:base[1]!,offeringId:undefined,courseId:base[2]!,
    unitId:base[3]!,source:'base' as const} : null;
}
export function newLessonPath(organizationId:string,unitId:string,source:LessonSource,offeringId?:string,courseId?:string):string {
  if (offeringId) return `${courseOfferingPath(organizationId,offeringId)}/unidades/${unitId}/lecciones/${source}/nueva`;
  if (source==='base' && courseId) return `${courseBasePath(organizationId,courseId)}/unidades/${unitId}/lecciones/base/nueva`;
  throw new Error('La lección necesita la unidad y el curso o la oferta');
}
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
  if (path === '/app') return sectionPaths.dashboard;
  const detail = oldDetail.exec(path);
  if (detail) return enrollmentHistoryPath(detail[1]!, detail[2]!, detail[3]!);
  const alias = Object.entries(sectionPaths).find(([key]) => {
    const old: Record<Section, string> = {
      dashboard: '/app/inicio', intelligence: '/app/inteligencia-artificial', organizations: '/app/instituciones', users: '/app/usuarios',
      courses: '/app/cursos', students: '/app/estudiantes', enrollments: '/app/matriculas',
      activity: '/app/actividad', security: '/app/seguridad', settings: '/app/configuracion', profile: '/app/perfil', income: '/app/ingresos',
    };
    return old[key as Section] === path;
  });
  return alias ? alias[1] : null;
}
export function sectionForPath(path: string): Section | null {
  if (newDetail.test(path)) return 'activity';
  if (isUsersCsvImportPath(path)) return 'users';
  if (newOfferingLesson.test(path) || newBaseLesson.test(path) || taskPage.test(path) || offeringWorkspace.test(path) || baseWorkspace.test(path) || submissionReview.test(path) || taskSubmissions.test(path) || myTaskSubmissions.test(path) || offeringLessonEditor.test(path) || baseLessonEditor.test(path)) return 'courses';
  const clean = path.replace(/\/$/, '') || '/';
  return (Object.entries(sectionPaths).find(([, value]) => value === clean)?.[0] as Section | undefined) ?? null;
}

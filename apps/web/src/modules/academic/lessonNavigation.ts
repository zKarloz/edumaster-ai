/** Reglas puras del aviso de salida de lecciones.
 * Mantener el bloqueo en el enrutador garantiza cobertura de Atrás/Adelante,
 * enlaces internos y menú lateral, sin depender de eventos de un solo botón.
 */
export interface LessonLocation {
  pathname: string;
  search: string;
  hash: string;
}

export function shouldBlockLessonNavigation(
  hasUnsavedChanges: boolean,
  logoutConfirmed: boolean,
  current: LessonLocation,
  next: LessonLocation,
): boolean {
  if (!hasUnsavedChanges || logoutConfirmed) return false;
  return current.pathname !== next.pathname ||
    current.search !== next.search || current.hash !== next.hash;
}

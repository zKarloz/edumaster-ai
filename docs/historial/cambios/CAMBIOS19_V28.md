# EduMaster.ai — CAMBIOS 19 (v28)

**Base:** entrega v27.1 validada en VSCode (203 pruebas backend, Ruff y build frontend reportados por el usuario).  
**Alcance:** interfaz de Cursos → pestaña Contenido.  
**Supabase:** no requiere migraciones ni cambios de RLS.  
**Autorización:** no se modifican permisos ni rutas de FastAPI.

## Cambios aprobados

1. **Estados de publicación.** El componente `StateBadge`, usado por unidades y lecciones, conserva la terminología y traducciones existentes (`published`, `draft`, `archived`). Utiliza una paleta semántica suave e independiente por tema: Publicado = verde, Borrador = gris, Archivado = amarillo/ámbar. Incluye fondo, borde y texto para mejorar contraste. En Negro conserva la escala general neutra del tema, salvo las señales de estado deliberadamente semánticas.
2. **Creación según rol.** El gestor institucional (administrador institucional o coordinador) ve solo el botón `Nueva unidad institucional`, incluso cuando visita una oferta que puede supervisar. El docente asignado ve solo `Nueva unidad de esta oferta`. El estudiante no ve botones de creación.
3. **Supervisión preservada.** `can_edit_offering` continúa autorizado para gestores en el backend; la interfaz no ofrece el botón de crear unidades de oferta a gestores, pero sí sus acciones de revisión, edición y ordenamiento de materiales existentes. El contenido institucional no es editable por docentes.

## Pruebas de aceptación manual

- En **Claro, Oscuro y Negro**, abrir Cursos → Contenido y verificar etiquetas de estados en unidades y lecciones; los tres estados deben distinguirse claramente. Revisar también la presentación compacta en teléfonos.
- Entrar como **administrador institucional** y **coordinador** en una oferta editable: confirmar que aparece únicamente `Nueva unidad institucional` y que pueden editar unidades docentes ya existentes. Repetir en el espacio del curso base.
- Entrar como **docente asignado**: confirmar que aparece únicamente `Nueva unidad de esta oferta`; las unidades institucionales deben ser de solo lectura y las unidades de su oferta editables.
- Entrar como **estudiante**: no debe aparecer ningún botón de creación y solo debe verse contenido publicado; validar la restricción también en FastAPI.
- Comprobar que los cursos archivados y las ofertas cerradas no habilitan creación de contenido al margen de las reglas existentes.
- Ejecutar `python -m ruff check app tests`, `python -m pytest -q`, `npm run build` y `git diff --check`.

## Archivos modificados

- `apps/web/src/styles.css`: variables de color semántico para los tres temas y clases reutilizables de insignias.
- `apps/web/src/modules/academic/CourseWorkspacePage.tsx`: opciones de creación según `role` y permisos recibidos; se mantienen las funciones de edición y los componentes compartidos.
- `docs/README.md`: vínculo a este registro.
- `docs/historial/cambios/CAMBIOS19_V28.md`: este documento.

## Pendiente (fuera de CAMBIOS 19)

- Definir autores, colaboradores y permisos por docente cuando una oferta tenga varios instructores.
- Editor enriquecido de lecciones, archivos privados y versionado de contenido (plan académico posterior).
- No se ejecutan `git add`, `git commit`, `git push` ni despliegues desde los paquetes.

**Aviso:** los documentos Enterprise establecen roles y autorización en backend; las convenciones específicas de color y la decisión de mostrar un solo botón por rol son decisiones de producto acordadas durante CAMBIOS 19.

# CAMBIOS 21 — v30.2.9: ancho de lecciones y modal compartido

Base requerida: v30.2.8. Hotfix visual: **sin SQL, sin cambios de FastAPI, sin dependencias npm**.

- `LessonEditorPage` y `LessonCreatePage` eliminan su límite local `max-w-7xl` (1280 px) y dejan que el contenedor global `.app-content-container` determine la anchura, igual que `CourseWorkspacePage`. De esta manera «Volver a contenido» y «Volver a cursos» comparten el borde izquierdo.
- `Modal` conserva el portal, el control del foco, Escape, Tab y el comportamiento de hoja móvil, pero deja de mutar `html.style.overflow`/`body.style.overflow` al abrirse. Ese cambio de scroll root podía alterar el posicionamiento del sidebar sticky.
- `ModalBackdrop` ya utiliza `overflow-y-auto overscroll-contain` y `.app-modal-content` tiene el mismo bloqueo de propagación de scroll; se explicita también en los estilos compartidos.
- Se retira la regla condicional `html:has(.app-modal-overlay)` que forzaba alto del sidebar durante los modales y se establece la alineación del sidebar en modo escritorio independientemente del modal.
- Nuevas comprobaciones en `lesson-layout-v30_2_9.test.cjs` y adaptación del test de ancho de v30.2.8.

## Validación obligatoria en VSCode

Desde `apps/web`: `npm run build`, `npm run test:editor`, `npm run test:tasks`.

En el navegador, abrir una lección y comparar la posición del botón «Volver a contenido» con «Volver a cursos» de la pantalla anterior. En los tres temas, abrir/cerrar «Publicar revisión» **desde una página desplazada** y verificar que el sidebar sigue ocupando la altura del viewport y que el fondo no se desplaza ni cambia de ancho. Repetir con el sidebar expandido, contraído y dinámico y con un modal distinto.

Si algún navegador móvil antiguo permite desplazar el fondo bajo el modal, informar del dispositivo y navegador; la solución actual se basa en `overscroll-behavior`, sin bloquear el scroll raíz.

No se modifican datos, Supabase, npm ni Git automáticamente.

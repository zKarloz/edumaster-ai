# CAMBIOS 21 — v30.2.7 · Confirmaciones y lecciones en página

Base obligatoria: v30.2.6 instalada y con archivos compatibles.
No ejecuta SQL ni modifica FastAPI, Storage, Git o dependencias npm.

- Publicar tarea y Cerrar tarea exigen confirmación en Modal compartido, como Suspender usuario.
- Nueva lección abre página enlazable con Tiptap desde el primer momento. Guarda borrador y abre editor para adjuntar recursos.
- Editor de lección dispone de dos pestañas de ancho completo: Editor y recursos / Historial de versiones.
- Sidebar conserva altura fija de viewport al abrir un modal con desenfoque.
- Creación, edición y publicación conservan autorización por FastAPI.
- En caso de fallo tras crear la lección, la página reintenta el guardado sobre el ID ya creado.

Pruebas pendientes en VSCode: `npm run build`, `npm run test:editor`, `npm run test:tasks`; después validar visualmente en los tres temas y móvil.
No hacer commit hasta terminar pruebas funcionales.

# CAMBIOS 20 · v29.1 · Revisión D — Frontend Tiptap

> **NO INSTALAR. NO EJECUTAR LA MIGRACIÓN 009.** Versión de integración de código preparada para revisión y compilación en VSCode.

## Base y decisiones

- Base: EduMaster v28, commit `3895ed3` publicado por el usuario en `main`, más revisiones técnicas A/B/C.
- Conserva ambas clases de lección: `app.lessons` y `app.offering_lessons`.
- Un borrador privado como máximo; estudiantes siguen leyendo la versión publicada de las tablas heredadas.
- El contenido nuevo se serializa como JSON Tiptap validado por FastAPI; sin HTML arbitrario ni subida de archivos en v29.1.
- **La publicación de revisiones Tiptap sigue deshabilitada** hasta el incremento de publicación versionada. El backend conserva la publicación heredada de revisiones *plain-text-v1*; publicar una revisión ya convertida a Tiptap requiere una fase posterior.

## Cambios frontend

- `src/modules/academic/LessonEditorPage.tsx`: página protegida, carga de borrador `GET`, creación sobre lección publicada `POST` tras 404, guardado optimista `PATCH` con `expected_lock_version`, previsualización privada, avisos de guardado, 409 sin sobrescritura y recarga explícita.
- `src/components/shared/RichTextEditor.tsx`: Tiptap 3 de código abierto, componentes de formato reutilizables y modal compartido para enlaces HTTPS; componentes de UI con Tailwind y Lucide.
- `src/modules/academic/lessonDocument.ts`: serialización canónica de nodos, marcas y atributos limitada al contrato FastAPI. No elimina silenciosamente tipos de nodos no admitidos.
- `src/routes.ts`: URLs con UUID y origen `base/offering` explícito. `App.tsx` carga el editor de forma diferida para no penalizar el bundle inicial.
- `CourseWorkspacePage.tsx`: editar una lección vigente abre la nueva página; para lecciones archivadas conserva el formulario heredado que permite gestionar el estado.
- `i18n.ts`: interfaz ES/EN/PT. `styles.css`: tokens compartidos para los temas Claro, Oscuro y Negro, incluyendo barra adaptada a móvil.
- `package.json`: dependencias `@tiptap/core`, `@tiptap/pm`, `@tiptap/react`, `@tiptap/starter-kit` v3.29 o posterior compatible, más `npm run test:editor`.

## Seguridad y limitaciones

- El cliente no consulta directamente la tabla de revisiones. Todos los accesos pasan por FastAPI con JWT, validación institucional y permisos por oferta.
- La autorización real reside en FastAPI: los controles visuales no otorgan privilegios.
- Los enlaces nuevos deben utilizar HTTPS y no pueden llevar credenciales incrustadas. El backend aplica su validador completo.
- Ninguna acción `GET/POST/PATCH` del editor modifica `title`, `content` ni `status` de la proyección que consultan los estudiantes.
- La navegación desde el botón Volver y el menú principal pide confirmación si hay cambios; recargas y cierre de pestaña usan `beforeunload`. **Pendiente:** bloqueo completo del botón Atrás/Adelante del historial SPA y acciones de cierre de sesión cuando hay cambios sin guardar; requiere prueba en navegador antes de autorizar el despliegue.
- La pantalla v29.1 no incluye archivos, evaluaciones, fórmulas, colaboración en tiempo real ni publicación de una revisión nueva.

## Verificación realizada en el entorno de preparación

- Backend: `python -m pytest -q` → **255 passed**.
- Frontend: **8 pruebas unitarias Node** sobre conversión Tiptap y URLs profundas de lecciones.
- TypeScript/TSX: **7 archivos analizados sintácticamente**, sin errores de parsing.
- **No verificado:** `npm run build` (dependencias npm no disponibles aquí), Ruff (no está instalado en el entorno), integración con PostgreSQL, RLS/privilegios reales, navegación y estilos en navegador.
- **No se ejecutó** `009_lesson_revisions.sql`, ni git commit, push o despliegue.

## Comprobaciones previas a una instalación futura

1. Validar esquema migrado y permisos sobre una **copia de prueba** de PostgreSQL utilizando `009_preflight_lectura.sql` y `009_postflight_lectura.sql`.
2. Completar bloqueo de navegación del editor y revisión de coherencia con los formularios heredados.
3. Instalar dependencias en una **copia de desarrollo**, generar y versionar el lockfile y ejecutar `npm run build` y `npm run test:editor`.
4. Ejecutar `python -m ruff check app tests`, `python -m pytest -q` e integración HTTP real de GET/POST/PATCH con roles, 403, 409 y 404.
5. Confirmar que los estudiantes siguen viendo la versión publicada durante todos los guardados del borrador.
6. Preparar instalador idempotente con verificación del contenido local compatible con LF/CRLF, respaldo y orden DB/backend/frontend; sin instalación automática de migraciones SQL.

## Comandos de desarrollo (solo tras aprobación e integración segura)

```bash
# apps/web, después de instalar y verificar las dependencias
npm install
npm run test:editor
npm run build

# apps/api, con .venv activado
python -m ruff check app tests
python -m pytest -q
```

**No apliques estos pasos de despliegue todavía:** falta habilitar la migración en un entorno de prueba y validar la compatibilidad completa.

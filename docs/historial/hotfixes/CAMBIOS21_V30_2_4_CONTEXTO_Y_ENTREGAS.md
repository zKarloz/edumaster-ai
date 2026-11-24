# CAMBIOS 21 · v30.2.4 — Historial del estudiante y contexto institucional

**Base:** v30.2.3 instalada; no requiere nuevo SQL, migraciones, credenciales ni dependencias npm.

## Mis entregas como página

- En una oferta → **Actividades y tareas** → **Mis entregas** abre la ruta:
  `/academico/organizaciones/{organizacion}/ofertas/{oferta}/tareas/{tarea}/mis-entregas`.
- Muestra el título e instrucciones, el historial de intentos, fecha y estado, y un panel de detalle con respuesta, archivos privados y observaciones docentes.
- Permite enlazar a un intento del **propio usuario** mediante `?intento={id}`; la UI solo abre IDs devueltos por el backend en `my-submissions`.
- No reutiliza el endpoint de lista de **todas las entregas** del docente, que requiere permiso editor; FastAPI obtiene la matrícula desde el JWT y la oferta y filtra por `enrollment_id`.
- Regreso a `?tab=tasks`; sin modal para el historial.

## Contexto académico único

- Se retiran las tarjetas/selectores repetidos de institución de **Cursos, Estudiantes, Matrículas y Actividad académica**, y el selector independiente de **Usuarios institucionales**.
- La institución actual se identifica con una línea discreta en el encabezado de los módulos, sin tarjeta duplicada.
- Un superadministrador, administrador institucional o coordinador autorizado puede elegir la institución de trabajo **solo desde Instituciones**, seleccionando la institución en la lista/mapa y pulsando **Usar esta institución**. La preferencia se guarda *por usuario* en el almacenamiento local del navegador y se revalida frente a la lista autorizada al iniciar.
- Estudiantes y docentes no ven un selector de institución ni el módulo Instituciones. El contexto inicial se deriva de la lista institucional autorizada por la API; una ruta profunda a otra oferta autorizada utiliza su institución explícita.
- **Caso excepcional**: si una misma cuenta docente o estudiantil tiene membresías en más de una institución, el catálogo general mostrará la institución inicial autorizada; una URL profunda autorizada sigue siendo accesible. En futuras entregas se podrá definir una política institucional expresa para estas cuentas, sin conceder acceso por preferencia de frontend.
- La selección de interfaz **no es una autorización**. Todos los endpoints mantienen la verificación en FastAPI de institución, oferta, matrícula y rol. Cambiar `localStorage` o los UUID de la URL no otorga nuevos permisos.
- El contexto se reinicia al cambiar de usuario. El módulo Instituciones no se muestra a docentes y estudiantes, aunque prueben entrar mediante una URL directa (la navegación vuelve al inicio).

## Compatibilidad y validación

- Se conservan migraciones 009–012 y los recursos privados de Supabase Storage.
- No hay cambios en los endpoints ni en el esquema PostgreSQL.
- Comprobar los tres temas Claro, Oscuro y Negro, navegación en móvil y escritorio, acceso por ruta directa y recarga, y separación entre estudiantes.
- Ejecutar en `apps/api`: `python -m ruff check app tests` y `python -m pytest -q`.
- Ejecutar en `apps/web`: `npm run build`, `npm run test:editor` y `npm run test:tasks`.
- Sin publicar hasta verificar en Windows el `npm run build` y las pruebas funcionales del navegador.

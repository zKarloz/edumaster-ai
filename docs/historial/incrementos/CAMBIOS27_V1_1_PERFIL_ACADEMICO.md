# CAMBIOS 27 v1.1 — Docente asignado y perfil académico

- Inicio de una oferta: tarjeta del docente activo asignado; estado vacío si no hay asignación. No se muestra en el curso base.
- Comunidad: modal con diseño compartido `UserProfileLayout` del módulo Usuarios, nombre, avatar, institución, curso y rol académico contextual. No usa el directorio administrativo ni devuelve correo, país, idioma o datos íntimos.
- GET `.../community/participants`: sin target devuelve exclusivamente el docente asignado; con target (UUID de autenticación) devuelve un docente asignado o un autor visible y activo de esa oferta. Reutiliza `_context`.
- Migración 018: mantiene bucket privado, extiende la política 017 a docentes asignados en ofertas accesibles. Aplicar tras 017 y antes de desplegar.
- ES/EN/PT, componentes y tokens temáticos existentes. No añade dependencias.

Validación: 146 pruebas Node y 417 pytest aprobadas; sintaxis de cuatro TSX correcta. Pruebas SQL simuladas. Ruff no instalado; build bloqueado por dependencias npm ausentes; migración y navegador pendientes. Verificar fotografías de docentes sin publicaciones, perfiles de estudiantes, rechazo de perfiles fuera de oferta y ausencia de campos privados. El esquema vigente admite un docente por oferta.

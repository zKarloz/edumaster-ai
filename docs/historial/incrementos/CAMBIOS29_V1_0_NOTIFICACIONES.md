# CAMBIOS 29 v1.0 — Bandeja privada de notificaciones

Base: CAMBIOS 28 v1.0. Aplicar la migración 019 antes de habilitar el nuevo frontend/backend. La migración crea `app.notifications` y un trigger transaccional sobre nuevas recomendaciones docentes. No retroalimenta recomendaciones históricas ni crea notificaciones ficticias. El servicio usa la conexión SQL privilegiada existente; no concede acceso directo a anon/authenticated.

- Campana a la izquierda de la cuenta, contador 99+, filtro todas/sin leer, lectura individual y global persistente. Lista hasta 50 registros autorizados, sin leer primero; contador sobre todos los autorizados.
- Se consulta al montar, abrir, recuperar foco/visibilidad y cada 60 segundos en primer plano. Se cancela al desmontar/cambiar token. No usa Realtime ni correo.
- La visibilidad se revalida contra el usuario activo, institución, matrícula, membresía, oferta y curso publicado. No se confía en IDs de destinatario enviados por el navegador.
- Al pulsar un aviso se verifica y marca como leído en FastAPI y se abre la oferta y el modal de la recomendación. El parámetro `focus` mantiene el filtro de autorización existente y prioriza el registro dentro de los 200 resultados.
- Se reutilizan menú animado, tokens de tema, Spinner y Toast. ES/EN/PT. La lectura no completa la recomendación.
- Solo evento `recommendation_created` en v1.0. Tareas, entregas, comunidad, recordatorios y otros roles se integrarán después; los tipos y restricciones SQL se ampliarán con esos incrementos.

## Verificación local

`cd apps/api && python -m ruff check app tests && python -m pytest -q`

`cd apps/web && npm run test:neural && node --test tests/*.test.cjs && npm run build`

Pruebas realizadas en revisión: 426 backend (SQL simulado), 150 frontend (incluidas regresiones estructurales), sintaxis TSX sin diagnósticos. No se verificó PostgreSQL/Supabase real ni navegador; Ruff no instalado; build bloqueado por dependencias npm ausentes.

## Aceptación

Crear una recomendación nueva para un estudiante activo, comprobar campana al iniciar sesión o abrir bandeja, pulsar el aviso, verificar apertura de modal, contador y persistencia al cerrar sesión. Repetir con marcar todas, probar otra cuenta y otra institución, revocar acceso de una cuenta de prueba y verificar que ya no se muestra su aviso. Verificar temas y animación. No se requieren nuevas dependencias ni variables.

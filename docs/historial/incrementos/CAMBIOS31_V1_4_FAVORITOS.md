# CAMBIOS 31 v1.4 — Mis favoritos

Incremento sobre v1.3, compatible con MapTiler y la landing actual. Solo frontend.

- Administrador institucional, coordinador, docente y estudiante: favoritos locales por usuario, institución y rol, máximo 20.
- Estrella en las pestañas de una oferta autorizada, detalle de tarea y listado de entregas (incluido el listado embebido). No se guardan borradores nuevos, URLs arbitrarias ni credenciales.
- Modal compartido para ordenar y eliminar; notificaciones Toast; ES/EN/PT; clases temáticas existentes.
- Para añadir, abrir y verificar un destino se consulta el workspace autorizado; las tareas y entregas reciben verificaciones adicionales. Si FastAPI aplica un rol efectivo diferente al seleccionado, se rechaza el acceso. La selección de vista no concede permisos.
- Los títulos se almacenan localmente como etiquetas y pueden quedar desactualizados; no se sincronizan entre dispositivos. Los favoritos sin acceso se pueden eliminar manualmente. El navegador compartido conserva los datos locales hasta que se borre su almacenamiento.
- No hay migración ni dependencias nuevas. No se incluyen favoritos de cursos base, lecciones individuales ni informes en esta versión.

## Validación
178 pruebas Node aprobadas (4 nuevas), transpilación de archivos TS/TSX sin diagnósticos y TypeScript estricto del módulo de reglas. `npm run build` bloqueado por ausencia de dependencias npm. Pendiente verificación de UI y acceso real con Supabase/FastAPI.

## Instalación
Superponer ZIP sobre raíz. `cd apps/web`, `node --test tests/*.test.cjs`, `npm run build`, `npm run dev`. Probar guardar pestañas, tareas y entregas; reordenar, quitar, recargar, cambiar usuario/institución/rol y verificar revocación de acceso.

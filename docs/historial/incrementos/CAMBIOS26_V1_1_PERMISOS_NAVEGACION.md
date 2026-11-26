# CAMBIOS 26 v1.1 — Visibilidad de módulos

La política `moduleAccess` centraliza la navegación y el guard de interfaz con los roles de `/me`. No reemplaza JWT, permisos de FastAPI, RLS ni autorización por recurso. No hay migraciones ni dependencias nuevas.

- Inicio, Configuración y Perfil: todas las cuentas autorizadas.
- Instituciones: superadmin o administrador/coordinador de alguna institución (permite cambiar contexto).
- Usuarios: superadmin o administrador de la institución seleccionada.
- Cursos: superadmin o administrador/coordinador/docente/estudiante en el contexto.
- Estudiantes y Matrículas: administrador institucional o coordinador del contexto.
- Actividad académica: administrador institucional, coordinador o docente del contexto.
- Red neuronal: superadmin, administrador institucional o ML engineer del contexto; solo superadmin conserva el registro central y diagnóstico académico existentes.
- Seguridad: superadmin o administrador institucional del contexto. Es un panel informativo, no un sistema nuevo de administración de permisos.

Cuando no hay contexto aún, se consideran los roles disponibles mientras se carga el catálogo. Las rutas profundas evalúan la institución explícita de la URL. Los controles de cada recurso siguen en FastAPI. Los grupos vacíos se ocultan; el enlace de Seguridad del Inicio también respeta la política. El perfil sigue accesible desde el topbar. La política de roles técnicos es una decisión de presentación de este incremento: el analista no tiene un módulo especializado implementado.

Pruebas realizadas: 144/144 frontend (10 nuevas), sintaxis TS/TSX y comprobación estricta de tipos del módulo de política. Compilación integral no disponible por falta de dependencias npm; pendiente comprobación visual y funcional por roles reales.

Aplicar sobre CAMBIOS 26 v1.0, ejecutar desde apps/web: `node --test tests/*.test.cjs`, `npm run build`, `npm run dev`. Verificar los perfiles de cada rol, cambiar contexto con una cuenta multirrol, pegar una URL restringida y recargar rutas permitidas. No ejecutar SQL.

# CAMBIOS 23 v31.6.3 — Registro central DEMO y tooltip

## Alcance
- El tooltip SVG conserva su nodo y anima posición (160 ms) y opacidad (120 ms). Respeta el ajuste de animaciones y movimiento reducido. No se instala Recharts.
- Registro central global para superadmin activo: guardar un nuevo candidato, listar (hasta 100), recuperar y archivar. Cada registro tiene UUID y fecha del servidor. No hay aprobación, publicación, promoción ni inferencia sobre datos reales.
- El checkpoint JSONB completo se guarda en PostgreSQL, no en Storage. Se valida tamaño máximo de solicitud (128 KiB), esquema estricto, dimensiones, dataset, ejemplos originales de prueba y baseline conocido. Los números de entrenamiento aportados por el cliente siguen sin verificación independiente. No introducir datos personales en ningún campo.
- Las mutaciones y recuperación se auditan con actor autenticado. RLS y revocaciones siguen el patrón de las migraciones existentes. La conexión FastAPI debe utilizar el rol de servidor autorizado (como las tablas existentes).
- Máximo global de 100 registros incluyendo archivados; archivado no borra ni libera cuota. Listado se consulta al pulsar Actualizar. No se publica ningún modelo a los estudiantes. No modifica IndexedDB ni el entrenamiento.

## Instalación (main)
1. Aplicar ZIP sobre raíz de la v31.6.2. No reemplazar archivos si fueron editados localmente sin revisar diferencias.
2. Verificar que migración 013 está aplicada y respaldar la base de datos. En Supabase SQL Editor ejecutar una sola vez `database/migrations/014_neural_demo_registry.sql`. No ejecutar 001–013 nuevamente. El script es transaccional; no borrar tablas existentes.
3. Backend: desde apps/api, `python -m pytest -q` con entorno de desarrollo existente. Frontend: desde apps/web, `npm run test:neural`, `node --test tests/*.test.cjs`, `npm run build`. Sin dependencias nuevas.
4. Probar localmente con API actualizada y una cuenta superadmin. Entrenar o recuperar checkpoint local, ir a Modelos, registrar, actualizar listado, recuperar tras recarga, comparar pesos/métricas, archivar y verificar que ya no se puede recuperar. Verificar 401 anónimo y 403 autenticado sin rol. Probar tooltip con ratón, teclado, desplazamiento móvil, tres temas y animaciones desactivadas.
5. Revisar `git status --short`, `git add .`, `git diff --cached --name-only`, `git diff --cached --stat`, commit y push a main. Verificar Render antes de probar el registro en Vercel (la API puede tardar en despertar). No se requieren variables nuevas.

## Verificaciones y limitaciones
123 pruebas frontend Node; 377 pruebas API pytest. No se ejecutó SQL en Supabase, ni build real del frontend (dependencias ausentes), ni prueba integrada en navegador. El registro es de candidatos globales DEMO no verificados: la aprobación independiente, permisos por institución, versionado de datasets y reconstrucción de un modelo activo se difieren. No se debe utilizar para decisiones académicas.

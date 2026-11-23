# EduMaster.ai — Hotfix v13.1 (frontend)

Aplicar sobre v13. Extraer el ZIP en la carpeta que contiene `edumaster-ai` y aceptar los reemplazos. No modifica `.env`, SQL, backend ni dependencias.

## Cambios
- `InstitutionalUsersPage.tsx`: elimina el import sin uso `RefreshCw`.
- `UsersPage.tsx`: elimina el import sin uso `Building2`; conserva `RefreshCw`, que sí se usa.
- Ambas vistas: divisores de modales con color de tema (`app-divider`).
- `styles.css`: variables de tema y valores por defecto de `app-panel`, `app-muted`, `app-divider`, `app-input`, `app-secondary-button` y `app-primary-button` en la capa `components`; conserva las variantes explícitas de Tailwind y las reglas del tema Negro. Los avisos semánticos se mantienen.

## Comprobar
Desde `edumaster-ai/apps/web` ejecutar `npm run build` y `npm run dev`. Comparar ambas vistas de Usuarios en Claro, Oscuro y Negro, incluidas tarjetas de resumen, tabla, botones y modales de asignación. No hace falta reiniciar FastAPI ni ejecutar SQL.

## Verificación en el entorno de preparación
Se comprobó la sintaxis de 20 archivos TypeScript/TSX mediante `transpileModule`, la sintaxis CSS con PostCSS y la compilación CSS de prueba con Tailwind 4.1.10 (versión disponible localmente). Chromium comprobó fondos y bordes de elementos de prueba en los tres temas, y que una clase de borde explícita conserva prioridad en Claro/Oscuro. Esto no sustituye la compilación TypeScript completa (`tsc -b`), ni una prueba de los módulos reales. Ambas quedan pendientes en VSCode: este entorno no tiene instaladas las dependencias del proyecto.

# EduMaster.ai — TAREA 11 · Cambios de interfaz (iteración 1)

**Origen:** `TAREA-11-CAMBIOS.txt` facilitado por el Product Owner.
**Alcance:** únicamente el frontend `apps/web`. No modifica los endpoints ni el SQL.

| Solicitud | Implementación |
|---|---|
| Módulo Configuración | Nueva pestaña del menú con `SettingsPage.tsx` |
| Tercer tema Negro | Se agrega tema monocromático gris con tokens CSS `black-theme` |
| Posición de notificaciones | Se permiten cuatro ubicaciones configurables y botón de prueba |
| Movimiento de notificaciones | Animaciones cortas de entrada/salida; respeta `prefers-reduced-motion` |
| Quitar tarjeta Multiinstitución V1 | Eliminada del sidebar; permanece la arquitectura multiinstitución |
| Sidebar plegable | Menú lateral colapsable en escritorio y deslizante en móvil |
| Cierre móvil | Fondo clicable, botón X, tecla Escape y al navegar |
| Evitar salto por scrollbar | `scrollbar-gutter: stable` y scrollbar vertical estable |
| Decoración de scrollbar | Estilos mínimos por tema |
| Transición entre módulos | Animación sutil ascendente de 250 ms |
| Foco de barra de búsqueda | Borde y halo de foco en el contenedor, no en el input |

## Notas técnicas

- Preferencias guardadas en `localStorage` con clave `edumaster_preferences_v1_guest` o una clave específica de usuario autenticado.
- La persistencia es **local al navegador**. No hay aún sincronización entre equipos o dispositivos con Supabase.
- `SettingsProvider` encapsula el estado de temas y ubicación de avisos; `ToastProvider` consume esas preferencias; `SettingsPage` las edita.
- No se agregan bibliotecas ni dependencias externas.
- Los datos institucionales mostrados sin sesión continúan claramente etiquetados DEMO.
- El próximo trabajo prioritario es mapa de instituciones y prototipo de red neuronal, no contemplados en esta iteración visual.

## Lista manual de pruebas en VSCode

1. `cd apps/web && npm install && npm run build && npm run dev`.
2. En Configuración, probar claro, oscuro y negro; recargar y verificar persistencia.
3. Probar las cuatro ubicaciones con «Probar notificación», la entrada y salida animadas.
4. En escritorio, plegar y desplegar sidebar; navegar mediante iconos cuando esté plegado.
5. En pantalla móvil, abrir menú, pulsar fuera, reabrir y cerrar por X y por Escape.
6. Navegar por páginas de distinta longitud y comprobar que el contenido no salta horizontalmente.
7. Buscar una institución, tabular hasta el campo y comprobar el foco sobre la barra completa.
8. Activar `prefers-reduced-motion: reduce` para comprobar que no hay animaciones obligatorias.

## Alcance no cubierto en esta iteración

- Sincronización de preferencias mediante tabla de perfiles y endpoint autenticado.
- Visualización del mapa y entrenamiento neuronal; serán tareas de iteraciones posteriores.

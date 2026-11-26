# CAMBIOS 23 v31.4.1 — Bordes, gráfico y detención anticipada

Base: v31.4. No modifica API, Supabase, dependencias, dataset ni arquitectura 13→8→4→1.

- Paneles, controles y celdas emplean los tokens existentes `--app-panel-border` y `--app-control-border`.
- Detención anticipada configurable (activada por defecto). La mejor época se restaura incluso si se desactiva la detención. El motivo de cierre distingue paciencia y máximo de épocas. Si se reduce el máximo, se ajusta la paciencia.
- Cada mensaje de época actualiza el estado de React de forma síncrona. El worker añade una cesión de 60 ms por época para favorecer la pintura visual. El tiempo informado incluye esa pausa; no es un benchmark puro de cálculo. El navegador puede limitar el refresco en pestañas ocultas.
- El gráfico incluye selección por cursor, toque o foco de teclado, marcador y detalle de ambas pérdidas. La mejor época se marca también durante el entrenamiento.
- Se mantiene el visualizador conceptual separado del modelo experimental; los datos siguen siendo sintéticos.

## Aplicación
Extraer sobre la raíz del proyecto en `main`. Desde `apps/web` ejecutar `npm run test:neural`, `node --test tests/*.test.cjs`, `npm run build` y `npm run dev`. No se requiere instalar dependencias nuevas.

## Aceptación manual
Verificar bordes de paneles y matrices en Claro, Oscuro y Negro; observar curvas durante un entrenamiento; inspeccionar primeras y últimas épocas con cursor y teclado; ejecutar 30 épocas con detención desactivada y comprobar que termina en 30, aunque la mejor época sea anterior; repetir con detención activada; cancelar y reiniciar. Revisar los tres idiomas. Las pruebas estáticas no sustituyen estas verificaciones.

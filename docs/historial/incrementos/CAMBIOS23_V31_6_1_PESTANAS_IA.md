# CAMBIOS 23 — v31.6.1 · Organización del módulo neuronal

## Alcance
- Arquitectura: vista conceptual y entrenada existentes; pestaña inicial.
- Entrenamiento: configuración, ejecución, cancelación, progreso, gráfico e historial paginado colapsado.
- Evaluación: métricas comparadas y matrices de confusión; se retira la tabla redundante.
- Inspección: selector del ejemplo compartido y acordeones para variables, activaciones, pesos y detalles técnicos.
- Modelos: guardar, recuperar y eliminar el checkpoint local existente.

## Decisiones técnicas
El único `LocalTrainingPanel` permanece montado dentro de la página mientras se alternan las pestañas. Conserva el trabajador, configuración, historial y resultado. El ejemplo seleccionado y el resultado del visualizador se comparten desde la página. La arquitectura se desmonta al abandonar su pestaña y deja de animar; no se modifica el entrenamiento ni la persistencia. Se reutilizan los estilos de pestañas del editor de lecciones y los componentes Accordion, DataTable, Spinner, Modal y Toast. No hay nuevas dependencias, rutas, migraciones ni permisos. El almacenamiento sigue siendo DEMO local; no se publica ningún modelo.

## Instalación y aceptación
Aplicar el ZIP en la raíz del repositorio sobre v31.6, en main. En apps/web ejecutar `npm run test:neural`, `node --test tests/*.test.cjs`, `npm run build` y `npm run dev`. Iniciar un entrenamiento y cambiar varias veces de pestaña; confirmar que avanza y conserva el resultado. Verificar ejemplo compartido, recuperación tras F5, matrices, acordeones, teclado (flechas, Inicio y Fin), ES/EN/PT y los tres temas. Salir del módulo debe terminar el trabajador como antes. Confirmar el checkpoint anterior sin reentrenar. No ejecutar npm install si las dependencias v31.6 están instaladas. Tras validar, git add ., revisar git diff --cached --stat y hacer commit/push a main.

## Limitaciones de revisión
Pruebas estructurales y de regresión, más comprobación sintáctica TS/TSX. La compilación completa y la interacción en navegador requieren las dependencias locales y quedan pendientes de validación. No se modifica el registro centralizado de modelos ni el acceso a datos académicos.

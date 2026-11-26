# CAMBIOS 23 — v31.6: checkpoint local DEMO y pulsos secuenciales

Base: v31.5.1. Sin dependencias nuevas, migraciones ni cambios en Render/Supabase.

## Corrección de la animación

El reloj SMIL corresponde al SVG, no a cada nuevo nodo. Las animaciones montadas al avanzar de capa podían haber terminado antes de aparecer. Ahora cada recorrido y su envolvente de opacidad comienzan explícitamente mediante `beginElement()` al montar. La señal aparece y se desvanece durante su recorrido; las conexiones y los nodos tienen transición de opacidad de 260 ms. Cada etapa dura 1840 ms, frente a recorridos de 1400 a 1760 ms. El enfoque de neurona o conexión conserva recorridos en las tres etapas, limitando las conexiones adyacentes al elemento elegido. El color sigue representando el signo del peso. Repetir reinicia la secuencia; pausar y continuar repite la etapa actual. El modo sin animaciones no aplica transiciones ni pulsos. No cambia ninguna inferencia.

## Checkpoint local (primera fase del gobierno de modelos)

El panel del laboratorio permite guardar, recuperar y eliminar un único checkpoint sintético en IndexedDB (base `edumaster-neural-demo`, almacén `checkpoints`, clave `latest`). Guardar sustituye el anterior; eliminar requiere confirmación y no borra el resultado que ya está en memoria. Recuperar restaura el snapshot de inspección, métricas, ejemplos, historial, configuración y el motor utilizado originalmente; no ejecuta un entrenamiento nuevo. Se guardan parámetros Dense, escalador ajustado con train, hash del dataset, fecha y versión del contrato. Los datos se validan estructuralmente antes de guardar o recuperar. No constituye firma, certificación, validación independiente ni registro de producción.

Este almacenamiento pertenece al origen y perfil del navegador; puede estar disponible para otras cuentas que usen ese mismo perfil, por ello solo se admiten datos DEMO de este laboratorio. No se sincroniza entre equipos, no admite datos personales y se puede perder al limpiar el navegador. localhost y Vercel tienen orígenes distintos. El snapshot no restaura un objeto TensorFlow.js activo ni el estado del optimizador; permite inspeccionar las inferencias ya calculadas. Registro remoto, autorización institucional, publicación, carga de un modelo ejecutable para nuevas inferencias y auditoría quedan pendientes.

## Instalación y aceptación

Aplicar ZIP incremental en raíz de proyecto (main). Desde apps/web: `npm run test:neural`, `node --test tests/*.test.cjs`, `npm run build`, `npm run dev`.

1. Entrenar DEMO y elegir Modelo entrenado; revisar las tres etapas y repetir al terminar varias veces. Probar enfoque de entrada, categoría, capa oculta y conexión; comprobar movimiento reducido, pausa y temas.
2. Guardar el modelo y anotar una métrica y un peso. Recargar la página, pulsar Recuperar modelo; comparar valores y gráfico de épocas, seleccionar un ejemplo y reproducir la animación sin entrenamiento. Comprobar cancelación de borrado, eliminación confirmada y recuperación sin registro. Confirmar que el modelo en memoria sigue visible después de borrar el guardado.
3. Probar en Vercel después de push; el guardado local de desarrollo no aparece allí por diferencia de origen.

Verificaciones de esta entrega: 117 pruebas Node (30 neuronales), compilación de tipos de los tres módulos TS puros y transpilación sintáctica TS/TSX de archivos nuevos/modificados. Chromium aislado verificó el recorrido y desvanecimiento SMIL en las tres etapas y al repetir, sin montar React. No se pudo abrir el servidor local en Chromium por restricción del entorno, por lo que la prueba funcional de IndexedDB y la compilación completa con dependencias instaladas quedan pendientes de aceptación local.

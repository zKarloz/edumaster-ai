# CAMBIOS 23 — v31.3: motor neuronal local (DEMO)

## Alcance
TensorFlow.js 4.22.0 en Web Worker de Vite. No cambia FastAPI, Render, Supabase, rutas ni visualizador conceptual v31.2.1. El nuevo panel aparece debajo de la arquitectura conceptual, que sigue siendo ilustrativa. La inferencia y las activaciones del panel sí se calculan por el modelo entrenado, siempre con datos sintéticos.

## Aplicación (Git Bash, desde la raíz del repositorio)
1. Guarda tus cambios locales y crea una rama: `git switch -c cambios23-v31.3`.
2. Descomprime el ZIP de incremento **sobre la raíz**, conservando las rutas y sustituyendo únicamente `NeuralNetworkPage.tsx`. Si ese archivo cambió desde el paquete de revisión, fusiona manualmente la importación y el panel.
3. `cd apps/web`
4. `npm install --save-exact @tensorflow/tfjs@4.22.0` (actualiza package.json y package-lock.json juntos; ambos deben entrar al commit).
5. `npm run test:neural` (Node 22.16+), `node --test tests/*.test.cjs`, `npm run build`, `npm run dev`.
6. Accede a Inteligencia Artificial / Red neuronal, baja al laboratorio, inicia y cancela una ejecución; vuelve a iniciar y verifica que finaliza. Verifica la navegación durante entrenamiento, los tres temas, idiomas y móvil. Prueba también un navegador sin WebGL en worker.
7. Solo después de las comprobaciones, revisa `git diff` y los archivos nuevos, incluye los manifests npm y despliega por el flujo Git/Vercel habitual. No hay migraciones ni despliegue backend requerido.

## Modelo y datos
- Dataset fijo derivado del laboratorio v31.1: 250 matrículas sintéticas, semilla 42, seis meses, 150 train / 50 validation / 50 test. Se omiten todos los identificadores del JSON. Las 13 entradas corresponden a las 10 variables numéricas y las tres columnas one-hot del baseline; no son las seis categorías ilustrativas del visualizador.
- Normalización ajustada exclusivamente con train; MLP 13→8→4→1, ReLU/ReLU/Sigmoid, 153 parámetros (140 pesos + 13 sesgos), Adam 0.01, batch 16, máximo 60 épocas, selección por pérdida de validación, paciencia 8. Test se usa después de restaurar la mejor época. El baseline del mismo dataset está incluido para comparación, no para promoción automática.
- WebGL si inicializa dentro del worker; CPU si no. No se incorpora WASM en esta fase. No se promete reproducibilidad bit a bit entre motores.
- Cancelación y salida del módulo terminan el worker; los modelos son efímeros. No se guardan pesos todavía ni se publican predicciones. Las activaciones corresponden a una fila sintética de test y no representan causalidad.

## Reproducir el dataset
Desde raíz (usar carpeta temporal nueva):
```bash
python tools/ml_demo/generar.py --estudiantes 250 --meses 6 --semilla 42 --salida ../edumaster_v31_3_demo
python tools/ml_demo/exportar_web.py --carpeta ../edumaster_v31_3_demo --salida apps/web/src/modules/intelligence/ml/demoDataset.json
```
El exportador valida el manifiesto mediante el baseline. El JSON empaquetado es deliberadamente sintético y no contiene IDs.

## Validación
106 pruebas Node aprobadas en el entorno de elaboración, incluidas tres nuevas pruebas numéricas. La instalación npm, el build completo y la ejecución TensorFlow.js en navegador quedan pendientes por falta de acceso al registro npm en ese entorno. No considerar listo para producción hasta validar estas tareas. Próximo incremento: métricas gráficas, inspección de pesos, almacenamiento y visualizador dinámico; no incluidos aquí.

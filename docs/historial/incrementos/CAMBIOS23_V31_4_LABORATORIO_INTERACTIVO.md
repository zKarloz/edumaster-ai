# CAMBIOS 23 — v31.4 Laboratorio neuronal interactivo

## Alcance
Extiende v31.3 (TensorFlow.js 4.22.0) sin instalar nuevas dependencias, sin cambios en FastAPI, Supabase ni el visualizador conceptual. Todo se ejecuta localmente con datos SYNTHETIC_DEMO. No es un modelo aprobado para decisiones académicas.

## Uso
- Configurar épocas (1–200), lote (8/16/32/64), tasa de aprendizaje (0.0001–0.05), paciencia (1–épocas), semilla (0–1000000). Los valores originales son 60/16/0.01/8/42. Los controles se bloquean mientras el worker está activo.
- Entrenar o cancelar; el gráfico de pérdida y DataTable compartida muestran las épocas recibidas. La selección del checkpoint usa exclusivamente pérdida de validación. La semilla controla la inicialización, no garantiza identidad numérica entre equipos/backend.
- Al terminar, inspeccionar comparación, matrices de confusión (umbral 0.5), los 50 ejemplos de prueba precalculados, sus variables y activaciones, pesos y sesgos de las capas del checkpoint restaurado. Los pesos se disponen por entrada (fila) y neurona destino (columna).
- La memoria de tensores es una estimación de TensorFlow.js antes de liberar el worker, no el consumo total de GPU/RAM. El tiempo incluye inicialización del motor, entrenamiento y evaluación.
- El modelo vive solo durante el worker; los resultados permanecen en memoria de React hasta iniciar otro entrenamiento o salir. No hay persistencia ni exportación de modelos en este incremento.

## Validación científica
Se conserva el dataset 150/50/50 y el baseline de v31.3. No ajustar hiperparámetros basándose en el conjunto de prueba: usar la pérdida de validación. La comparación de prueba es exploratoria; para una evaluación final tras múltiples experimentos se necesita un conjunto no consultado previamente. No se promete superar la regresión logística.

## Aplicación
Descomprimir sobre la raíz del repositorio v31.3 en main. No reemplaza package.json/package-lock.json. Desde apps/web ejecutar `npm run test:neural`, `node --test tests/*.test.cjs`, `npm run build`, `npm run dev`. Comprobar valores inválidos, cancelación, segundo entrenamiento, gráfica, matriz que suma 50 por modelo, selección del ejemplo 50 y pesos 13×8, 8×4, 4×1. Comprobar temas Claro/Oscuro/Negro e idiomas ES/EN/PT. Si todo es correcto, revisar git status, git add ., git diff --cached --stat, commit y push origin main.

## Verificaciones de entrega
21 pruebas neuronales y 108 pruebas frontend aprobadas en Node 22.16.0. No se dispone de dependencias locales del frontend en el entorno de preparación: compilación completa y prueba de TensorFlow.js en navegador pendientes de validación del usuario.

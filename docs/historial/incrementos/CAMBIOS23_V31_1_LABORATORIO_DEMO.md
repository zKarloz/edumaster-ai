# CAMBIOS 23 · v31.1 — Primer laboratorio de machine learning DEMO

**Base:** CAMBIOS 22 v30.3.1, commit `069ef67` de `main`.

**Alcance:** generación de eventos académicos sintéticos, preparación de variables
longitudinales con fecha de corte, separación cronológica train/validation/test,
verificación de reproducibilidad e integridad y entrenamiento de un baseline
sin dependencias adicionales.

No se añaden endpoints, páginas de interfaz, migraciones ni configuraciones de
Supabase. Este incremento prepara el entorno de prueba de los algoritmos; la
integración visual y la extracción autorizada de datos reales son posteriores.

- `tools/ml_demo/generar.py`: registros y eventos **SYNTHETIC_DEMO**.
- `tools/ml_demo/preparar.py`: variables disponibles en el instante de predicción.
- `tools/ml_demo/validar.py`: checksums, reglas de calidad y ausencia de fuga.
- `tools/ml_demo/baseline.py`: regresión logística y métricas experimentales.
- `tools/ml_demo/tests/`: batería de pruebas sin red ni base de datos.
- `tools/ml_demo/README.md`: parámetros, procedimiento y limitaciones.

**Control de riesgo:** jamás generar cuentas Auth masivas; nunca tocar notas
reales, evitar PII e identificar todas las métricas como no validadas.

**Siguiente decisión académica:** acordar ponderaciones oficiales por curso,
criterios de aprobación y procedimiento de cierre de notas antes de generar el
resultado final institucional. Después podremos construir un adaptador de datos
reales autorizado y compararlo con el pipeline DEMO.

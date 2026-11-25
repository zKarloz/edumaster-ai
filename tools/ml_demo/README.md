# EduMaster.ai · Laboratorio ML DEMO (CAMBIOS 23 · v31.1)

Este laboratorio **solo usa datos ficticios**. No registra cuentas, no manda correos, no
se conecta a Supabase y **no** modifica calificaciones reales. Usa la biblioteca
estándar de Python 3.12; no requiere pandas, PyTorch ni instalar dependencias.

## Ejecutar desde la raíz de `edumaster-ai` en Git Bash

```bash
# Paso 1. Generación: 500 matrículas y seis meses, con semilla reproducible.
python tools/ml_demo/generar.py --estudiantes 500 --meses 6 --semilla 42 --salida ../edumaster_datos_demo

# Paso 2. Verificar checksum, cohortes, fechas, unicidad y ausencia de fuga.
python tools/ml_demo/validar.py --carpeta ../edumaster_datos_demo

# Paso 3. Entrenar una regresión logística de referencia (solo DEMO).
python tools/ml_demo/baseline.py --carpeta ../edumaster_datos_demo

# Paso 4. Pruebas automáticas, totalmente locales.
python -m unittest discover -s tools/ml_demo/tests -v
```

El destino por defecto se sitúa **fuera del repositorio**. Para repetir la
generación sobre los mismos archivos, añadir `--sobrescribir`. Ese parámetro
reemplaza únicamente los archivos del laboratorio en la carpeta indicada y elimina
resultados anteriores del baseline. No utilizar un directorio con datos importantes.

Parámetros: `--estudiantes` entre 50 y 5000, `--meses` 3, 6 o 12,
`--semilla` entero no negativo. Los CSV se generan con UTF-8 y saltos LF.

## Archivos producidos

| Archivo | Contenido | Advertencia |
|---|---|---|
| `matriculas_demo.csv` | ID sintético, curso/cohorte, fechas de corte, fecha de finalización | La finalización es etiqueta, no predictor |
| `eventos_demo.csv` | Asistencia, sesiones, contenido, evaluaciones, entregas, progreso y finalización | Incluye eventos futuros para probar el filtrado |
| `features_demo.csv` | Agregados calculados hasta la fecha de corte y etiqueta `target_completion_30d` | Solo indicadores observables en el corte como entrada del modelo |
| `manifest_demo.json` | Versión, semilla, conteos, SHA-256, política de split temporal | Identifica todo como `SYNTHETIC_DEMO` |
| `baseline_resultados_demo.json` | Métricas, pesos y escalador del baseline | Solo aparece tras ejecutar `baseline.py` |

El comando opcional siguiente **no modifica el dataset versionado**:

```bash
python tools/ml_demo/preparar.py --carpeta ../edumaster_datos_demo
```

Genera `features_recalculadas_demo.csv` para comparar el pipeline.

## Política temporal y de calidad

Las cinco cohortes se ordenan cronológicamente: 1-3 entrenamiento, 4 validación
y 5 prueba. Cada matrícula tiene un **corte 30 días antes de finalizar el curso**.
Las variables se calculan **exclusivamente con eventos anteriores o iguales al
corte**. El objetivo indica si existe finalización en los 30 días posteriores.
La generación hace correlacionar parcialmente la actividad y el resultado
mediante variables sintéticas latentes **y ruido**, sin afirmar validez educativa.

El validador exige esquemas exactos, huellas SHA-256, ausencia de IDs duplicados,
fechas coherentes, particiones por cohorte y recálculo exacto de variables desde
los eventos anteriores al corte. El baseline ajusta la normalización SOLO con
train y selecciona la época SOLO con validation; test queda reservado.

Variables candidatas del documento Enterprise: `active_days_14d`, `sessions_14d`,
`completion_ratio`, `assessment_mean`, `assessment_trend`,
`late_submissions_30d`, `content_engagement`, `skill_evidence_score`,
`days_since_last_activity` y `course_level`. En esta versión DEMO,
`skill_evidence_score` es un *proxy sintético* del promedio de notas: **no** equivale
a dominio por competencia validado mediante rúbricas.

## Seguridad, interpretación y siguiente etapa

- **No son estudiantes ni notas reales.** Los IDs `DEMO-S...` son inventados;
  no hay correos, nombres, contraseñas ni identificadores de Supabase.
- **No registrar estos CSV como evidencias oficiales**, ni copiarlos al esquema `app`.
- No usar las métricas DEMO para clasificar estudiantes ni tomar decisiones reales.
- El baseline es una regresión logística interpretativa; todavía **no** es la red
  neuronal multimodal del plan Enterprise. Primero hay que demostrar el pipeline.
- El cierre de nota final institucional requiere una **política de ponderaciones
  aprobada**. El promedio aritmético de actividades existente no se convierte
  automáticamente en nota final oficial.
- Antes de utilizar información real, deberá construirse un extractor con RBAC,
  autorización institucional, seudonimización, retención y auditoría, y validarse
  la calidad en un entorno separado.

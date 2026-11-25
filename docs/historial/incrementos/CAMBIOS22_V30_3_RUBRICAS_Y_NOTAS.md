# EduMaster.ai · CAMBIOS 22 · v30.3 — rúbricas y calificaciones oficiales

Fecha de implementación: noviembre de 2026. **Base requerida: v30.2.12.**

## Funcionalidades

- **Rúbrica por tarea:** de 1 a 10 criterios, título y descripción, máximo de puntos y orden. La suma de puntos determina la escala de la tarea (hasta 100). Las ponderaciones internas provienen de la proporción de puntos por criterio. La configuración se conserva también en tareas existentes publicadas/cerradas mientras no tengan notas oficiales.
- **Revisión docente independiente:** la revisión textual se mantiene. Una vez revisada la entrega y cerrada la tarea, el docente o gestor autorizado puede asignar puntos a cada criterio; FastAPI calcula la nota. Solo el **último intento revisado** es calificable.
- **Nota oficial única:** una nota por `organización + tarea + matrícula`, integrada de modo atómico con `app.academic_activity_records`, la fuente existente del promedio del módulo de Actividad académica. No se crea una segunda fila en correcciones; se actualiza el mismo registro.
- **Rectificación:** requiere `expected_revision` para evitar sobrescrituras concurrentes. Conserva instantánea de la calificación anterior en `app.task_official_grade_history` y registra el acto en auditoría.
- **Vista estudiante:** solo su propia nota y desglose en la ficha de tarea; otros estudiantes no pueden consultar una matrícula ajena.
- **Tabla docente:** indica la nota oficial vigente de la entrega calificada (no muestra una nota duplicada para intentos antiguos).
- **Diseño compartido:** paneles, `Modal`, `Spinner`, `Toast`, tokens de los temas y `OptionSelect` para el selector de 5/10/20 registros. Este último aumenta ligeramente su altura máxima para reducir barras de scroll al haber espacio.

## Dependencia SQL obligatoria

1. Respalda tu base y consulta el estado de las migraciones 005, 011 y 012.
2. Aplica `database/migrations/013_task_rubrics_and_official_grades.sql` **una sola vez** mediante Supabase SQL Editor. Es una transacción y no convierte notas previas ni elimina registros.
3. Desde `apps/api` ejecuta `python ../../tools/verificacion/verificar_rubricas_v30_3.py` para verificar estructura, RLS y ausencia de duplicados (sin enviar escrituras).
4. Reinicia FastAPI. La web y backend deben utilizar versiones compatibles; **no usar la funcionalidad antes de aplicar 013**.

## Contratos REST (auth Bearer obligatorio)

Prefijo: `/api/v1/academic/organizations/{organization_id}/course-offerings/{offering_id}/tasks/{task_id}`

- `GET /rubric` — rúbrica autorizada; estudiante solo si tarea publicada/cerrada.
- `PUT /rubric` — reemplaza criterios si actor gestor/docente y no existen notas; valida cantidad, máximos y duplicados.
- `GET /my-grade` — estudiante matriculado; no acepta `student_id` del cliente.
- `GET /submissions/{submission_id}/grade` — revisión docente, comprueba oferta/tarea/entrega.
- `PUT /submissions/{submission_id}/grade` — emitir o rectificar nota; exige `closed`, revisión previa, último intento, escala íntegra y versión esperada.

Ejemplo de payload de rúbrica:

```json
{"items":[{"title":"Contenido","description":"Argumentación clara","max_points":"12.00"},{"title":"Presentación","description":"Orden y claridad","max_points":"8.00"}]}
```

Ejemplo de calificación (identificadores UUID reales proporcionados por `GET /rubric`):

```json
{"expected_revision":0,"feedback":"Revisar fuentes bibliográficas.","criteria":[{"criterion_id":"<uuid-criterio-1>","points":"10.00","comment":"Buena argumentación"},{"criterion_id":"<uuid-criterio-2>","points":"8.00","comment":"Excelente presentación"}]}
```

> `expected_revision=0` para emitir por primera vez; para rectificar usar el valor actual recibido por `GET .../grade`. El servidor determina máximos y suma; no acepta totales enviados por el cliente.

## Validación y pruebas

Desde `apps/api`:

```bash
python -m ruff check app tests
python -m pytest -q
python ../../tools/verificacion/verificar_rubricas_v30_3.py
```

Desde `apps/web`:

```bash
npm run build
npm run test:editor
npm run test:tasks
npm run test:users
```

Prueba manual con docente autorizado: crear o abrir tarea, editar y guardar rúbrica, publicar, recibir entrega de estudiante, cerrar, revisar y calificar; comprobar que la nota aparece en Actividad académica. Rectificar, volver a revisar el promedio y verificar `revision=2`. Acceder como estudiante, comprobar desglose propio, y usar una cuenta de otra institución para probar bloqueo de acceso. Hacerlo primero en entorno controlado, no con notas reales.

## Alcance y límites deliberados

- Cada tarea tiene una escala de puntos; **aún no implementa ponderaciones de tareas distintas ni promedios finales de curso**. El promedio existente sigue calculando la media de las evidencias `grade` disponibles. Esto deberá definirse institucionalmente antes de emitir reportes finales.
- Las tareas sin entregas no generan ceros automáticos; se mantiene la política institucional de registros manuales para ausencias.
- No realiza predicciones ni entrenamiento de IA. La nueva relación estructurada tarea–matrícula–rúbrica–nota deja datos trazables para un futuro pipeline.
- Las pruebas automatizadas cubren validación, acceso no autorizado y emisión/rectificación con conexión simulada. La ejecución de 013 y la comprobación real en Supabase siguen siendo pasos del propietario del proyecto.

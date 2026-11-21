# EduMaster.ai v11 — Cursos, estudiantes y matrículas

## Objetivo

Incremento funcional que conecta la interfaz académica con el PostgreSQL ya configurado en Supabase. La arquitectura conserva **una identidad global y múltiples membresías institucionales**, validación de autorización en FastAPI y referencias compuestas entre instituciones.

**No se requiere migración SQL**: se utilizan las tablas existentes del esquema `app`:
`courses`, `course_offerings`, `students`, `users`, `organization_memberships`, `membership_roles`, `roles`, `enrollments` y `audit_logs`.

## Instalación del parche

1. Haz copia de seguridad del proyecto y **no reemplaces** `apps/web/.env` ni `apps/api/.env`.
2. Extrae el ZIP parche **manteniendo la ruta `edumaster-ai/`** y reemplaza los archivos correspondientes. El ZIP del proyecto completo es alternativa, no necesario si estás trabajando en la v10.
3. En Git Bash, desde `edumaster-ai/apps/api` (con `.venv` activado):
   ```bash
   python -m pip install -r requirements-dev.txt
   python -m pytest -q
   python -m uvicorn app.main:app --reload --port 8000
   ```
4. En otra terminal, desde `edumaster-ai/apps/web`:
   ```bash
   npm run build
   npm run dev
   ```
5. Ingresa como `superadmin` y prueba los módulos **Cursos**, **Estudiantes** y **Matrículas**.

No ejecutes otra vez las migraciones `001` ni `002`. No copies contraseñas al frontend ni compartas los `.env`.

## Ejercicio recomendado (datos DEMO)

1. En **Cursos**, selecciona la institución de Lima. Crea `mat-101`, título `Matemáticas — DEMO`, período `2026-II`, estado `Publicado`. Se crea además su oferta académica abierta.
2. **Antes** de incorporar alumnos, crea una cuenta para cada estudiante ficticio de prueba en **Supabase → Authentication → Users → Add user**. Confirma sus correos de forma apropiada (cuentas de prueba bajo tu control; no utilices direcciones de terceros). No reutilices la cuenta superadministradora como estudiante.
3. En **Estudiantes**, selecciona la institución de Lima, incorpora el correo confirmado y asigna un código `ALU-001` si deseas. La API crea/reutiliza `app.users`, crea la membresía activa, asigna el rol institucional `student` y crea el perfil de `app.students`.
4. En **Matrículas**, selecciona la oferta abierta y el estudiante y confirma. La API comprueba que la oferta esté abierta, el curso publicado y que el estudiante esté activo **en la misma institución**.
5. Repite con una institución de México para comprobar el aislamiento: un alumno de Lima **no aparece en el directorio de México** hasta que se vincule explícitamente a esa segunda institución.

> Las cuentas Supabase Auth **no se crean automáticamente desde el formulario de estudiantes**. Por diseño, el formulario vincula cuentas ya existentes y confirmadas. A futuro implementaremos invitaciones administradas sin exponer claves secretas en React.

## Endpoints HTTP

Prefijo: `/api/v1/academic/organizations/{organization_id}`. Todos exigen `Authorization: Bearer <Supabase access_token>`.

| Método | Ruta | Permiso | Resultado |
| --- | --- | --- | --- |
| GET | `/courses` | Miembro activo o superadmin | Cursos publicados; también borradores para gestores |
| POST | `/courses` | Superadmin, institution_admin, coordinator | Curso y oferta inicial transaccionales |
| GET | `/students` | Gestor académico | Directorio nominal del tenant |
| POST | `/students` | Gestor académico | Vincula cuenta Auth confirmada y crea estudiante |
| GET | `/enrollments` | Gestor académico | Matrículas de la institución |
| POST | `/enrollments` | Gestor académico | Inscribe en oferta abierta, comprobando tenant |

Gestores: `superadmin` global, o miembros activos con rol `institution_admin` / `coordinator` de **esa** institución. El docente y el estudiante todavía no pueden editar cursos ni matricular a terceros.

Respuestas: `401` JWT inválido/ausente; `403` sin permisos de gestión; `404` institución no disponible para la identidad; `409` curso, estudiante o matrícula duplicados; `422` entrada inválida / cuenta Auth no confirmada / oferta cerrada; `503` falla SQL controlada. Las operaciones de creación tienen auditoría en la misma transacción.

## Verificaciones SQL opcionales (SOLO LECTURA)

```sql
SELECT o.code AS institucion, c.code AS curso, c.title, co.period, co.status AS oferta
FROM app.courses c
JOIN app.organizations o ON o.id=c.organization_id
LEFT JOIN app.course_offerings co ON co.course_id=c.id AND co.organization_id=c.organization_id
ORDER BY o.code,c.code;
```

```sql
SELECT o.code AS institucion, u.email_normalized AS estudiante, s.external_code
FROM app.students s
JOIN app.organizations o ON o.id=s.organization_id
JOIN app.organization_memberships m ON m.id=s.membership_id AND m.organization_id=s.organization_id
JOIN app.users u ON u.id=m.user_id
ORDER BY o.code,u.email_normalized;
```

```sql
SELECT o.code AS institucion, c.code AS curso, u.email_normalized AS estudiante, e.status
FROM app.enrollments e
JOIN app.organizations o ON o.id=e.organization_id
JOIN app.course_offerings co ON co.id=e.offering_id AND co.organization_id=e.organization_id
JOIN app.courses c ON c.id=co.course_id AND c.organization_id=e.organization_id
JOIN app.students s ON s.id=e.student_id AND s.organization_id=e.organization_id
JOIN app.organization_memberships m ON m.id=s.membership_id AND m.organization_id=e.organization_id
JOIN app.users u ON u.id=m.user_id
ORDER BY o.code,c.code,u.email_normalized;
```

## Alcance y restricciones del incremento

- Real: alta y listado de cursos, perfil estudiantil vinculado a Auth, matrícula y comprobación de permisos en FastAPI, auditoría transaccional.
- Aún no implementado: creación de cuentas de Auth desde la aplicación, alta de docentes, asignación de docentes a ofertas, edición/archivo de cursos, bajas de matrícula, evaluaciones y actividades, notas y progreso real, red neuronal, comunicación profesor–estudiante.
- La base de datos tiene RLS habilitado y forzado, pero el **backend conecta mediante credenciales privilegiadas**. El aislamiento efectivo de esta versión depende de las verificaciones FastAPI, restricciones de claves foráneas y pruebas. Antes de producción deberá auditarse toda la autorización de cada endpoint, políticas de base de datos y consentimientos.
- La futura IA únicamente aportará indicadores. **Nunca entregará recomendaciones personales al estudiante sin revisión y aprobación docente**, como fue acordado.

## Estado de pruebas

En el entorno de preparación se ejecutaron `python -m pytest -q` con 30 pruebas correctas; la revisión de sintaxis TS/TSX no arrojó errores. La compilación `npm run build` y la conexión de extremo a extremo con **tu** Supabase se realizan en tu VSCode. No confundir la prueba con dobles de base de datos con una prueba de integración real.

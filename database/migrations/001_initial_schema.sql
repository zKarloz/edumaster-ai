-- EduMaster.ai | Sprint 0 -> Sprint 1 | 2026-11-19
-- ADR-001 multiinstitución, ADR-016 identidad global, ADR-017 FKs compuestas.
-- Ejecutar UNA vez en Supabase SQL Editor, en una base nueva, con cuenta administradora.
-- Seguridad: las tablas están en app, NO en public; nunca exponer este esquema
-- por Data API sin auditar GRANTs, políticas RLS y superficies de acceso.
-- La API debe validar JWT, membresía, permisos y relaciones de propiedad.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;

CREATE OR REPLACE FUNCTION app.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

-- Identidad global de producto. auth.users es la fuente de identidad de Supabase.
CREATE TABLE app.organizations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 code TEXT NOT NULL CHECK (code ~ '^[a-z0-9][a-z0-9_-]{2,39}$'),
 name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 3 AND 180),
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
 timezone TEXT NOT NULL DEFAULT 'America/Lima',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX organizations_code_uniq ON app.organizations (lower(code));

CREATE TABLE app.users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
 email_normalized TEXT NOT NULL CHECK (email_normalized = lower(btrim(email_normalized))),
 full_name TEXT NOT NULL CHECK (length(btrim(full_name)) > 0),
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','disabled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_unique ON app.users (email_normalized);

CREATE TABLE app.organization_memberships (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE RESTRICT,
 user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
 status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','suspended','revoked')),
 joined_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (organization_id,user_id),
 UNIQUE (organization_id,id)
);
CREATE INDEX memberships_user_status_idx ON app.organization_memberships (user_id,status);

CREATE TABLE app.roles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 scope TEXT NOT NULL CHECK (scope IN ('global','organization')),
 code TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE app.permissions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 resource TEXT NOT NULL,
 action TEXT NOT NULL,
 description TEXT,
 UNIQUE (resource,action)
);
CREATE TABLE app.role_permissions (
 role_id UUID NOT NULL REFERENCES app.roles(id) ON DELETE CASCADE,
 permission_id UUID NOT NULL REFERENCES app.permissions(id) ON DELETE CASCADE,
 PRIMARY KEY (role_id,permission_id)
);
CREATE TABLE app.membership_roles (
 membership_id UUID NOT NULL REFERENCES app.organization_memberships(id) ON DELETE CASCADE,
 role_id UUID NOT NULL REFERENCES app.roles(id) ON DELETE RESTRICT,
 granted_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
 granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY (membership_id,role_id)
);
CREATE TABLE app.global_role_assignments (
 user_id UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
 role_id UUID NOT NULL REFERENCES app.roles(id) ON DELETE RESTRICT,
 granted_by UUID REFERENCES app.users(id) ON DELETE SET NULL,
 granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,role_id)
);

-- Rechazar asignaciones de rol en un ámbito incorrecto incluso si hay un bug en API.
CREATE OR REPLACE FUNCTION app.assert_role_scope()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE actual_scope TEXT;
BEGIN
 SELECT scope INTO actual_scope FROM app.roles WHERE id = NEW.role_id;
 IF TG_TABLE_NAME = 'membership_roles' AND actual_scope IS DISTINCT FROM 'organization' THEN
   RAISE EXCEPTION 'El rol debe ser institucional';
 END IF;
 IF TG_TABLE_NAME = 'global_role_assignments' AND actual_scope IS DISTINCT FROM 'global' THEN
   RAISE EXCEPTION 'El rol debe ser global';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER membership_role_scope BEFORE INSERT OR UPDATE ON app.membership_roles
 FOR EACH ROW EXECUTE FUNCTION app.assert_role_scope();
CREATE TRIGGER global_role_scope BEFORE INSERT OR UPDATE ON app.global_role_assignments
 FOR EACH ROW EXECUTE FUNCTION app.assert_role_scope();

-- Perfiles académicos asociados a UNA membresía institucional válida.
CREATE TABLE app.students (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL,
 membership_id UUID NOT NULL,
 external_code TEXT,
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','graduated')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (organization_id,id),
 UNIQUE (organization_id,membership_id),
 FOREIGN KEY (organization_id,membership_id)
   REFERENCES app.organization_memberships(organization_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX students_code_uniq ON app.students (organization_id,external_code)
 WHERE external_code IS NOT NULL;
CREATE TABLE app.instructors (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL,
 membership_id UUID NOT NULL,
 staff_code TEXT,
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (organization_id,id),
 UNIQUE (organization_id,membership_id),
 FOREIGN KEY (organization_id,membership_id)
   REFERENCES app.organization_memberships(organization_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX instructors_code_uniq ON app.instructors (organization_id,staff_code)
 WHERE staff_code IS NOT NULL;

-- Core académico y sus relaciones interinstitucionalmente seguras.
CREATE TABLE app.cohorts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE RESTRICT,
 code TEXT NOT NULL,
 name TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (organization_id,id),
 UNIQUE (organization_id,code)
);
CREATE TABLE app.courses (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE RESTRICT,
 code TEXT NOT NULL,
 title TEXT NOT NULL,
 description TEXT,
 level TEXT,
 status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (organization_id,id),
 UNIQUE (organization_id,code)
);
CREATE INDEX courses_lookup_idx ON app.courses (organization_id,status,created_at DESC);
CREATE TABLE app.course_modules (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL,
 course_id UUID NOT NULL,
 title TEXT NOT NULL,
 position INT NOT NULL CHECK (position > 0),
 status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
 UNIQUE (organization_id,id),
 UNIQUE (organization_id,course_id,position),
 FOREIGN KEY (organization_id,course_id) REFERENCES app.courses(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE app.lessons (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL,
 module_id UUID NOT NULL,
 title TEXT NOT NULL,
 content TEXT,
 position INT NOT NULL CHECK (position > 0),
 status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
 UNIQUE (organization_id,id),
 UNIQUE (organization_id,module_id,position),
 FOREIGN KEY (organization_id,module_id)
    REFERENCES app.course_modules(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE app.course_offerings (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL,
 course_id UUID NOT NULL,
 instructor_id UUID,
 cohort_id UUID,
 period TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','open','closed','cancelled')),
 start_date DATE,
 end_date DATE,
 CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (organization_id,id),
 FOREIGN KEY (organization_id,course_id) REFERENCES app.courses(organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (organization_id,instructor_id) REFERENCES app.instructors(organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (organization_id,cohort_id) REFERENCES app.cohorts(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX offerings_course_period_idx ON app.course_offerings (organization_id,course_id,period);
CREATE TABLE app.enrollments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL,
 offering_id UUID NOT NULL,
 student_id UUID NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','withdrawn')),
 enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (organization_id,id),
 UNIQUE (organization_id,offering_id,student_id),
 FOREIGN KEY (organization_id,offering_id) REFERENCES app.course_offerings(organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (organization_id,student_id) REFERENCES app.students(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX enrollments_student_idx ON app.enrollments (organization_id,student_id,status);
CREATE TABLE app.assessments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL,
 course_id UUID NOT NULL,
 title TEXT NOT NULL,
 type TEXT NOT NULL CHECK (type IN ('choice','true_false','short_answer','file','practice')),
 max_score NUMERIC(8,2) NOT NULL DEFAULT 20 CHECK (max_score > 0),
 due_at TIMESTAMPTZ,
 status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (organization_id,id),
 FOREIGN KEY (organization_id,course_id) REFERENCES app.courses(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE app.assessment_attempts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL,
 assessment_id UUID NOT NULL,
 student_id UUID NOT NULL,
 attempt_number INT NOT NULL CHECK (attempt_number > 0),
 submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 score NUMERIC(8,2) CHECK (score IS NULL OR score >= 0),
 feedback TEXT,
 UNIQUE (organization_id,id),
 UNIQUE (organization_id,assessment_id,student_id,attempt_number),
 FOREIGN KEY (organization_id,assessment_id) REFERENCES app.assessments(organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (organization_id,student_id) REFERENCES app.students(organization_id,id) ON DELETE RESTRICT
);
-- La validación score <= max_score y la matrícula activa se comprueban en dominio/API.

-- Eventos inmutables de aprendizaje, snapshots agregados y Outbox transaccional.
CREATE TABLE app.learning_events (
 event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE RESTRICT,
 student_id UUID,
 course_id UUID,
 actor_id UUID REFERENCES app.users(id) ON DELETE SET NULL,
 event_type TEXT NOT NULL,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 schema_version INT NOT NULL DEFAULT 1 CHECK (schema_version > 0),
 correlation_id UUID,
 payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
 UNIQUE (organization_id,event_id),
 FOREIGN KEY (organization_id,student_id) REFERENCES app.students(organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (organization_id,course_id) REFERENCES app.courses(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX learning_events_tenant_time_idx ON app.learning_events (organization_id,occurred_at DESC);
CREATE INDEX learning_events_student_time_idx ON app.learning_events (organization_id,student_id,occurred_at DESC);
CREATE TABLE app.progress_snapshots (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL,
 student_id UUID NOT NULL,
 offering_id UUID NOT NULL,
 completion_ratio NUMERIC(6,5) NOT NULL DEFAULT 0 CHECK (completion_ratio BETWEEN 0 AND 1),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (organization_id,id),
 UNIQUE (organization_id,student_id,offering_id),
 FOREIGN KEY (organization_id,student_id) REFERENCES app.students(organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (organization_id,offering_id) REFERENCES app.course_offerings(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE app.outbox_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE RESTRICT,
 aggregate_type TEXT NOT NULL,
 aggregate_id UUID NOT NULL,
 event_type TEXT NOT NULL,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 correlation_id UUID,
 schema_version INT NOT NULL DEFAULT 1 CHECK (schema_version > 0),
 payload JSONB NOT NULL DEFAULT '{}'::jsonb,
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','failed')),
 attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
 published_at TIMESTAMPTZ
);
CREATE INDEX outbox_pending_idx ON app.outbox_events (status,occurred_at) WHERE status='pending';
CREATE TABLE app.audit_logs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID REFERENCES app.organizations(id) ON DELETE RESTRICT,
 actor_id UUID REFERENCES app.users(id) ON DELETE SET NULL,
 action TEXT NOT NULL,
 resource TEXT NOT NULL,
 resource_id UUID,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 correlation_id UUID,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_tenant_time_idx ON app.audit_logs (organization_id,occurred_at DESC);

-- Extensiones académicas mínimas para evitar rediseño del núcleo.
CREATE TABLE app.skills (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE RESTRICT,
 code TEXT NOT NULL,
 name TEXT NOT NULL,
 parent_skill_id UUID,
 UNIQUE (organization_id,id),
 UNIQUE (organization_id,code),
 FOREIGN KEY (organization_id,parent_skill_id) REFERENCES app.skills(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE app.course_skills (
 organization_id UUID NOT NULL,
 course_id UUID NOT NULL,
 skill_id UUID NOT NULL,
 weight NUMERIC(6,5) NOT NULL DEFAULT 1 CHECK (weight BETWEEN 0 AND 1),
 PRIMARY KEY (organization_id,course_id,skill_id),
 FOREIGN KEY (organization_id,course_id) REFERENCES app.courses(organization_id,id) ON DELETE CASCADE,
 FOREIGN KEY (organization_id,skill_id) REFERENCES app.skills(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE app.skill_evidence (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL,
 student_id UUID NOT NULL,
 skill_id UUID NOT NULL,
 source_type TEXT NOT NULL,
 score NUMERIC(6,5) CHECK (score BETWEEN 0 AND 1),
 observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (organization_id,id),
 FOREIGN KEY (organization_id,student_id) REFERENCES app.students(organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (organization_id,skill_id) REFERENCES app.skills(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE app.learning_paths (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE RESTRICT,
 title TEXT NOT NULL,
 objective TEXT,
 version INT NOT NULL DEFAULT 1 CHECK (version > 0),
 status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
 UNIQUE (organization_id,id)
);
CREATE TABLE app.path_steps (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL,
 path_id UUID NOT NULL,
 course_id UUID NOT NULL,
 position INT NOT NULL CHECK (position > 0),
 UNIQUE (organization_id,path_id,position),
 FOREIGN KEY (organization_id,path_id) REFERENCES app.learning_paths(organization_id,id) ON DELETE CASCADE,
 FOREIGN KEY (organization_id,course_id) REFERENCES app.courses(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE app.path_assignments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL,
 path_id UUID NOT NULL,
 student_id UUID NOT NULL,
 assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (organization_id,path_id,student_id),
 FOREIGN KEY (organization_id,path_id) REFERENCES app.learning_paths(organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (organization_id,student_id) REFERENCES app.students(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE app.certificates (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL,
 student_id UUID NOT NULL,
 offering_id UUID NOT NULL,
 verification_code TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','issued','revoked','expired')),
 issued_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (organization_id,id),
 FOREIGN KEY (organization_id,student_id) REFERENCES app.students(organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY (organization_id,offering_id) REFERENCES app.course_offerings(organization_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX one_issued_certificate_per_achievement
 ON app.certificates (organization_id,student_id,offering_id) WHERE state = 'issued';

-- Actualización automática de campos de modificación.
CREATE TRIGGER organizations_touch BEFORE UPDATE ON app.organizations
 FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER users_touch BEFORE UPDATE ON app.users
 FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER memberships_touch BEFORE UPDATE ON app.organization_memberships
 FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER courses_touch BEFORE UPDATE ON app.courses
 FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- RBAC: catálogos iniciales; aún no se asignan privilegios a ningún usuario.
INSERT INTO app.roles(scope,code,name) VALUES
 ('global','superadmin','Superadministrador'),
 ('organization','institution_admin','Administrador institucional'),
 ('organization','coordinator','Director o coordinador'),
 ('organization','instructor','Docente o instructor'),
 ('organization','student','Estudiante'),
 ('organization','analyst','Analista de datos'),
 ('organization','ml_engineer','Científico de datos / ML Engineer'),
 ('organization','auditor','Auditor');
INSERT INTO app.permissions(resource,action,description) VALUES
 ('organizations','manage','Administrar institución y configuración'),
 ('memberships','manage','Administrar miembros y roles institucionales'),
 ('courses','read','Consultar cursos según reglas ABAC'),
 ('courses','create','Crear cursos institucionales'),
 ('courses','update','Actualizar cursos autorizados'),
 ('enrollments','manage','Gestionar matrículas'),
 ('assessments','manage','Gestionar evaluaciones y rúbricas'),
 ('progress','read','Consultar progreso autorizado'),
 ('analytics','read','Consultar analítica por ámbito'),
 ('datasets','prepare','Preparar datos aprobados y seudonimizados'),
 ('models','train','Entrenar y evaluar modelos autorizados'),
 ('audit','read','Consultar auditoría autorizada');

-- Por seguridad: RLS activado SIN políticas de lectura/escritura para clientes.
-- La aplicación usa solo FastAPI para datos; Supabase Auth NO implica acceso a app.*.
-- Nunca usar postgres/service_role como prueba de RLS: esas credenciales pueden ignorarlo.
DO $$
DECLARE table_name TEXT;
BEGIN
 FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname = 'app' LOOP
   EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', table_name);
   EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', table_name);
 END LOOP;
END $$;
-- Sólo en Supabase: estas funciones de base no se publican en su Data API.
-- Revocar acceso de los roles de PostgREST si existen.
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
   REVOKE ALL ON SCHEMA app FROM anon;
   REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
   REVOKE ALL ON SCHEMA app FROM authenticated;
   REVOKE ALL ON ALL TABLES IN SCHEMA app FROM authenticated;
 END IF;
END $$;
COMMIT;

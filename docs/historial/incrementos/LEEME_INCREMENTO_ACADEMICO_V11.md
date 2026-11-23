# EduMaster.ai — Parche v11

Este parche se aplica sobre la **v10** y habilita Cursos, Estudiantes y Matrículas.

- **No incluye archivos `.env` ni credenciales.**
- **No requiere ejecutar SQL**: aprovecha las tablas de `001_initial_schema.sql`.
- Respeta el mapa de instituciones, los temas, los modales y las preferencias existentes.
- Conserva el modelo multiinstitución y la aprobación docente previa a las recomendaciones de IA (módulo IA pendiente).

**Instalación**: descomprime el ZIP en la carpeta que contiene `edumaster-ai`, reemplazando los archivos indicados. Reinicia backend/frontend y ejecuta las pruebas.

```bash
# apps/api (Git Bash)
source .venv/Scripts/activate
python -m pytest -q
python -m uvicorn app.main:app --reload --port 8000

# apps/web (otra terminal)
npm run build
npm run dev
```

**Flujo recomendado**:
1. Accede como superadministrador.
2. Selecciona Lima y crea un curso `mat-101`, período `2026-II` y estado publicado.
3. Crea una cuenta Auth *confirmada* para un estudiante DEMO en Supabase → Authentication → Users.
4. Abre **Estudiantes** y vincula su correo a Lima.
5. Abre **Matrículas**, elige la oferta de curso y el estudiante.
6. Verifica que los datos aparezcan solo en la institución correspondiente.

**Limitación conocida**: las cuentas Auth de estudiantes se crean **manualmente** en el panel de Supabase; no hay todavía creación/invitación automática desde el frontend. La conexión completa contra tu Supabase y `npm run build` están pendientes de verificación local. Las pruebas incluidas usan un backend simulado.

Consulta [docs/INCREMENTO_ACADEMICO_V11.md](INCREMENTO_ACADEMICO_V11.md) para endpoints, controles de seguridad y consultas SQL de verificación.

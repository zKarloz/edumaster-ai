# Arquitectura inicial · Vista rápida

```mermaid
flowchart TD
    U[Usuario navegador] --> W[React + TypeScript en Vercel]
    W -->|Supabase Auth login| A[Supabase Auth]
    W -->|Bearer JWT| B[FastAPI en Render]
    B -->|JWT JWKS público| A
    B -->|Backend verifica membresía y scope| P[(Postgres Supabase: schema app)]
    P -->|Tablas con organization_id + FK compuestas| P
```

**Seguridad:** la conexión privilegiada del backend a Postgres no se confunde
con una garantía RLS. FastAPI comprueba sujeto, membresía y derechos antes de
consultar o mutar datos. Las reglas de permisos granulares y un rol runtime
restringido se completan en Sprint 1.

**Costo:** el entrenamiento PyTorch, MLflow, Redis, colas y tareas intensivas
quedan fuera de Render Free en esta etapa. La arquitectura de los PDF los prevé,
pero se integrarán cuando exista capacidad computacional y datos autorizados.

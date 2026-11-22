"""Punto de entrada de FastAPI para EduMaster.ai."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers.academic import router as academic_router
from app.routers.institutional_users import router as institutional_users_router
from app.routers.organizations import router as organizations_router
from app.routers.profile import router as profile_router
from app.routers.profile_details import router as profile_details_router
from app.routers.user_administration import router as user_administration_router

settings = get_settings()
app = FastAPI(title="EduMaster.ai API", version="0.1.0", docs_url="/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_credentials=False,  # Tokens en Authorization; no se usan cookies entre dominios.
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(organizations_router)
app.include_router(academic_router)
app.include_router(user_administration_router)
app.include_router(institutional_users_router)
app.include_router(profile_router)
app.include_router(profile_details_router)


@app.get("/health", tags=["system"])
def health() -> dict:
    """Disponibilidad del proceso; no expone credenciales ni consulta datos."""
    return {"status": "ok", "service": "edumaster-api", "version": "0.1.0"}


@app.get("/api/v1/status", tags=["system"])
def system_status() -> dict:
    """Estado para la interfaz de desarrollo (no representa KPIs reales)."""
    return {"api": "online", "mode": "development", "academic_data": "not_configured"}

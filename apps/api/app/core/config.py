"""Configuración de API; solo variables de entorno, nunca secretos versionados."""

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Permite abrir el repositorio desde VSCode sin configurar la shell global.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "")
    supabase_url: str = os.getenv("SUPABASE_URL", "").rstrip("/")
    # Solo backend: clave privada de Storage, nunca enviar al navegador.
    supabase_secret_key: str = os.getenv("SUPABASE_SECRET_KEY", "") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    allowed_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    )


@lru_cache

def get_settings() -> Settings:
    """Centraliza la configuración para facilitar pruebas e inyección."""
    return Settings()

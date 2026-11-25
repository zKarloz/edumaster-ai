"""Validación de CSV y comunicación privada con Supabase Auth Admin.

Nunca se admiten claves del navegador ni se escriben contraseñas o enlaces de
acceso en logs. Solo se envían invitaciones a través del backend autenticado.
"""

import csv
import io
import re
from uuid import UUID

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.config import Settings

EMAIL_PATTERN = re.compile(r"^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$")
INSTITUTION_ROLES = frozenset({"student", "instructor", "coordinator", "analyst", "ml_engineer"})
GLOBAL_ROLES = INSTITUTION_ROLES | {"institution_admin"}
MAX_PREVIEW_BYTES = 96_000
MAX_PREVIEW_ROWS = 300
MAX_IMPORT_BATCH = 20


class InviteItem(BaseModel):
    """Campos mínimos para crear la cuenta, con validación en el servidor."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    email: str = Field(min_length=5, max_length=254)
    full_name: str = Field(min_length=3, max_length=180)
    role: str

    @field_validator("email")
    @classmethod
    def email_normalized(cls, value: str) -> str:
        value = value.lower()
        if not EMAIL_PATTERN.fullmatch(value):
            raise ValueError("Correo electrónico no válido")
        return value

    @field_validator("role")
    @classmethod
    def role_allowed(cls, value: str) -> str:
        if value not in GLOBAL_ROLES:
            raise ValueError("El rol no puede crearse desde EduMaster")
        return value


class ImportBatch(BaseModel):
    """El usuario debe confirmar explícitamente el envío real del CSV."""

    model_config = ConfigDict(extra="forbid")
    rows: list[InviteItem] = Field(min_length=1, max_length=MAX_IMPORT_BATCH)
    confirmed: bool


def parse_csv_preview(text_value: str, roles: frozenset[str]) -> dict:
    """Interpreta RFC 4180 con protección ante duplicados y límites de carga."""

    if len(text_value.encode("utf-8")) > MAX_PREVIEW_BYTES:
        raise HTTPException(status_code=413, detail="CSV demasiado grande (máximo 96 KB)")
    text_value = text_value.removeprefix("\ufeff")
    if "\x00" in text_value:
        raise HTTPException(status_code=422, detail="El CSV contiene caracteres no permitidos")
    try:
        source = io.StringIO(text_value, newline="")
        reader = csv.DictReader(source, strict=True)
        if reader.fieldnames is None or [s.strip().lower() for s in reader.fieldnames] != ["email", "full_name", "role"]:
            raise HTTPException(status_code=422, detail="Encabezados requeridos: email,full_name,role")
        items: list[dict] = []
        seen: set[str] = set()
        for index, row in enumerate(reader, start=2):
            if index > MAX_PREVIEW_ROWS + 1:
                raise HTTPException(status_code=413, detail="Máximo 300 filas por archivo CSV")
            if None in row or any(value is None for value in row.values()):
                items.append({"line": index, "valid": False, "message": "Número de columnas incorrecto"})
                continue
            data = dict(zip(["email", "full_name", "role"], [row[name] for name in reader.fieldnames], strict=True))
            try:
                item = InviteItem(**data)
                if item.role not in roles:
                    raise ValueError("Rol no permitido para tu cuenta")
                if item.email in seen:
                    raise ValueError("Correo repetido en el archivo")
                seen.add(item.email)
                items.append({"line": index, "valid": True, **item.model_dump()})
            except (ValueError, TypeError) as exc:
                items.append({"line": index, "valid": False, "message": str(exc)[:220]})
        if not items:
            raise HTTPException(status_code=422, detail="El CSV no contiene filas")
    except (csv.Error, UnicodeError) as exc:
        raise HTTPException(status_code=422, detail="CSV mal formado") from exc
    return {"rows": items, "total": len(items), "valid": sum(1 for item in items if item["valid"])}


async def invite_auth_user(settings: Settings, item: InviteItem) -> UUID:
    """Invita con la clave privada; nunca hace pública la respuesta de GoTrue."""

    secret = settings.supabase_secret_key
    base_url = settings.supabase_url
    if not base_url.startswith("https://") or not secret or secret.startswith("sb_publishable_"):
        raise HTTPException(status_code=503, detail="Invitaciones no configuradas en el servidor")
    headers = {"apikey": secret, "Content-Type": "application/json"}
    # Para claves legacy JWT, GoTrue también acepta el bearer service_role.
    # Una clave sb_secret_... NUNCA se envía como Authorization Bearer.
    if not secret.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {secret}"
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
            response = await client.post(
                f"{base_url}/auth/v1/invite",
                headers=headers,
                json={"email": item.email, "data": {"full_name": item.full_name}},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Supabase Auth no responde; vuelve a intentarlo") from exc
    if response.status_code in (400, 409, 422):
        raise HTTPException(status_code=409, detail="La cuenta ya existe o Auth rechazó la invitación; revisa el correo")
    if response.status_code == 429:
        raise HTTPException(status_code=429, detail="Límite de correos de Supabase alcanzado; continúa más tarde")
    if response.status_code not in (200, 201):
        raise HTTPException(status_code=503, detail="No se pudo enviar la invitación desde Supabase Auth")
    try:
        data = response.json()
        record = data.get("user", data)
        return UUID(str(record["id"]))
    except (KeyError, ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(status_code=502, detail="Supabase Auth devolvió una respuesta incompleta") from exc

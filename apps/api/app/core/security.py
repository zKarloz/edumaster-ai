"""Verificación criptográfica de JWT de Supabase Auth.

IMPORTANTE: esta implementación exige claves asimétricas (ES256/RS256) de Supabase.
Nunca acepta algoritmos de clave simétrica ni claves suministradas por el cliente.
La membresía se verifica por separado dentro de cada endpoint de datos.
"""
from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.core.config import Settings, get_settings

bearer = HTTPBearer(auto_error=False)


@lru_cache(maxsize=4)
def _get_jwks_client(url: str) -> PyJWKClient:
    """El cliente cachea las claves públicas para evitar descargas por solicitud."""
    return PyJWKClient(f"{url}/auth/v1/.well-known/jwks.json", cache_jwk_set=True)


def authenticated_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
) -> UUID:
    """Valida firma, emisor, audiencia, vencimiento y rol del access token."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas o ausentes",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or credentials.scheme.lower() != "bearer" or not settings.supabase_url:
        raise unauthorized
    try:
        token = credentials.credentials
        signing_key = _get_jwks_client(settings.supabase_url).get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=f"{settings.supabase_url}/auth/v1",
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
        )
        if claims.get("role") != "authenticated":
            raise ValueError("Rol de token inválido")
        return UUID(claims["sub"])
    except (jwt.PyJWTError, ValueError, KeyError, TypeError):
        raise unauthorized from None

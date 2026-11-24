"""Reglas de recursos de lecciones: nombres seguros y formatos restringidos.

Ningún recurso privado se sirve sin autorización del router. Los archivos se
almacenan por UUID y son inmutables; el nombre original es solo metadato.
"""

import hashlib
import ipaddress
from urllib.parse import urlsplit

from fastapi import HTTPException

MAX_RESOURCE_BYTES = 10 * 1024 * 1024
MIME_EXTENSIONS = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
}


def normalize_title(value: str) -> str:
    """Normaliza texto de usuario sin permitir controles ni rutas."""
    title = ' '.join(value.strip().split())
    if not (1 <= len(title) <= 180) or any(ord(ch) < 32 for ch in title):
        raise HTTPException(status_code=422, detail='Título de recurso no válido')
    return title


def validate_https_url(url: str) -> str:
    """Permite enlaces externos HTTPS, sin credenciales ni redirecciones opacas."""
    if not isinstance(url, str) or not (1 <= len(url) <= 2048):
        raise HTTPException(status_code=422, detail='Enlace demasiado largo o vacío')
    if any(ord(ch) < 32 or ch == '\\' for ch in url):
        raise HTTPException(status_code=422, detail='Enlace no válido')
    try:
        parts = urlsplit(url)
        host = parts.hostname or ''
        if parts.scheme.lower() != 'https' or not host or parts.username or parts.password:
            raise ValueError('bad URL')
        if parts.port not in (None, 443) or host.lower() == 'localhost' or host.endswith('.localhost'):
            raise ValueError('local URL')
        try:
            address = ipaddress.ip_address(host)
            if not address.is_global:
                raise ValueError('private address')
        except ValueError as exc:
            if str(exc) == 'private address':
                raise
    except ValueError as exc:
        raise HTTPException(status_code=422, detail='Usa una URL HTTPS pública') from exc
    return url


def validate_upload(data: bytes, mime: str, filename: str) -> tuple[str, str, str]:
    """Verifica firma binaria, tamaño y tipo real (sin confiar en la extensión)."""
    if not data or len(data) > MAX_RESOURCE_BYTES:
        raise HTTPException(status_code=413, detail='Archivo vacío o mayor que 10 MB')
    if mime not in MIME_EXTENSIONS:
        raise HTTPException(status_code=415, detail='Solo PDF, PNG, JPG y WebP')
    signatures = {
        'application/pdf': lambda x: x.startswith(b'%PDF-'),
        'image/png': lambda x: x.startswith(b'\x89PNG\r\n\x1a\n'),
        'image/jpeg': lambda x: x.startswith(b'\xff\xd8\xff'),
        'image/webp': lambda x: x.startswith(b'RIFF') and x[8:12] == b'WEBP',
    }
    if not signatures[mime](data):
        raise HTTPException(status_code=415, detail='La firma del archivo no coincide con su formato')
    # Primera barrera: bloquear PDF con acciones activas obvias. Esto NO
    # sustituye una solución antimalware o el análisis de archivos en producción.
    if mime == 'application/pdf' and any(marker in data for marker in (b'/JavaScript', b'/JS ', b'/Launch')):
        raise HTTPException(status_code=415, detail='El PDF contiene acciones no admitidas')
    title = normalize_title(filename.replace('\\', '/').split('/')[-1])
    return title, MIME_EXTENSIONS[mime], hashlib.sha256(data).hexdigest()

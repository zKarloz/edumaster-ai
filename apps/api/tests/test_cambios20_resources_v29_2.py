"""Validación de archivos y URLs de v29.2, sin conexión a Supabase."""

import hashlib

import pytest
from fastapi import HTTPException

from app.services.course_resources import (
    normalize_title,
    validate_https_url,
    validate_upload,
)


def test_enlace_publico_https():
    assert validate_https_url('https://universidad.edu/guia?id=3') == 'https://universidad.edu/guia?id=3'


@pytest.mark.parametrize('url', [
    'javascript:alert(1)', 'http://example.com', 'https://localhost/x',
    'https://127.0.0.1/file', 'https://user:password@example.com',
    'https://example.com:8080/file', 'https://example.com\\@evil.test',
])
def test_links_inseguros_rechazados(url):
    with pytest.raises(HTTPException):
        validate_https_url(url)


def test_nombres_normalizados():
    assert normalize_title('   Guía   de ejercicios  ') == 'Guía de ejercicios'
    with pytest.raises(HTTPException):
        normalize_title('  ')


@pytest.mark.parametrize('mime,header,extension', [
    ('application/pdf', b'%PDF-1.7\ntexto', 'pdf'),
    ('image/png', b'\x89PNG\r\n\x1a\nresto', 'png'),
    ('image/jpeg', b'\xff\xd8\xffcontenido', 'jpg'),
    ('image/webp', b'RIFFaaaaWEBPrestante', 'webp'),
])
def test_archivos_validos_y_checksum(mime, header, extension):
    name, ext, sha = validate_upload(header, mime, 'file.pdf')
    assert (name, ext, sha) == ('file.pdf', extension, hashlib.sha256(header).hexdigest())


def test_firma_invalida_rechazada():
    with pytest.raises(HTTPException) as exc:
        validate_upload(b'este archivo no es PDF', 'application/pdf', 'documento.pdf')
    assert exc.value.status_code == 415


def test_pdf_activo_rechazado():
    with pytest.raises(HTTPException):
        validate_upload(b'%PDF-1.7\n/JavaScript action', 'application/pdf', 'd.pdf')


def test_archivo_demasiado_grande():
    with pytest.raises(HTTPException) as exc:
        validate_upload(b'%PDF-' + b'a'*10485760, 'application/pdf', 'd.pdf')
    assert exc.value.status_code == 413


def test_router_registra_los_endpoints():
    from app.routers.lesson_resources import router
    assert len(router.routes) == 10
    names = {route.name for route in router.routes}
    assert 'file_offering_resource' in names
    assert 'download_institutional_resource' in names

@pytest.mark.parametrize('source', ['lessons', 'offering-lessons'])
@pytest.mark.parametrize('action,method', [
    ('', 'GET'), ('/links', 'POST'), ('/files?filename=guide.pdf', 'POST'),
    ('/11111111-1111-4111-8111-111111111111/download', 'GET'),
    ('/11111111-1111-4111-8111-111111111111', 'DELETE'),
])
def test_resource_routes_require_jwt(source, action, method):
    """Los clientes no autorizados no pueden acceder a ningún endpoint."""
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    url = (
        '/api/v1/academic/organizations/11111111-1111-4111-8111-111111111111'
        f'/{source}/22222222-2222-4222-8222-222222222222/resources{action}'
    )
    response = client.request(method, url)
    assert response.status_code == 401

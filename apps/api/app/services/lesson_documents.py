"""Validación conservadora de documentos Tiptap para CAMBIOS 20 (v29.1).

Solo admite el subconjunto de nodos y marcas que representa el editor.
No acepta HTML arbitrario, imágenes embebidas ni URLs con esquemas activos.
Al leer datos antiguos, convierte el texto plano SIN modificar la base.
"""

import json
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_DOCUMENT_BYTES = 150_000
MAX_TEXT_CHARS = 50_000
MAX_NODES = 3000
MAX_DEPTH = 14
BLOCK_NODES = {"paragraph", "heading", "bulletList", "orderedList", "blockquote"}
TEXT_NODES = {"text", "hardBreak"}
ALLOWED_MARKS = {"bold", "italic", "underline", "link"}


class DocumentValidationError(ValueError):
    """El documento contiene estructuras no soportadas o inseguras."""


def _properties(raw: Mapping[str, Any], allowed: set[str]) -> None:
    if set(raw) - allowed:
        raise DocumentValidationError("El documento contiene atributos no admitidos")


def _validate_mark(raw: object) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise DocumentValidationError("Marca editorial no válida")
    _properties(raw, {"type", "attrs"})
    kind = raw.get("type")
    if kind not in ALLOWED_MARKS:
        raise DocumentValidationError("Formato editorial no admitido")
    if kind != "link":
        if raw.get("attrs") not in (None, {}):
            raise DocumentValidationError("Atributo de formato no admitido")
        return {"type": kind}
    attrs = raw.get("attrs")
    if not isinstance(attrs, dict):
        raise DocumentValidationError("El enlace necesita una dirección HTTPS")
    _properties(attrs, {"href", "target", "rel"})
    href = attrs.get("href")
    if not isinstance(href, str) or len(href) > 2048:
        raise DocumentValidationError("Dirección de enlace no válida")
    if any(ord(ch) < 32 or ch == "\\" for ch in href):
        raise DocumentValidationError("La dirección contiene caracteres prohibidos")
    try:
        parts = urlsplit(href)
        hostname = parts.hostname
    except ValueError as exc:
        raise DocumentValidationError("Dirección de enlace no válida") from exc
    if parts.scheme.lower() != "https" or not hostname or parts.username or parts.password:
        raise DocumentValidationError("Solo se admiten enlaces HTTPS externos")
    if attrs.get("target") not in (None, "_blank", "_self"):
        raise DocumentValidationError("Destino del enlace no válido")
    if attrs.get("rel") not in (None, "noopener noreferrer nofollow", "noopener noreferrer"):
        raise DocumentValidationError("Atributo de enlace no válido")
    return {"type": "link", "attrs": {"href": href, "target": "_blank", "rel": "noopener noreferrer nofollow"}}


def validate_document(raw: object) -> dict[str, Any]:
    """Devuelve una copia canónica, limitada y apta para serializar como JSON."""
    if not isinstance(raw, dict) or raw.get("type") != "doc":
        raise DocumentValidationError("La raíz del editor debe ser un documento")
    count = 0
    chars = 0

    def visit(node: object, parent: str | None, depth: int) -> dict[str, Any]:
        nonlocal count, chars
        if depth > MAX_DEPTH or count >= MAX_NODES:
            raise DocumentValidationError("Documento demasiado complejo")
        count += 1
        if not isinstance(node, dict):
            raise DocumentValidationError("Nodo editorial no válido")
        _properties(node, {"type", "text", "content", "marks", "attrs"})
        kind = node.get("type")
        permitted = {
            None: {"doc"},
            "doc": BLOCK_NODES,
            "paragraph": TEXT_NODES,
            "heading": TEXT_NODES,
            "blockquote": {"paragraph", "heading"},
            "bulletList": {"listItem"},
            "orderedList": {"listItem"},
            "listItem": {"paragraph", "bulletList", "orderedList"},
            "text": set(),
            "hardBreak": set(),
        }
        if kind not in permitted.get(parent, set()):
            raise DocumentValidationError("Estructura de documento no admitida")
        result: dict[str, Any] = {"type": kind}
        if kind == "text":
            _properties(node, {"type", "text", "marks"})
            value = node.get("text")
            if not isinstance(value, str) or not value:
                raise DocumentValidationError("Texto de nodo no válido")
            chars += len(value)
            if chars > MAX_TEXT_CHARS:
                raise DocumentValidationError("El contenido supera el límite editorial")
            result["text"] = value
            marks = node.get("marks", [])
            if not isinstance(marks, list) or len(marks) > 8:
                raise DocumentValidationError("Demasiadas marcas de texto")
            if marks:
                result["marks"] = [_validate_mark(mark) for mark in marks]
        elif kind == "hardBreak":
            _properties(node, {"type"})
        else:
            _properties(node, {"type", "content", "attrs"})
            attrs = node.get("attrs")
            if kind == "heading":
                if (not isinstance(attrs, dict) or set(attrs) != {"level"}
                        or type(attrs["level"]) is not int or attrs["level"] not in (1, 2, 3)):
                    raise DocumentValidationError("Nivel de encabezado no válido")
                result["attrs"] = {"level": attrs["level"]}
            elif kind == "orderedList":
                if attrs not in (None, {}):
                    if (not isinstance(attrs, dict) or set(attrs) != {"start"}
                            or type(attrs["start"]) is not int
                            or not 1 <= attrs["start"] <= 10000):
                        raise DocumentValidationError("Numeración no válida")
                    result["attrs"] = {"start": attrs["start"]}
            elif attrs not in (None, {}):
                raise DocumentValidationError("Atributos de nodo no admitidos")
            children = node.get("content", [])
            if not isinstance(children, list):
                raise DocumentValidationError("Los hijos de un nodo deben ser una lista")
            if children:
                result["content"] = [visit(child, kind, depth + 1) for child in children]
            elif kind in ("bulletList", "orderedList", "blockquote", "listItem"):
                raise DocumentValidationError("La estructura editorial está vacía")
        return result

    document = visit(raw, None, 0)
    body = json.dumps(document, ensure_ascii=False, separators=(",", ":"))
    if len(body.encode("utf-8")) > MAX_DOCUMENT_BYTES:
        raise DocumentValidationError("El documento es demasiado grande")
    return document


def plain_text_to_document(value: str | None) -> dict[str, Any]:
    """Adapta contenido histórico sin reinterpretar HTML como marcado activo."""
    lines = (value or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
    paragraphs = [
        {"type": "paragraph", "content": [{"type": "text", "text": line}]} if line else {"type": "paragraph"}
        for line in lines
    ]
    return validate_document({"type": "doc", "content": paragraphs})


class DraftSave(BaseModel):
    """DTO del contrato PATCH: control optimista y documento acotado."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    title: str = Field(min_length=3, max_length=180)
    document: dict[str, Any]
    expected_lock_version: int = Field(ge=1)

    @field_validator("document")
    @classmethod
    def document_schema(cls, value: dict[str, Any]) -> dict[str, Any]:
        return validate_document(value)

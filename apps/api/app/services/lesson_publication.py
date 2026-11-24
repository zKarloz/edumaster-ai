"""CAMBIOS 20 v29.3: proyección pública de documentos versionados.

No se almacena HTML arbitrario: el documento Tiptap validado es la fuente
estructurada; el campo ``content`` heredado sigue siendo texto plano seguro.
"""
from typing import Any


def document_to_plain_text(document: dict[str, Any]) -> str:
    """Construye una proyección sin HTML para clientes anteriores a v29.3."""
    paragraphs: list[str] = []

    def walk(node: dict[str, Any]) -> str:
        kind = node.get("type")
        if kind == "text":
            return str(node.get("text", ""))
        if kind == "hardBreak":
            return "\n"
        children = [walk(child) for child in node.get("content", [])]
        if kind in ("doc", "blockquote", "bulletList", "orderedList"):
            return "\n".join(part for part in children if part)
        if kind == "listItem":
            return "• " + " ".join(part for part in children if part)
        if kind in ("paragraph", "heading"):
            return "".join(children)
        return "".join(children)

    for child in document.get("content", []):
        paragraphs.append(walk(child))
    return "\n".join(paragraphs)

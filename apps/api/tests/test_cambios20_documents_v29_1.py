"""Pruebas puras del contrato documental, sin Supabase ni servicios externos."""

import json

import pytest
from pydantic import ValidationError

from app.services.lesson_documents import (
    DocumentValidationError,
    DraftSave,
    plain_text_to_document,
    validate_document,
)


def test_plain_text_preserves_lines_and_never_interprets_html():
    doc = plain_text_to_document("Primera\r\n\r\n<script>alert(1)</script>")
    assert doc == {"type": "doc", "content": [
        {"type": "paragraph", "content": [{"type": "text", "text": "Primera"}]},
        {"type": "paragraph"},
        {"type": "paragraph", "content": [{"type": "text", "text": "<script>alert(1)</script>"}]},
    ]}


def test_empty_legacy_document_opens_as_empty_paragraph():
    assert plain_text_to_document(None) == {"type": "doc", "content": [{"type": "paragraph"}]}


def test_valid_heading_lists_and_https_link():
    doc = {"type": "doc", "content": [
        {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Unidad 1"}]},
        {"type": "bulletList", "content": [{"type": "listItem", "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": "Recurso", "marks": [
                {"type": "link", "attrs": {"href": "https://example.org/recurso"}}
            ]}]},
        ]}]},
    ]}
    result = validate_document(doc)
    link = result["content"][1]["content"][0]["content"][0]["content"][0]["marks"][0]
    assert link["attrs"]["target"] == "_blank"
    assert link["attrs"]["rel"] == "noopener noreferrer nofollow"
    assert json.loads(json.dumps(result)) == result


@pytest.mark.parametrize("node", [
    {"type": "html", "content": [{"type": "text", "text": "inseguro"}]},
    {"type": "image", "attrs": {"src": "https://example.org/a.png"}},
    {"type": "iframe", "attrs": {"src": "https://example.org"}},
    {"type": "paragraph", "content": [{"type": "text", "text": "X", "marks": [
        {"type": "link", "attrs": {"href": "javascript:alert(1)"}},
    ]}]},
    {"type": "paragraph", "content": [{"type": "text", "text": "X", "marks": [
        {"type": "link", "attrs": {"href": "http://example.com"}},
    ]}]},
    {"type": "paragraph", "content": [{"type": "text", "text": "X", "marks": [
        {"type": "link", "attrs": {"href": "https://example.org\nscript"}},
    ]}]},
    {"type": "heading", "attrs": {"level": 9}, "content": [{"type": "text", "text": "X"}]},
    {"type": "paragraph", "content": [{"type": "text", "text": "X", "style": "color:red"}]},
    {"type": "blockquote", "content": [{"type": "text", "text": "X"}]},
])
def test_invalid_editor_nodes_are_rejected(node):
    with pytest.raises(DocumentValidationError):
        validate_document({"type": "doc", "content": [node]})


def test_maximum_text_limit_is_enforced():
    with pytest.raises(DocumentValidationError, match="límite"):
        validate_document({"type": "doc", "content": [{"type": "paragraph", "content": [
            {"type": "text", "text": "z" * 50001},
        ]}]})


def test_maximum_nested_depth_is_enforced():
    node = {"type": "paragraph", "content": [{"type": "text", "text": "X"}]}
    for _ in range(20):
        node = {"type": "bulletList", "content": [{"type": "listItem", "content": [node]}]}
    with pytest.raises(DocumentValidationError):
        validate_document({"type": "doc", "content": [node]})


def test_draft_save_rejects_unknown_field_and_invalid_version():
    valid = {"title": "Lección uno", "document": plain_text_to_document("Hola"),
             "expected_lock_version": 1}
    assert DraftSave.model_validate(valid).title == "Lección uno"
    for payload in ({**valid, "expected_lock_version": 0}, {**valid, "unexpected": True}):
        with pytest.raises(ValidationError):
            DraftSave.model_validate(payload)


def test_json_document_unknown_root_rejected():
    with pytest.raises(DocumentValidationError):
        validate_document({"type": "paragraph", "content": []})

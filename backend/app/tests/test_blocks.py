import pytest

from app.services.blocks import BlockError, render_template, resolve_path


def test_resolve_path_follows_nested_keys():
    assert resolve_path({"owner": {"login": "tiangolo"}}, "owner.login") == "tiangolo"


def test_resolve_path_supports_list_indices():
    assert resolve_path({"items": [{"id": 7}]}, "items.0.id") == 7


def test_resolve_path_reports_the_missing_key():
    with pytest.raises(BlockError, match="missing key 'nope'"):
        resolve_path({"a": 1}, "nope")


def test_resolve_path_rejects_descending_into_a_scalar():
    with pytest.raises(BlockError, match="cannot descend into int"):
        resolve_path({"a": 1}, "a.b")


def test_render_template_uses_object_keys():
    assert render_template("{repo}: {stars}", {"repo": "x/y", "stars": 3}) == "x/y: 3"


def test_render_template_exposes_whole_value_as_input():
    assert render_template("got {input}", "hello") == "got hello"


def test_render_template_lists_available_placeholders_on_error():
    with pytest.raises(BlockError, match="available: input, stars"):
        render_template("{missing}", {"stars": 1})

"""Implementations of the individual workflow block types.

Each handler takes its validated config plus the value produced by the previous
block, and returns the value passed to the next one. Handlers append to `logs`
so a run's history explains what happened at each step.
"""

from typing import Any, Callable

import requests

from app.schemas.workflow import (
    FilterConfig,
    HttpRequestConfig,
    JsonExtractConfig,
    NotificationConfig,
    TextTransformConfig,
)


class BlockError(Exception):
    """A block failed; the run stops and is recorded as failed."""


class FilteredOut(Exception):
    """A filter condition did not hold; the run stops and is recorded as filtered."""


def resolve_path(value: Any, path: str) -> Any:
    """Follows a dotted path, supporting object keys and list indices."""
    current = value
    for part in path.split("."):
        if isinstance(current, dict):
            if part not in current:
                raise BlockError(f"path '{path}' not found (missing key '{part}')")
            current = current[part]
        elif isinstance(current, list):
            try:
                current = current[int(part)]
            except (ValueError, IndexError):
                raise BlockError(f"path '{path}' not found (bad list index '{part}')") from None
        else:
            raise BlockError(f"path '{path}' not found (cannot descend into {type(current).__name__})")
    return current


def render_template(template: str, value: Any) -> str:
    """Renders `{placeholder}` references against the incoming value.

    Keys of an incoming object are addressable directly; `{input}` always refers
    to the whole value.
    """
    mapping: dict[str, Any] = {"input": value}
    if isinstance(value, dict):
        mapping.update(value)

    try:
        return template.format_map(mapping)
    except KeyError as exc:
        available = ", ".join(sorted(str(k) for k in mapping)) or "none"
        raise BlockError(
            f"template references unknown placeholder {exc}; available: {available}"
        ) from None
    except (IndexError, ValueError) as exc:
        raise BlockError(f"invalid template: {exc}") from None


# Module-level indirection so tests can substitute the transport.
def _send_request(config: HttpRequestConfig) -> requests.Response:
    return requests.request(
        method=config.method,
        url=config.url,
        headers=config.headers,
        json=config.body if config.method == "POST" else None,
        timeout=config.timeout_seconds,
    )


http_transport: Callable[[HttpRequestConfig], requests.Response] = _send_request


def run_http_request(config: HttpRequestConfig, value: Any, logs: list[str]) -> Any:
    logs.append(f"{config.method} {config.url}")
    try:
        response = http_transport(config)
    except requests.Timeout:
        raise BlockError(f"request timed out after {config.timeout_seconds}s") from None
    except requests.RequestException as exc:
        raise BlockError(f"request failed: {exc}") from None

    logs.append(f"responded {response.status_code}")
    if response.status_code >= 400:
        raise BlockError(f"endpoint returned HTTP {response.status_code}")

    try:
        return response.json()
    except ValueError:
        # Not JSON, so hand the body on as text rather than failing the run.
        logs.append("response body is not JSON; passing through as text")
        return {"text": response.text}


def run_json_extract(config: JsonExtractConfig, value: Any, logs: list[str]) -> Any:
    extracted = {key: resolve_path(value, path) for key, path in config.fields.items()}
    logs.append(f"extracted {', '.join(sorted(extracted))}")
    return extracted


def run_text_transform(config: TextTransformConfig, value: Any, logs: list[str]) -> Any:
    rendered = render_template(config.template, value)
    if config.operation == "upper":
        rendered = rendered.upper()
    elif config.operation == "lower":
        rendered = rendered.lower()
    elif config.operation == "strip":
        rendered = rendered.strip()
    logs.append(f"rendered {len(rendered)} characters")
    return rendered


def _compare(left: Any, operator: str, right: Any) -> bool:
    if operator == "eq":
        return left == right
    if operator == "ne":
        return left != right
    if operator == "contains":
        try:
            return right in left
        except TypeError:
            raise BlockError(f"cannot test containment on {type(left).__name__}") from None

    # Ordering comparisons need both sides to be numeric.
    try:
        left_number, right_number = float(left), float(right)
    except (TypeError, ValueError):
        raise BlockError(
            f"operator '{operator}' needs numeric operands, got "
            f"{type(left).__name__} and {type(right).__name__}"
        ) from None

    if operator == "gt":
        return left_number > right_number
    if operator == "gte":
        return left_number >= right_number
    if operator == "lt":
        return left_number < right_number
    return left_number <= right_number


def run_filter(config: FilterConfig, value: Any, logs: list[str]) -> Any:
    actual = resolve_path(value, config.path)
    passed = _compare(actual, config.operator, config.value)
    logs.append(f"{config.path} ({actual!r}) {config.operator} {config.value!r} -> {passed}")
    if not passed:
        raise FilteredOut(f"condition not met: {config.path} {config.operator} {config.value!r}")
    # Filters gate the run without altering the data.
    return value


def run_notification(config: NotificationConfig, value: Any, logs: list[str]) -> Any:
    message = render_template(config.template, value)
    logs.append(f"notification via {config.channel}: {message}")
    return {"channel": config.channel, "message": message}


CONFIG_MODELS = {
    "http_request": HttpRequestConfig,
    "json_extract": JsonExtractConfig,
    "text_transform": TextTransformConfig,
    "filter": FilterConfig,
    "notification": NotificationConfig,
}

HANDLERS: dict[str, Callable[[Any, Any, list[str]], Any]] = {
    "http_request": run_http_request,
    "json_extract": run_json_extract,
    "text_transform": run_text_transform,
    "filter": run_filter,
    "notification": run_notification,
}

CATALOG = [
    {
        "type": "http_request",
        "label": "HTTP Request",
        "description": "Calls an HTTP endpoint and passes on the decoded JSON response.",
    },
    {
        "type": "json_extract",
        "label": "Extract Fields",
        "description": "Picks named values out of the incoming object using dotted paths.",
    },
    {
        "type": "filter",
        "label": "Filter",
        "description": "Stops the run unless a condition on the incoming data holds.",
    },
    {
        "type": "text_transform",
        "label": "Text Transform",
        "description": "Renders a template from the incoming data and adjusts casing.",
    },
    {
        "type": "notification",
        "label": "Notification",
        "description": "Emits a rendered message. Currently logs; email is not implemented.",
    },
]

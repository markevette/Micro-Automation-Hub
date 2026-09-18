from datetime import datetime
from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field

# --- Block configuration -----------------------------------------------------


class HttpRequestConfig(BaseModel):
    method: Literal["GET", "POST"] = "GET"
    url: str
    headers: dict[str, str] = Field(default_factory=dict)
    body: Any | None = None
    # Capped so a hanging endpoint cannot stall a run indefinitely.
    timeout_seconds: float = Field(default=10.0, gt=0, le=60)


class JsonExtractConfig(BaseModel):
    """Maps an output key to a dotted path into the incoming value.

    e.g. {"stars": "stargazers_count", "owner": "owner.login"}
    """

    fields: dict[str, str] = Field(min_length=1)


class TextTransformConfig(BaseModel):
    """Renders a template, then optionally changes the casing.

    Placeholders reference keys of the incoming value when it is an object;
    `{input}` always refers to the whole incoming value.
    """

    template: str
    operation: Literal["none", "upper", "lower", "strip"] = "none"


class FilterConfig(BaseModel):
    """Stops the run unless the condition holds."""

    path: str
    operator: Literal["gt", "gte", "lt", "lte", "eq", "ne", "contains"]
    value: Any = None


class NotificationConfig(BaseModel):
    # Only the log channel is implemented; email is registered as technical debt.
    channel: Literal["log"] = "log"
    template: str


# --- Blocks ------------------------------------------------------------------


class BaseBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=80)


class HttpRequestBlock(BaseBlock):
    type: Literal["http_request"] = "http_request"
    config: HttpRequestConfig


class JsonExtractBlock(BaseBlock):
    type: Literal["json_extract"] = "json_extract"
    config: JsonExtractConfig


class TextTransformBlock(BaseBlock):
    type: Literal["text_transform"] = "text_transform"
    config: TextTransformConfig


class FilterBlock(BaseBlock):
    type: Literal["filter"] = "filter"
    config: FilterConfig


class NotificationBlock(BaseBlock):
    type: Literal["notification"] = "notification"
    config: NotificationConfig


Block = Annotated[
    Union[
        HttpRequestBlock,
        JsonExtractBlock,
        TextTransformBlock,
        FilterBlock,
        NotificationBlock,
    ],
    Field(discriminator="type"),
]


class WorkflowDefinition(BaseModel):
    blocks: list[Block] = Field(min_length=1, max_length=20)


# --- Requests / responses ----------------------------------------------------


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    definition: WorkflowDefinition


class WorkflowRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    definition: dict[str, Any]
    created_at: datetime


class StepResult(BaseModel):
    name: str
    type: str
    status: Literal["success", "failed", "filtered"]
    output: Any = None
    error: str | None = None
    duration_ms: int
    logs: list[str] = Field(default_factory=list)


class RunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workflow_id: int | None
    status: Literal["success", "failed", "filtered"]
    started_at: datetime
    duration_ms: int
    error: str | None
    steps: list[StepResult]


class BlockTypeInfo(BaseModel):
    """Describes a block type so the UI can render a palette."""

    type: str
    label: str
    description: str
    config_schema: dict[str, Any]

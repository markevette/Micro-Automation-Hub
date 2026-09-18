import requests

from app.schemas.workflow import WorkflowDefinition
from app.services.engine import execute_workflow

REPO_PAYLOAD = {
    "full_name": "fastapi/fastapi",
    "owner": {"login": "tiangolo"},
    "stargazers_count": 75000,
    "open_issues_count": 42,
}


def pipeline(threshold: int = 1000) -> WorkflowDefinition:
    return WorkflowDefinition.model_validate(
        {
            "blocks": [
                {
                    "type": "http_request",
                    "name": "Fetch repository",
                    "config": {"url": "https://api.github.com/repos/fastapi/fastapi"},
                },
                {
                    "type": "json_extract",
                    "name": "Extract",
                    "config": {
                        "fields": {
                            "repo": "full_name",
                            "owner": "owner.login",
                            "stars": "stargazers_count",
                        }
                    },
                },
                {
                    "type": "filter",
                    "name": "Only when popular",
                    "config": {"path": "stars", "operator": "gt", "value": threshold},
                },
                {
                    "type": "text_transform",
                    "name": "Format",
                    "config": {"template": "{repo} by {owner}: {stars} stars"},
                },
                {
                    "type": "notification",
                    "name": "Notify",
                    "config": {"channel": "log", "template": "Alert -> {input}"},
                },
            ]
        }
    )


def test_full_pipeline_succeeds_and_records_every_step(stub_http):
    stub_http(payload=REPO_PAYLOAD)

    outcome = execute_workflow(pipeline())

    assert outcome.status == "success"
    assert [step.status for step in outcome.steps] == ["success"] * 5
    assert [step.name for step in outcome.steps][0] == "Fetch repository"
    assert outcome.output == {
        "channel": "log",
        "message": "Alert -> fastapi/fastapi by tiangolo: 75000 stars",
    }
    assert outcome.error is None
    assert all(step.duration_ms >= 0 for step in outcome.steps)


def test_filter_stops_the_run_and_skips_later_blocks(stub_http):
    stub_http(payload=REPO_PAYLOAD)

    outcome = execute_workflow(pipeline(threshold=10_000_000))

    assert outcome.status == "filtered"
    # http_request, json_extract, filter ran; the last two never started.
    assert len(outcome.steps) == 3
    assert outcome.steps[-1].status == "filtered"
    assert "condition not met" in outcome.error


def test_http_error_status_fails_the_run(stub_http):
    stub_http(payload={"message": "Not Found"}, status_code=404)

    outcome = execute_workflow(pipeline())

    assert outcome.status == "failed"
    assert len(outcome.steps) == 1
    assert "HTTP 404" in outcome.steps[0].error
    assert outcome.error.startswith("Fetch repository:")


def test_timeout_is_reported_as_a_block_failure(stub_http):
    stub_http(error=requests.Timeout())

    outcome = execute_workflow(pipeline())

    assert outcome.status == "failed"
    assert "timed out" in outcome.steps[0].error


def test_missing_field_fails_with_a_useful_message(stub_http):
    stub_http(payload={"full_name": "a/b"})

    outcome = execute_workflow(pipeline())

    assert outcome.status == "failed"
    assert outcome.steps[1].status == "failed"
    assert "not found" in outcome.steps[1].error


def test_large_output_is_truncated_before_storage(stub_http):
    stub_http(payload={"full_name": "x" * 5000, "owner": {"login": "o"}, "stargazers_count": 2000})

    outcome = execute_workflow(pipeline())

    assert outcome.status == "success"
    assert outcome.steps[0].output["_truncated"] is True
    assert "size_chars" in outcome.steps[0].output

SIMPLE_DEFINITION = {
    "blocks": [
        {
            "type": "text_transform",
            "name": "Build message",
            "config": {"template": "hello world", "operation": "upper"},
        },
        {
            "type": "notification",
            "name": "Notify",
            "config": {"channel": "log", "template": "msg: {input}"},
        },
    ]
}


def create_simple(client, name="Demo"):
    return client.post(
        "/api/workflows",
        json={"name": name, "description": "d", "definition": SIMPLE_DEFINITION},
    )


def test_block_catalog_exposes_every_type_with_a_config_schema(client):
    response = client.get("/api/blocks")

    assert response.status_code == 200
    types = {entry["type"] for entry in response.json()}
    assert types == {"http_request", "json_extract", "filter", "text_transform", "notification"}
    assert all(entry["config_schema"]["type"] == "object" for entry in response.json())


def test_create_then_list_workflow(client):
    created = create_simple(client)
    assert created.status_code == 201
    assert created.json()["id"] > 0

    listed = client.get("/api/workflows")
    assert listed.status_code == 200
    assert [w["name"] for w in listed.json()] == ["Demo"]


def test_duplicate_name_is_rejected(client):
    create_simple(client)

    conflict = create_simple(client)

    assert conflict.status_code == 409
    assert "already exists" in conflict.json()["detail"]


def test_unknown_workflow_returns_404(client):
    assert client.get("/api/workflows/999").status_code == 404
    assert client.post("/api/workflows/999/run").status_code == 404


def test_invalid_block_type_is_rejected(client):
    response = client.post(
        "/api/workflows",
        json={
            "name": "Bad",
            "definition": {"blocks": [{"type": "not_a_block", "name": "x", "config": {}}]},
        },
    )

    assert response.status_code == 422


def test_running_a_workflow_records_run_history(client):
    workflow_id = create_simple(client).json()["id"]

    run = client.post(f"/api/workflows/{workflow_id}/run")

    assert run.status_code == 200
    body = run.json()
    assert body["status"] == "success"
    assert body["workflow_id"] == workflow_id
    assert [step["name"] for step in body["steps"]] == ["Build message", "Notify"]
    assert body["steps"][-1]["output"]["message"] == "msg: HELLO WORLD"

    history = client.get("/api/runs", params={"workflow_id": workflow_id})
    assert history.status_code == 200
    assert len(history.json()) == 1
    assert history.json()[0]["id"] == body["id"]


def test_ad_hoc_run_is_recorded_without_a_workflow(client):
    response = client.post("/api/runs/ad-hoc", json=SIMPLE_DEFINITION)

    assert response.status_code == 200
    assert response.json()["workflow_id"] is None
    assert response.json()["status"] == "success"


def test_full_example_pipeline_runs_through_the_api(client, stub_http):
    stub_http(
        payload={
            "full_name": "fastapi/fastapi",
            "owner": {"login": "tiangolo"},
            "stargazers_count": 75000,
            "open_issues_count": 42,
        }
    )

    response = client.post(
        "/api/runs/ad-hoc",
        json={
            "blocks": [
                {
                    "type": "http_request",
                    "name": "Fetch",
                    "config": {"url": "https://api.github.com/repos/fastapi/fastapi"},
                },
                {
                    "type": "json_extract",
                    "name": "Extract",
                    "config": {"fields": {"repo": "full_name", "stars": "stargazers_count"}},
                },
                {
                    "type": "filter",
                    "name": "Popular",
                    "config": {"path": "stars", "operator": "gt", "value": 1000},
                },
                {
                    "type": "notification",
                    "name": "Notify",
                    "config": {"channel": "log", "template": "{repo} has {stars} stars"},
                },
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert response.json()["steps"][-1]["output"]["message"] == "fastapi/fastapi has 75000 stars"


def test_updating_a_workflow_replaces_its_definition(client):
    workflow_id = create_simple(client).json()["id"]

    response = client.put(
        f"/api/workflows/{workflow_id}",
        json={
            "name": "Renamed",
            "description": "now with a filter",
            "definition": {
                "blocks": [
                    {
                        "type": "text_transform",
                        "name": "Only block",
                        "config": {"template": "x"},
                    }
                ]
            },
        },
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"
    assert len(response.json()["definition"]["blocks"]) == 1


def test_updating_to_an_existing_name_is_rejected(client):
    create_simple(client, name="First")
    second_id = create_simple(client, name="Second").json()["id"]

    response = client.put(
        f"/api/workflows/{second_id}",
        json={"name": "First", "definition": SIMPLE_DEFINITION},
    )

    assert response.status_code == 409


def test_updating_an_unknown_workflow_returns_404(client):
    response = client.put(
        "/api/workflows/999", json={"name": "X", "definition": SIMPLE_DEFINITION}
    )

    assert response.status_code == 404


def test_deleting_a_workflow_removes_it(client):
    workflow_id = create_simple(client).json()["id"]

    assert client.delete(f"/api/workflows/{workflow_id}").status_code == 204
    assert client.get(f"/api/workflows/{workflow_id}").status_code == 404

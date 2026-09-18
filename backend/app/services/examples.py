"""Built-in example workflows, seeded on first startup.

These give an evaluator something runnable without having to author a workflow
by hand, and they exercise every implemented block type.
"""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.workflow import Workflow

logger = logging.getLogger(__name__)

GITHUB_REPO_WATCHER: dict[str, Any] = {
    "name": "GitHub repo watcher",
    "description": (
        "Fetches a public repository over HTTP, keeps only the fields of interest, "
        "stops unless the project is popular, then formats a summary and emits a "
        "notification. Exercises all five block types."
    ),
    "definition": {
        "blocks": [
            {
                "type": "http_request",
                "name": "Fetch repository",
                "config": {
                    "method": "GET",
                    "url": "https://api.github.com/repos/fastapi/fastapi",
                    "headers": {"Accept": "application/vnd.github+json"},
                    "timeout_seconds": 10,
                },
            },
            {
                "type": "json_extract",
                "name": "Keep the interesting fields",
                "config": {
                    "fields": {
                        "repo": "full_name",
                        "owner": "owner.login",
                        "stars": "stargazers_count",
                        "open_issues": "open_issues_count",
                    }
                },
            },
            {
                "type": "filter",
                "name": "Only when popular",
                "config": {"path": "stars", "operator": "gt", "value": 1000},
            },
            {
                "type": "text_transform",
                "name": "Format summary",
                "config": {
                    "template": "{repo} by {owner}: {stars} stars, {open_issues} open issues",
                    "operation": "none",
                },
            },
            {
                "type": "notification",
                "name": "Send notification",
                "config": {"channel": "log", "template": "Automation alert -> {input}"},
            },
        ]
    },
}

EXAMPLES = [GITHUB_REPO_WATCHER]


def seed_examples(session: Session) -> None:
    """Inserts any example workflow that is not present yet. Safe to re-run."""
    for example in EXAMPLES:
        exists = session.scalar(select(Workflow).where(Workflow.name == example["name"]))
        if exists is not None:
            continue
        session.add(
            Workflow(
                name=example["name"],
                description=example["description"],
                definition=example["definition"],
            )
        )
        logger.info("seeded example workflow '%s'", example["name"])
    session.commit()

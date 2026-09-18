import os


class Settings:
    """Application configuration read from environment variables.

    docker-compose supplies these; the defaults target a developer running
    Postgres locally without containers.
    """

    def __init__(self) -> None:
        self.database_url = os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg2://automation:automation@localhost:5433/automation",
        )

        # Carried as a comma-separated string so one env var can hold several origins.
        raw_origins = os.getenv("BACKEND_CORS_ORIGINS", "http://localhost:3000")
        self.cors_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


settings = Settings()

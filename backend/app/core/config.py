from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Study University Management API"
    api_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://study:study@localhost:5432/study"
    secret_key: str = "change-this-in-production"
    access_token_minutes: int = 60
    refresh_token_days: int = 7
    ai_provider: str = "groq"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.8-flash"
    groq_api_key: str | None = None
    groq_model: str = "openai/gpt-oss-20b"
    ai_max_output_tokens: int = 2048
    ai_temperature: float = 0.3
    ai_provider_timeout_seconds: float = 25.0
    ai_total_timeout_seconds: float = 40.0
    ai_retry_delay_seconds: float = 0.2
    rag_min_score: float = 0.12
    rag_max_context_chars: int = 8000
    upload_dir: str = "./uploads"
    cors_origins: str = "http://localhost:3000"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()

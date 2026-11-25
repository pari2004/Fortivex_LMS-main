"""Application configuration, loaded from environment variables.

Mirrors the contract defined in the repo-root `.env.example`. No defaults
are provided for secrets (JWT_SECRET_KEY) or the database URL — the app
must fail to start rather than silently run with an insecure default.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_FILE = str(ROOT_DIR / ".env")

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ENVIRONMENT: str = "development"
    APP_NAME: str = "Fortivex LMS"

    DATABASE_URL: str
    REDIS_URL: str | None = None
    
    # AI Config
    AI_API_KEY: str | None = None
    AI_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta/openai/"
    AI_MODEL: str = "gemini-3.5-flash-lite"

    # Judge0 Code Execution Config
    JUDGE0_URL: str = "https://ce.judge0.com"
    JUDGE0_API_KEY: str | None = None
    JUDGE0_API_HOST: str | None = None

    # Chatbot Config
    CHATBOT_DAILY_ALLOWANCE_SECONDS: int = 300
    CHATBOT_TIMEZONE: str = "Asia/Kolkata"
    CHATBOT_HEARTBEAT_INTERVAL_SECONDS: int = 10
    CHATBOT_IDLE_TIMEOUT_SECONDS: int = 30

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    CORS_ALLOWED_ORIGINS: str = "http://localhost:3000,https://fortivex-lms.vercel.app,https://lms.fortivexaitech.com"
    CORS_ALLOW_ORIGIN_REGEX: str | None = r"https://([a-zA-Z0-9-]+\.)*(vercel\.app|fortivexaitech\.com|empowersacademy\.com|medivexai\.com)"

    # Object Storage (S3-compatible)
    STORAGE_ENDPOINT_URL: str | None = None
    STORAGE_BUCKET_NAME: str | None = None
    STORAGE_ACCESS_KEY_ID: str | None = None
    STORAGE_SECRET_ACCESS_KEY: str | None = None
    STORAGE_REGION: str = "ap-south-1"

    @property
    def cors_allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()

"""
app/core/config.py
Configuración centralizada de la aplicación usando Pydantic Settings.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # --- Aplicación ---
    APP_NAME: str = "EnRuta API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # --- Seguridad ---
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 horas

    # --- Base de Datos ---
    DATABASE_URL: str  # postgresql+asyncpg://...

    # --- Supabase ---
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # --- Mapbox ---
    MAPBOX_ACCESS_TOKEN: str = ""

    # --- Google Sign-In ---
    # Client ID(s) OAuth autorizados para validar el id_token de Google.
    # Si hay varios (Android / iOS / Web), separarlos con comas.
    GOOGLE_CLIENT_ID: str = ""

    # --- OCR (Gemini) ---
    # gemini-1.5-flash fue retirado de la API; se usa un modelo vigente.
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"

    # --- OCR (legado, ya no se usa con Gemini) ---
    TESSERACT_CMD: str = "/usr/bin/tesseract"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Retorna la instancia singleton de configuración (cacheada)."""
    return Settings()


settings = get_settings()

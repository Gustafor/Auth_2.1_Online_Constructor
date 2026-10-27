"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class ServerConfig:
    host: str
    port: int
    debug: bool


@dataclass(frozen=True)
class CorsConfig:
    origins: list[str]


@dataclass(frozen=True)
class AppConfig:
    server: ServerConfig
    cors: CorsConfig
    supported_providers: list[str]
    supported_app_types: list[str]
    supported_stacks: list[str]


def _get_env(key: str, default: str) -> str:
    return os.environ.get(key, default)


def _get_env_list(key: str, default: str) -> list[str]:
    raw = _get_env(key, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def load_config() -> AppConfig:
    """Load application configuration from environment variables.

    Returns:
        AppConfig instance with resolved values.
    """
    return AppConfig(
        server=ServerConfig(
            host=_get_env("HOST", "0.0.0.0"),
            port=int(_get_env("PORT", "8000")),
            debug=_get_env("DEBUG", "false").lower() == "true",
        ),
        cors=CorsConfig(
            origins=_get_env_list(
                "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
            ),
        ),
        supported_providers=_get_env_list(
            "SUPPORTED_PROVIDERS", "google,github,yandex,vk,custom_oidc"
        ),
        supported_app_types=_get_env_list(
            "SUPPORTED_APP_TYPES", "spa,web,native,cli,server_server"
        ),
        supported_stacks=_get_env_list(
            "SUPPORTED_STACKS", "react,vue,nextjs,fastapi,express,php,go"
        ),
    )

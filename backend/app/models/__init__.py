"""OAuth 2.1 / OpenID Connect data models."""

from __future__ import annotations

from enum import StrEnum
from typing import Any


class AppType(StrEnum):
    SPA = "spa"
    WEB = "web"
    NATIVE = "native"
    CLI = "cli"
    SERVER_SERVER = "server_server"


class IdentityProvider(StrEnum):
    GOOGLE = "google"
    GITHUB = "github"
    YANDEX = "yandex"
    VK = "vk"
    CUSTOM_OIDC = "custom_oidc"


class FrontendStack(StrEnum):
    REACT = "react"
    VUE = "vue"
    NEXTJS = "nextjs"
    FASTAPI = "fastapi"
    EXPRESS = "express"
    PHP = "php"
    GO = "go"


class OAuthFlow(StrEnum):
    AUTHORIZATION_CODE = "authorization_code"
    IMPLICIT = "implicit"
    CLIENT_CREDENTIALS = "client_credentials"
    DEVICE_CODE = "device_code"


class AuthConfig:
    """Complete OAuth 2.1 / OpenID Connect configuration for a single integration."""

    def __init__(  # noqa: PLR0913, PLR0917
        self,
        app_name: str,
        app_type: AppType,
        provider: IdentityProvider,
        redirect_uri: str,
        scopes: list[str],
        flow: OAuthFlow,
        stack: FrontendStack,
        pkce: bool = True,
        custom_issuer: str | None = None,
        custom_authorization_url: str | None = None,
        custom_token_url: str | None = None,
        custom_userinfo_url: str | None = None,
        description: str = "",
    ) -> None:
        self.app_name = app_name
        self.app_type = app_type
        self.provider = provider
        self.redirect_uri = redirect_uri
        self.scopes = scopes
        self.flow = flow
        self.stack = stack
        self.pkce = pkce
        self.custom_issuer = custom_issuer
        self.custom_authorization_url = custom_authorization_url
        self.custom_token_url = custom_token_url
        self.custom_userinfo_url = custom_userinfo_url
        self.description = description

    def to_dict(self) -> dict[str, Any]:
        return {
            "app_name": self.app_name,
            "app_type": self.app_type.value,
            "provider": self.provider.value,
            "redirect_uri": self.redirect_uri,
            "scopes": self.scopes,
            "flow": self.flow.value,
            "stack": self.stack.value,
            "pkce": self.pkce,
            "custom_issuer": self.custom_issuer,
            "custom_authorization_url": self.custom_authorization_url,
            "custom_token_url": self.custom_token_url,
            "custom_userinfo_url": self.custom_userinfo_url,
            "description": self.description,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AuthConfig:
        return cls(
            app_name=data.get("app_name", "My App"),
            app_type=AppType(data.get("app_type", "spa")),
            provider=IdentityProvider(data.get("provider", "google")),
            redirect_uri=data.get("redirect_uri", "http://localhost:3000/callback"),
            scopes=data.get("scopes", ["openid", "profile", "email"]),
            flow=OAuthFlow(data.get("flow", "authorization_code")),
            stack=FrontendStack(data.get("stack", "react")),
            pkce=data.get("pkce", True),
            custom_issuer=data.get("custom_issuer"),
            custom_authorization_url=data.get("custom_authorization_url"),
            custom_token_url=data.get("custom_token_url"),
            custom_userinfo_url=data.get("custom_userinfo_url"),
            description=data.get("description", ""),
        )


class GeneratedFile:
    """A single generated file with name, content, and explanation."""

    def __init__(
        self,
        name: str,
        content: str,
        description: str,
        mime_type: str = "text/plain",
    ) -> None:
        self.name = name
        self.content = content
        self.description = description
        self.mime_type = mime_type

    def to_dict(self) -> dict[str, str]:
        return {
            "name": self.name,
            "content": self.content,
            "description": self.description,
            "mime_type": self.mime_type,
        }

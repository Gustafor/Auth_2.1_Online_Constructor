"""Code snippet generator using Jinja2 templates."""

from __future__ import annotations

from pathlib import Path
from typing import ClassVar

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.models import AuthConfig, FrontendStack


class SnippetGenerator:
    """Generates framework-specific OAuth integration code snippets."""

    TEMPLATE_MAP: ClassVar[dict[FrontendStack, str]] = {
        FrontendStack.REACT: "react.tsx.j2",
        FrontendStack.VUE: "vue.ts.j2",
        FrontendStack.NEXTJS: "nextjs.ts.j2",
        FrontendStack.FASTAPI: "fastapi.py.j2",
        FrontendStack.EXPRESS: "express.js.j2",
        FrontendStack.PHP: "php.php.j2",
        FrontendStack.GO: "go.go.j2",
    }

    def __init__(self, template_dir: str | Path | None = None) -> None:
        if template_dir is None:
            template_dir = Path(__file__).parent / "templates"
        self.env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=select_autoescape(["html", "xml"]),
            keep_trailing_newline=True,
        )

    def generate(self, config: AuthConfig) -> dict[str, str]:
        """Generate code snippet for the given configuration.

        Returns:
            Dict mapping filename to generated code content.
        """
        template_name = self.TEMPLATE_MAP.get(config.stack)
        if template_name is None:
            raise ValueError(f"No template for stack: {config.stack}")

        template = self.env.get_template(template_name)

        auth_url, token_url = self._provider_urls(config)

        content = template.render(
            app_name=config.app_name,
            provider=config.provider.value,
            provider_upper=config.provider.value.upper(),
            redirect_uri=config.redirect_uri,
            scopes=",".join(config.scopes),
            pkce=config.pkce,
            flow=config.flow.value,
            authorization_url=auth_url,
            token_url=token_url,
        )

        extension = self._extension_for_stack(config.stack)
        filename = f"oauth_client{extension}"

        return {filename: content}

    def _provider_urls(self, config: AuthConfig) -> tuple[str, str]:
        auth_defaults = {
            "google": "https://accounts.google.com/o/oauth2/v2/auth",
            "github": "https://github.com/login/oauth/authorize",
            "yandex": "https://oauth.yandex.ru/authorize",
            "vk": "https://oauth.vk.com/authorize",
            "custom_oidc": "https://example.com/oauth2/authorize",
        }
        token_defaults = {
            "google": "https://oauth2.googleapis.com/token",
            "github": "https://github.com/login/oauth/access_token",
            "yandex": "https://oauth.yandex.ru/token",
            "vk": "https://oauth.vk.com/access_token",
            "custom_oidc": "https://example.com/oauth2/token",
        }
        auth_url = config.custom_authorization_url or auth_defaults.get(
            config.provider.value, "https://example.com/oauth2/authorize"
        )
        token_url = config.custom_token_url or token_defaults.get(
            config.provider.value, "https://example.com/oauth2/token"
        )
        return auth_url, token_url

    def _extension_for_stack(self, stack: FrontendStack) -> str:
        ext_map = {
            FrontendStack.REACT: ".tsx",
            FrontendStack.VUE: ".ts",
            FrontendStack.NEXTJS: ".ts",
            FrontendStack.FASTAPI: ".py",
            FrontendStack.EXPRESS: ".js",
            FrontendStack.PHP: ".php",
            FrontendStack.GO: ".go",
        }
        return ext_map.get(stack, ".txt")

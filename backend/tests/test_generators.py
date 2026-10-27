"""Tests for OAuth config generators."""

from app.generators.config_generator import ConfigGenerator
from app.generators.snippet_generator import SnippetGenerator
from app.models import AppType, AuthConfig, FrontendStack, IdentityProvider, OAuthFlow


def test_config_generator_env() -> None:
    config = AuthConfig(
        app_name="Test App",
        app_type=AppType.SPA,
        provider=IdentityProvider.GOOGLE,
        redirect_uri="http://localhost:3000/callback",
        scopes=["openid", "profile", "email"],
        flow=OAuthFlow.AUTHORIZATION_CODE,
        stack=FrontendStack.REACT,
        pkce=True,
    )
    cg = ConfigGenerator()
    env = cg.generate_env(config)
    assert "APP_NAME=Test App" in env
    assert "OAUTH_PROVIDER=google" in env
    assert "OAUTH_PKCE=true" in env
    assert "GOOGLE_CLIENT_ID=your_client_id" in env


def test_config_generator_client_secrets() -> None:
    config = AuthConfig(
        app_name="Test App",
        app_type=AppType.SPA,
        provider=IdentityProvider.GOOGLE,
        redirect_uri="http://localhost:3000/callback",
        scopes=["openid"],
        flow=OAuthFlow.AUTHORIZATION_CODE,
        stack=FrontendStack.REACT,
        pkce=True,
    )
    cg = ConfigGenerator()
    secrets = cg.generate_client_secrets(config)
    assert "installed" in secrets
    assert "YOUR_CLIENT_ID" in secrets
    assert "http://localhost:3000/callback" in secrets


def test_config_generator_oauth_yaml() -> None:
    config = AuthConfig(
        app_name="Test App",
        app_type=AppType.WEB,
        provider=IdentityProvider.GITHUB,
        redirect_uri="https://example.com/callback",
        scopes=["user:email"],
        flow=OAuthFlow.AUTHORIZATION_CODE,
        stack=FrontendStack.EXPRESS,
        pkce=True,
    )
    cg = ConfigGenerator()
    yaml = cg.generate_oauth_yaml(config)
    assert "app_name: Test App" in yaml
    assert "provider: github" in yaml
    assert "pkce: true" in yaml


def test_snippet_generator_react() -> None:
    config = AuthConfig(
        app_name="Test App",
        app_type=AppType.SPA,
        provider=IdentityProvider.GOOGLE,
        redirect_uri="http://localhost:3000/callback",
        scopes=["openid", "profile", "email"],
        flow=OAuthFlow.AUTHORIZATION_CODE,
        stack=FrontendStack.REACT,
        pkce=True,
    )
    sg = SnippetGenerator()
    snippets = sg.generate(config)
    assert "oauth_client.tsx" in snippets
    content = snippets["oauth_client.tsx"]
    assert "createBrowserClient" in content
    assert "google" in content


def test_snippet_generator_fastapi() -> None:
    config = AuthConfig(
        app_name="Test App",
        app_type=AppType.WEB,
        provider=IdentityProvider.GOOGLE,
        redirect_uri="https://example.com/callback",
        scopes=["openid"],
        flow=OAuthFlow.AUTHORIZATION_CODE,
        stack=FrontendStack.FASTAPI,
        pkce=True,
    )
    sg = SnippetGenerator()
    snippets = sg.generate(config)
    assert "oauth_client.py" in snippets
    content = snippets["oauth_client.py"]
    assert "FastAPI" in content


def test_config_generator_all() -> None:
    config = AuthConfig(
        app_name="Test App",
        app_type=AppType.SPA,
        provider=IdentityProvider.GOOGLE,
        redirect_uri="http://localhost:3000/callback",
        scopes=["openid"],
        flow=OAuthFlow.AUTHORIZATION_CODE,
        stack=FrontendStack.REACT,
        pkce=True,
    )
    cg = ConfigGenerator()
    files = cg.generate_all(config)
    assert ".env" in files
    assert "client_secrets.json" in files
    assert "oauth.yaml" in files

"""Tests for OAuth validator."""

from app.models import AppType, AuthConfig, FrontendStack, IdentityProvider, OAuthFlow
from app.validators.oauth_validator import OAuthValidator


def test_validator_valid_spa() -> None:
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
    v = OAuthValidator()
    assert v.is_valid(config)
    assert len(v.validate(config)) == 0


def test_validator_spa_without_pkce() -> None:
    config = AuthConfig(
        app_name="Test App",
        app_type=AppType.SPA,
        provider=IdentityProvider.GOOGLE,
        redirect_uri="http://localhost:3000/callback",
        scopes=["openid"],
        flow=OAuthFlow.AUTHORIZATION_CODE,
        stack=FrontendStack.REACT,
        pkce=False,
    )
    v = OAuthValidator()
    errors = v.validate(config)
    assert len(errors) == 1
    assert errors[0].field == "pkce"


def test_validator_http_non_localhost() -> None:
    config = AuthConfig(
        app_name="Test App",
        app_type=AppType.WEB,
        provider=IdentityProvider.GOOGLE,
        redirect_uri="http://example.com/callback",
        scopes=["openid"],
        flow=OAuthFlow.AUTHORIZATION_CODE,
        stack=FrontendStack.REACT,
        pkce=True,
    )
    v = OAuthValidator()
    errors = v.validate(config)
    assert len(errors) == 1
    assert errors[0].field == "redirect_uri"


EXPECTED_CUSTOM_OIDC_ERRORS = 3


def test_validator_custom_oidc_no_urls() -> None:
    config = AuthConfig(
        app_name="Test App",
        app_type=AppType.WEB,
        provider=IdentityProvider.CUSTOM_OIDC,
        redirect_uri="http://localhost:3000/callback",
        scopes=["openid"],
        flow=OAuthFlow.AUTHORIZATION_CODE,
        stack=FrontendStack.REACT,
        pkce=True,
    )
    v = OAuthValidator()
    errors = v.validate(config)
    assert len(errors) == EXPECTED_CUSTOM_OIDC_ERRORS
    fields = {e.field for e in errors}
    assert "custom_issuer" in fields
    assert "custom_authorization_url" in fields
    assert "custom_token_url" in fields


def test_validator_client_credentials_non_server() -> None:
    config = AuthConfig(
        app_name="Test App",
        app_type=AppType.SPA,
        provider=IdentityProvider.GOOGLE,
        redirect_uri="https://example.com/callback",
        scopes=[],
        flow=OAuthFlow.CLIENT_CREDENTIALS,
        stack=FrontendStack.REACT,
        pkce=False,
    )
    v = OAuthValidator()
    errors = v.validate(config)
    fields = {e.field for e in errors}
    assert "flow" in fields

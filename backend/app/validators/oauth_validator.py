"""OAuth 2.1 / OpenID Connect configuration validators."""

from __future__ import annotations

import re
from typing import ClassVar

from app.models import AppType, AuthConfig, IdentityProvider, OAuthFlow


class ValidationError(Exception):
    """Raised when OAuth configuration validation fails."""

    def __init__(self, field: str, message: str) -> None:
        self.field = field
        self.message = message
        super().__init__(f"{field}: {message}")


class OAuthValidator:
    """Validates OAuth 2.1 / OpenID Connect configuration.

    Checks redirect URI format, scopes, PKCE requirement for public clients,
    and provider-specific constraints.
    """

    # Allowed URI schemes per OAuth 2.1 / RFC 8252
    ALLOWED_SCHEMES: ClassVar[set[str]] = {"https", "http"}

    # Reserved redirect URIs per RFC 8252
    RESERVED_URIS: ClassVar[set[str]] = {
        "urn:ietf:wg:oauth:2.0:oob",
        "urn:ietf:wg:oauth:2.0:oob:auto",
    }

    # Common scope sets per provider
    PROVIDER_DEFAULT_SCOPES: ClassVar[dict[str, list[str]]] = {
        "google": ["openid", "profile", "email"],
        "github": ["user:email"],
        "yandex": ["login:email", "login:avatar", "login:name"],
        "vk": ["email"],
        "custom_oidc": ["openid", "profile", "email"],
    }

    def validate(self, config: AuthConfig) -> list[ValidationError]:
        """Run all validation checks on the configuration.

        Returns:
            List of ValidationError objects (empty if valid).
        """
        errors: list[ValidationError] = []

        errors.extend(self._validate_redirect_uri(config))
        errors.extend(self._validate_scopes(config))
        errors.extend(self._validate_pkce(config))
        errors.extend(self._validate_provider_specific(config))
        errors.extend(self._validate_flow_app_type_compatibility(config))

        return errors

    def is_valid(self, config: AuthConfig) -> bool:
        """Return True if the configuration passes all validation checks."""
        return len(self.validate(config)) == 0

    def _validate_redirect_uri(self, config: AuthConfig) -> list[ValidationError]:
        errors: list[ValidationError] = []

        uri = config.redirect_uri.strip()
        if not uri:
            errors.append(ValidationError("redirect_uri", "Redirect URI is required"))
            return errors

        # Check for reserved URIs (allowed for native/CLI per RFC 8252)
        if uri in self.RESERVED_URIS:
            if config.app_type not in (AppType.NATIVE, AppType.CLI):
                errors.append(
                    ValidationError(
                        "redirect_uri",
                        f"Reserved URI '{uri}' is only allowed for native or CLI applications",
                    )
                )
            return errors

        # Parse and validate scheme
        try:
            scheme = uri.split("://", 1)[0].lower()
        except IndexError:
            errors.append(
                ValidationError(
                    "redirect_uri",
                    "Redirect URI must include a scheme (http or https)",
                )
            )
            return errors

        if scheme not in self.ALLOWED_SCHEMES:
            errors.append(
                ValidationError(
                    "redirect_uri",
                    f"Redirect URI scheme '{scheme}' is not allowed. Use http or https.",
                )
            )

        # http is only allowed for localhost (development)
        if scheme == "http" and not self._is_localhost(uri):
            errors.append(
                ValidationError(
                    "redirect_uri",
                    "HTTP redirect URIs are only allowed for localhost",
                ),
            )

        # No fragments allowed in redirect URI
        if "#" in uri:
            errors.append(
                ValidationError("redirect_uri", "Redirect URI must not contain a fragment (#)")
            )

        return errors

    def _validate_scopes(self, config: AuthConfig) -> list[ValidationError]:
        errors: list[ValidationError] = []

        if not config.scopes:
            errors.append(ValidationError("scopes", "At least one scope is required"))
            return errors

        # Validate scope format (no spaces, valid characters)
        for scope in config.scopes:
            if not re.match(r"^[a-zA-Z0-9._:-]+$", scope):
                errors.append(
                    ValidationError("scopes", f"Invalid scope format: '{scope}'")
                )

        return errors

    def _validate_pkce(self, config: AuthConfig) -> list[ValidationError]:
        errors: list[ValidationError] = []

        # PKCE is required for public clients (SPA, native, CLI) in OAuth 2.1
        public_client_types = {AppType.SPA, AppType.NATIVE, AppType.CLI}
        if config.app_type in public_client_types and not config.pkce:
            errors.append(
                ValidationError(
                    "pkce",
                    "PKCE is required for public clients (SPA, native, CLI) in OAuth 2.1",
                )
            )

        return errors

    def _validate_provider_specific(self, config: AuthConfig) -> list[ValidationError]:
        errors: list[ValidationError] = []

        # Custom OIDC requires custom URLs
        if config.provider == IdentityProvider.CUSTOM_OIDC:
            if not config.custom_issuer:
                errors.append(
                    ValidationError(
                        "custom_issuer",
                        "Custom OIDC provider requires an issuer URL",
                    )
                )
            if not config.custom_authorization_url:
                errors.append(
                    ValidationError(
                        "custom_authorization_url",
                        "Custom OIDC provider requires an authorization URL",
                    )
                )
            if not config.custom_token_url:
                errors.append(
                    ValidationError(
                        "custom_token_url",
                        "Custom OIDC provider requires a token URL",
                    )
                )

        return errors

    def _validate_flow_app_type_compatibility(
        self, config: AuthConfig
    ) -> list[ValidationError]:
        errors: list[ValidationError] = []

        # Client credentials flow is only for server-to-server (confidential clients)
        if config.flow == OAuthFlow.CLIENT_CREDENTIALS and config.app_type != AppType.SERVER_SERVER:
            errors.append(
                ValidationError(
                    "flow",
                    "Client credentials flow is only available for server-to-server applications",
                )
            )

        # Implicit flow is not recommended for OAuth 2.1 but allowed for SPA
        if config.flow == OAuthFlow.IMPLICIT and config.app_type not in (
            AppType.SPA,
            AppType.WEB,
        ):
            errors.append(
                ValidationError(
                    "flow",
                    "Implicit flow is only suitable for SPA or web applications",
                )
            )

        return errors

    def _is_localhost(self, uri: str) -> bool:
        """Check if a URI points to localhost."""
        localhost_patterns = ["localhost", "127.0.0.1", "0.0.0.0", "::1"]
        return any(pattern in uri for pattern in localhost_patterns)

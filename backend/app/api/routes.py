"""API routes for OAuth 2.1 constructor."""

from __future__ import annotations

import base64
import io
import zipfile
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import load_config
from app.generators.config_generator import ConfigGenerator
from app.generators.snippet_generator import SnippetGenerator
from app.models import AuthConfig
from app.validators import OAuthValidator

router = APIRouter()

config = load_config()
config_generator = ConfigGenerator()
snippet_generator = SnippetGenerator()
oauth_validator = OAuthValidator()


class GenerateRequest(BaseModel):
    app_name: str = Field(default="My App", min_length=1, max_length=100)
    app_type: str = Field(default="spa")
    provider: str = Field(default="google")
    redirect_uri: str = Field(default="http://localhost:3000/callback")
    scopes: list[str] = Field(default=["openid", "profile", "email"])
    flow: str = Field(default="authorization_code")
    stack: str = Field(default="react")
    pkce: bool = Field(default=True)
    custom_issuer: str | None = None
    custom_authorization_url: str | None = None
    custom_token_url: str | None = None
    custom_userinfo_url: str | None = None
    description: str = Field(default="")


class GeneratedFileOut(BaseModel):
    name: str
    content: str
    description: str
    mime_type: str = "text/plain"


class GenerateResponse(BaseModel):
    files: list[GeneratedFileOut]
    validation_errors: list[dict[str, str]] = []


class ValidateRequest(BaseModel):
    app_name: str = Field(default="My App")
    app_type: str = Field(default="spa")
    provider: str = Field(default="google")
    redirect_uri: str = Field(default="http://localhost:3000/callback")
    scopes: list[str] = Field(default=["openid", "profile", "email"])
    flow: str = Field(default="authorization_code")
    stack: str = Field(default="react")
    pkce: bool = Field(default=True)
    custom_issuer: str | None = None
    custom_authorization_url: str | None = None
    custom_token_url: str | None = None
    custom_userinfo_url: str | None = None


class ValidationErrorOut(BaseModel):
    field: str
    message: str


class ValidateResponse(BaseModel):
    valid: bool
    errors: list[ValidationErrorOut] = []


class ZipResponse(BaseModel):
    download_url: str
    file_count: int


@router.post("/generate", response_model=GenerateResponse)
async def generate_config(request: GenerateRequest) -> GenerateResponse:
    """Generate OAuth configuration files and code snippets."""
    try:
        auth_config = AuthConfig.from_dict(request.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Validate configuration
    validation_errors = oauth_validator.validate(auth_config)
    error_dicts = [{"field": e.field, "message": e.message} for e in validation_errors]

    # Generate config files
    config_files = config_generator.generate_all(auth_config)

    # Generate code snippet
    snippet_files = snippet_generator.generate(auth_config)

    # Combine all files
    all_files: dict[str, str] = {}
    all_files.update(config_files)
    all_files.update(snippet_files)

    # Add integration instructions
    all_files["INTEGRATION.md"] = _generate_integration_md(auth_config)

    file_outs = []
    for name, content in all_files.items():
        description = _file_description(name)
        mime_type = _mime_type(name)
        file_outs.append(
            GeneratedFileOut(
                name=name,
                content=content,
                description=description,
                mime_type=mime_type,
            )
        )

    return GenerateResponse(files=file_outs, validation_errors=error_dicts)


@router.post("/validate", response_model=ValidateResponse)
async def validate_config(request: ValidateRequest) -> ValidateResponse:
    """Validate OAuth configuration without generating files."""
    try:
        auth_config = AuthConfig.from_dict(request.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    validation_errors = oauth_validator.validate(auth_config)
    error_outs = [
        ValidationErrorOut(field=e.field, message=e.message)
        for e in validation_errors
    ]

    return ValidateResponse(valid=len(error_outs) == 0, errors=error_outs)


@router.post("/zip", response_model=ZipResponse)
async def export_zip(request: GenerateRequest) -> ZipResponse:
    """Generate all files and return a ZIP archive download URL."""
    try:
        auth_config = AuthConfig.from_dict(request.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    config_files = config_generator.generate_all(auth_config)
    snippet_files = snippet_generator.generate(auth_config)

    all_files: dict[str, str] = {}
    all_files.update(config_files)
    all_files.update(snippet_files)
    all_files["INTEGRATION.md"] = _generate_integration_md(auth_config)

    # Build ZIP in memory
    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in all_files.items():
            zf.writestr(name, content)

    buffer.seek(0)

    # In a production deployment, store the buffer and return a signed URL.
    # For this constructor, we return the base64-encoded ZIP so the frontend
    # can download it directly. The actual file serving is handled by the
    # frontend converting base64 to a blob URL.
    zip_b64 = base64.b64encode(buffer.read()).decode("ascii")

    return ZipResponse(
        download_url=f"data:application/zip;base64,{zip_b64}",
        file_count=len(all_files),
    )


@router.get("/providers")
async def list_providers() -> dict[str, list[str]]:
    """List supported identity providers."""
    return {"providers": config.supported_providers}


@router.get("/app-types")
async def list_app_types() -> dict[str, list[str]]:
    """List supported application types."""
    return {"app_types": config.supported_app_types}


@router.get("/stacks")
async def list_stacks() -> dict[str, list[str]]:
    """List supported frontend stacks."""
    return {"stacks": config.supported_stacks}


def _file_description(name: str) -> str:
    descriptions = {
        ".env": "Environment variables for OAuth credentials and endpoints",
        "client_secrets.json": "Client secrets configuration (Google-style format)",
        "oauth.yaml": "YAML configuration for OAuth client setup",
        "INTEGRATION.md": "Step-by-step integration instructions",
    }
    ext_map = {
        ".tsx": "React OAuth client component",
        ".ts": "Vue 3 OAuth client",
        ".py": "FastAPI OAuth client",
        ".js": "Express OAuth client",
        ".php": "PHP OAuth client",
        ".go": "Go OAuth client",
    }
    if "nextjs" in name.lower():
        return "Next.js OAuth route handler"
    for ext, desc in ext_map.items():
        if name.endswith(ext):
            return desc
    return descriptions.get(name, "Generated file")


def _mime_type(name: str) -> str:
    mime_map = {
        ".json": "application/json",
        ".yaml": "application/yaml",
        ".yml": "application/yaml",
        ".md": "text/markdown",
        ".tsx": "text/typescript",
        ".ts": "text/typescript",
        ".py": "text/x-python",
        ".js": "application/javascript",
        ".php": "application/x-httpd-php",
        ".go": "text/x-go",
    }
    for ext, mime in mime_map.items():
        if name.endswith(ext):
            return mime
    return "text/plain"


def _generate_integration_md(config: AuthConfig) -> str:
    """Generate INTEGRATION.md instructions."""
    provider_display = {
        "google": "Google",
        "github": "GitHub",
        "yandex": "Яндекс",
        "vk": "VK",
        "custom_oidc": "Custom OIDC",
    }.get(config.provider.value, config.provider.value)

    lines = [
        f"# Integration Instructions: {config.app_name}",
        "",
        "## Overview",
        "",
        "This package contains OAuth 2.1 / OpenID Connect integration files",
        f"for {provider_display}.",
        f"Application type: {config.app_type.value}",
        f"Frontend stack: {config.stack.value}",
        f"OAuth flow: {config.flow.value}",
        f"PKCE: {'enabled' if config.pkce else 'disabled'}",
        "",
        "## Files Included",
        "",
        "- `.env` — Environment variables with OAuth endpoints and placeholder credentials",
        "- `client_secrets.json` — Client secrets configuration",
        "- `oauth.yaml` — YAML configuration",
        f"- `oauth_client` — Code snippet for {config.stack.value}",
        "",
        "## Step 1: Register your application",
        "",
        f"1. Go to the {provider_display} developer console",
        "2. Create a new OAuth application",
        f"3. Set the redirect URI to: {config.redirect_uri}",
        "4. Copy the Client ID and Client Secret",
        "",
        "## Step 2: Configure environment variables",
        "",
        "1. Copy `.env.example` to `.env`",
        "2. Replace `YOUR_CLIENT_ID` and `YOUR_CLIENT_SECRET` with your actual values",
        "3. Update any other endpoints if using a custom OIDC provider",
        "",
        "## Step 3: Integrate the code snippet",
        "",
        f"1. Copy `oauth_client` into your {config.stack.value} project",
        "2. Import and initialize the OAuth client",
        "3. Add login and callback routes",
        "",
        "## Step 4: Test the integration",
        "",
        "1. Start your application",
        "2. Navigate to the login route",
        "3. Complete the OAuth authorization flow",
        "4. Verify the access token is received",
        "",
        "## Security Notes",
        "",
        "- Never commit `.env` or `client_secrets.json` with real credentials to version control",
        "- Use HTTPS for all redirect URIs in production",
        "- Keep client secrets confidential",
        "",
        f"Generated by Auth-2.1 Constructor on {datetime.now(UTC).isoformat()}",
        "",
    ]
    return "\n".join(lines)

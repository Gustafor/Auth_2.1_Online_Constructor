# Auth-2.1 API Reference

## Base URL

`http://127.0.0.1:8000/api`

## Endpoints

### GET /health

Health check.

**Response:**
```json
{"status": "ok", "version": "0.1.0"}
```

### GET /providers

List supported identity providers.

**Response:**
```json
{"providers": ["google", "github", "yandex", "vk", "custom_oidc"]}
```

### GET /app-types

List supported application types.

**Response:**
```json
{"app_types": ["spa", "web", "native", "cli", "server_server"]}
```

### GET /stacks

List supported frontend stacks.

**Response:**
```json
{"stacks": ["react", "vue", "nextjs", "fastapi", "express", "php", "go"]}
```

### POST /validate

Validate OAuth configuration without generating files.

**Request:**
```json
{
  "app_name": "My App",
  "app_type": "spa",
  "provider": "google",
  "redirect_uri": "http://localhost:3000/callback",
  "scopes": ["openid", "profile", "email"],
  "flow": "authorization_code",
  "stack": "react",
  "pkce": true
}
```

**Response:**
```json
{"valid": true, "errors": []}
```

### POST /generate

Generate OAuth configuration files and code snippets.

**Request:** Same as `/validate`

**Response:**
```json
{
  "files": [
    {
      "name": ".env",
      "content": "...",
      "description": "Environment variables...",
      "mime_type": "text/plain"
    },
    {
      "name": "client_secrets.json",
      "content": "...",
      "description": "Client secrets configuration",
      "mime_type": "application/json"
    },
    {
      "name": "oauth.yaml",
      "content": "...",
      "description": "YAML configuration",
      "mime_type": "application/yaml"
    },
    {
      "name": "oauth_client.tsx",
      "content": "...",
      "description": "React OAuth client component",
      "mime_type": "text/typescript"
    },
    {
      "name": "INTEGRATION.md",
      "content": "...",
      "description": "Step-by-step integration instructions",
      "mime_type": "text/markdown"
    }
  ],
  "validation_errors": []
}
```

### POST /zip

Generate all files and return a base64-encoded ZIP archive.

**Request:** Same as `/validate`

**Response:**
```json
{
  "download_url": "data:application/zip;base64,...",
  "file_count": 5
}
```

## Validation Rules

- Redirect URI must use http or https scheme
- HTTP redirect URIs only allowed for localhost
- PKCE required for public clients (SPA, native, CLI)
- Custom OIDC requires issuer, authorization, and token URLs
- Client credentials flow only for server-to-server apps
- At least one scope required

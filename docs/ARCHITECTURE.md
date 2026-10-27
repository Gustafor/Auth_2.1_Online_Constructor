# Auth-2.1 Architecture

## Overview

Auth-2.1 is a web platform for generating OAuth 2.1 / OpenID Connect integration files. It consists of a Python/FastAPI backend and a React/TypeScript frontend.

## Backend Architecture

```
backend/
├── app/
│   ├── __init__.py          # Package marker
│   ├── main.py              # FastAPI app factory + routes
│   ├── config.py            # Environment configuration
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py        # REST API endpoints
│   ├── models/
│   │   ├── __init__.py
│   │   └── oauth_models.py  # Pydantic data models
│   ├── generators/
│   │   ├── __init__.py
│   │   ├── config_generator.py  # .env, client_secrets.json, oauth.yaml
│   │   ├── snippet_generator.py # Jinja2 code templates
│   │   └── templates/       # Jinja2 templates (7 stacks)
│   └── validators/
│       ├── __init__.py
│       └── oauth_validator.py # OAuth 2.1 / OIDC validation
├── tests/
│   ├── __init__.py
│   ├── test_generators.py
│   └── test_validator.py
└── ...
```

### Key Components

- **AuthConfig**: Central data model holding all OAuth parameters
- **ConfigGenerator**: Generates `.env`, `client_secrets.json`, `oauth.yaml`
- **SnippetGenerator**: Jinja2-based code generation for 7 stacks
- **OAuthValidator**: Validates against RFC 6749, RFC 8252, OIDC Core
- **API Routes**: `/api/generate`, `/api/validate`, `/api/zip`, `/api/providers`, `/api/app-types`, `/api/stacks`

## Frontend Architecture

```
frontend/
├── src/
│   ├── App.tsx              # Main wizard component (6 steps)
│   ├── main.tsx             # Entry point
│   ├── index.css            # Tailwind CSS
│   ├── types/index.ts       # TypeScript types + constants
│   ├── hooks/useOAuth.ts    # API client functions
│   └── utils/index.ts       # Utility functions
├── index.html
├── vite.config.ts           # Vite + proxy to backend
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### Wizard Steps

1. **App Type** — SPA, web, native, CLI, server-to-server
2. **Provider** — Google, GitHub, Yandex, VK, Custom OIDC
3. **OAuth Params** — App name, redirect URI, scopes, PKCE, custom URLs
4. **Stack** — React, Vue, Next.js, FastAPI, Express, PHP, Go
5. **Preview** — Configuration summary + file generation
6. **Export** — ZIP archive download

## Data Flow

1. User completes wizard steps in frontend
2. Frontend POSTs config to `/api/generate`
3. Backend validates config via OAuthValidator
4. Backend generates config files + code snippet
5. Frontend displays preview
6. User exports ZIP via `/api/zip` (base64 data URL)

## Security

- No secrets are stored or transmitted
- Client secrets are placeholders (YOUR_CLIENT_ID/YOUR_CLIENT_SECRET)
- PKCE enforced for public clients (SPA, native, CLI)
- HTTP redirect URIs only allowed for localhost
- No user registration or authentication

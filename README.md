# Auth-2.1 — OAuth 2.1 / OpenID Connect Online Constructor

Web platform for generating OAuth 2.1 / OpenID Connect integration files without prior Auth experience.

## Features

- Step-by-step configuration wizard with Russian-language tooltips
- Choose application type: SPA, web site, native, CLI, server-to-server
- Choose identity provider: Google, GitHub, Yandex, VK, custom OIDC
- Generate configuration files: `.env`, `client_secrets.json`, `oauth.yaml`
- Generate code snippets for: React, Vue, Next.js, Python/FastAPI, Node.js/Express, PHP, Go
- Validate configuration against OAuth 2.1 / OIDC specifications
- Export ZIP archive with all files and `INTEGRATION.md` instructions

## Stack

- **Backend:** Python 3.11, FastAPI, oauthlib, Jinja2, Pydantic
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Validation:** oauthlib, RFC 6749, RFC 8252 (PKCE), OpenID Connect Core

## Installation

### Backend

```bash
cd Auth-2.1

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
# or: pip install -e .

# Copy environment template
copy .env.example .env

# Run the server
python -m backend.app.main
# or: uvicorn backend.app.main:app --reload
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

## Usage

1. Start the backend server
2. Open the frontend in your browser (default: http://localhost:3000)
3. Follow the step-by-step wizard to configure your OAuth 2.1 integration
4. Download the ZIP archive with generated files and integration instructions

## Project Structure

```
Auth-2.1/
├── pyproject.toml
├── .env.example
├── .gitignore
├── README.md
├── requirements.txt
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/
│   │   ├── generators/
│   │   ├── validators/
│   │   └── templates/
│   ├── tests/
│   └── ...
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── utils/
│       ├── types/
│       └── App.tsx
├── prompts/
│   ├── PROMPT_TEMPLATE.md
│   ├── WORK_PLAN.md
│   └── CONTEXT_FOR_NEXT_MODEL.md
└── docs/
    ├── ARCHITECTURE.md
    └── API.md
```

## License

MIT

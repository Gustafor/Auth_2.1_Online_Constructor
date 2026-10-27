export type AppType = "spa" | "web" | "native" | "cli" | "server_server";

export type IdentityProvider = "google" | "github" | "yandex" | "vk" | "custom_oidc";

export type FrontendStack =
  | "react"
  | "vue"
  | "nextjs"
  | "fastapi"
  | "express"
  | "php"
  | "go";

export type OAuthFlow =
  | "authorization_code"
  | "implicit"
  | "client_credentials"
  | "device_code";

export interface OAuthConfig {
  app_name: string;
  app_type: AppType;
  provider: IdentityProvider;
  redirect_uri: string;
  scopes: string[];
  flow: OAuthFlow;
  stack: FrontendStack;
  pkce: boolean;
  custom_issuer?: string | null;
  custom_authorization_url?: string | null;
  custom_token_url?: string | null;
  custom_userinfo_url?: string | null;
  description?: string;
}

export interface GeneratedFile {
  name: string;
  content: string;
  description: string;
  mime_type: string;
}

export interface GenerateResponse {
  files: GeneratedFile[];
  validation_errors: Array<{ field: string; message: string }>;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidateResponse {
  valid: boolean;
  errors: ValidationError[];
}

export interface ZipResponse {
  download_url: string;
  file_count: number;
}

export const APP_TYPES: { value: AppType; label: string; description: string }[] = [
  { value: "spa", label: "SPA (одностраничное)", description: "React, Vue, Angular и similares" },
  { value: "web", label: "Веб-сайт", description: "Традиционный серверный рендеринг" },
  { value: "native", label: "Нативное приложение", description: "iOS, Android, desktop" },
  { value: "cli", label: "CLI инструмент", description: "Командная строка" },
  { value: "server_server", label: "Сервер-сервер", description: "Machine-to-machine (client credentials)" },
];

export const PROVIDERS: { value: IdentityProvider; label: string; description: string }[] = [
  { value: "google", label: "Google", description: "Google OAuth 2.0 / OIDC" },
  { value: "github", label: "GitHub", description: "GitHub OAuth Apps" },
  { value: "yandex", label: "Яндекс", description: "Яндекс OAuth" },
  { value: "vk", label: "VK", description: "VK ID / VK OAuth" },
  { value: "custom_oidc", label: "Custom OIDC", description: "Свой OpenID Connect провайдер" },
];

export const STACKS: { value: FrontendStack; label: string; description: string }[] = [
  { value: "react", label: "React", description: "React + Vite + TypeScript" },
  { value: "vue", label: "Vue 3", description: "Vue 3 + Composition API" },
  { value: "nextjs", label: "Next.js", description: "Next.js App Router" },
  { value: "fastapi", label: "FastAPI", description: "Python FastAPI" },
  { value: "express", label: "Express.js", description: "Node.js Express" },
  { value: "php", label: "PHP", description: "Чистый PHP (без фреймворка)" },
  { value: "go", label: "Go", description: "Go net/http" },
];

export const DEFAULT_SCOPES: Record<IdentityProvider, string[]> = {
  google: ["openid", "profile", "email"],
  github: ["user:email"],
  yandex: ["login:email", "login:avatar", "login:name"],
  vk: ["email"],
  custom_oidc: ["openid", "profile", "email"],
};

export const WIZARD_STEPS = [
  { id: "app-type", label: "Тип приложения", index: 1 },
  { id: "provider", label: "Провайдер", index: 2 },
  { id: "oauth-params", label: "Параметры OAuth", index: 3 },
  { id: "stack", label: "Стек технологий", index: 4 },
  { id: "preview", label: "Предпросмотр", index: 5 },
  { id: "export", label: "Экспорт", index: 6 },
] as const;

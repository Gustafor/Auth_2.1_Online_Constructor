import { useState, useCallback } from "react";
import { ChevronRight, ChevronLeft, Mail, Lock, Code, Download, AlertTriangle, Info } from "lucide-react";
import {
  OAuthConfig,
  APP_TYPES,
  PROVIDERS,
  STACKS,
  DEFAULT_SCOPES,
  GenerateResponse,
  ZipResponse,
} from "@/types";
import { validateConfig, generateConfig, exportZip } from "@/hooks/useOAuth";
import { cn, downloadBase64Zip } from "@/utils";

const STEP_ORDER: readonly string[] = ["app-type", "provider", "oauth-params", "stack", "preview", "export"];

const INITIAL_CONFIG: OAuthConfig = {
  app_name: "My Application",
  app_type: "spa",
  provider: "google",
  redirect_uri: "http://localhost:3000/callback",
  scopes: [...DEFAULT_SCOPES.google],
  flow: "authorization_code",
  stack: "react",
  pkce: true,
};

export default function App() {
  const [stepIndex, setStepIndex] = useState(0);
  const [config, setConfig] = useState<OAuthConfig>(INITIAL_CONFIG);
  const [validation, setValidation] = useState<{ valid: boolean; errors: Array<{ field: string; message: string }> }>({ valid: true, errors: [] });
  const [generated, setGenerated] = useState<GenerateResponse | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportedZip, setExportedZip] = useState<ZipResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentStepId = STEP_ORDER[stepIndex];

  const nextStep = useCallback(() => {
    if (stepIndex < STEP_ORDER.length - 1) setStepIndex(i => i + 1);
  }, [stepIndex]);

  const prevStep = useCallback(() => {
    if (stepIndex > 0) setStepIndex(i => i - 1);
  }, [stepIndex]);

  const updateConfig = useCallback((patch: Partial<OAuthConfig>) => {
    setConfig(c => ({ ...c, ...patch }));
    setError(null);
  }, []);

  const handleValidate = useCallback(async () => {
    try {
      const result = await validateConfig(config);
      setValidation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation error");
    }
  }, [config]);

  const handleGenerate = useCallback(async () => {
    try {
      const result = await generateConfig(config);
      setGenerated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation error");
    }
  }, [config]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const result = await exportZip(config);
      setExportedZip(result);
      if (result.download_url.startsWith("data:")) {
        const filename = `oauth_config_${config.app_name.toLowerCase().replace(/\s+/g, "_")}.zip`;
        downloadBase64Zip(result.download_url, filename);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export error");
    } finally {
      setExporting(false);
    }
  }, [config]);

  const isLastStep = stepIndex === STEP_ORDER.length - 1;
  const progress = ((stepIndex + 1) / STEP_ORDER.length) * 100;

  const StepLabelMap: Record<string, string> = {
    "app-type": "Тип приложения",
    provider: "Провайдер",
    "oauth-params": "Параметры OAuth",
    stack: "Стек технологий",
    preview: "Предпросмотр",
    export: "Экспорт",
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                O
              </div>
              <span className="font-semibold text-lg tracking-tight">Auth-2.1</span>
              <span className="text-xs text-gray-600 ml-1">Constructor</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-600">
              {STEP_ORDER.map((id, i) => (
                <span
                  key={id}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded",
                    i === stepIndex
                      ? "bg-primary text-primary-foreground"
                      : i < stepIndex
                      ? "bg-gray-100 text-gray-600"
                      : "text-gray-600",
                  )}
                >
                  {i < stepIndex && <Checkmark />}
                  {StepLabelMap[id]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
            {stepIndex + 1}
          </div>
          <div>
            <h1 className="text-xl font-semibold">{StepLabelMap[currentStepId]}</h1>
            <p className="text-sm text-gray-600">
              Шаг {stepIndex + 1} из {STEP_ORDER.length}
            </p>
          </div>
          <div className="ml-auto w-1/3">
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded border border-destructive bg-destructive/10 text-destructive flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {currentStepId === "app-type" && (
          <AppTypeStep config={config} onUpdate={updateConfig} onNext={nextStep} />
        )}
        {currentStepId === "provider" && (
          <ProviderStep config={config} onUpdate={updateConfig} onNext={nextStep} onPrev={prevStep} />
        )}
        {currentStepId === "oauth-params" && (
          <OAuthParamsStep
            config={config}
            onUpdate={updateConfig}
            onNext={nextStep}
            onPrev={prevStep}
            onValidate={handleValidate}
            validation={validation}
          />
        )}
        {currentStepId === "stack" && (
          <StackStep config={config} onUpdate={updateConfig} onNext={nextStep} onPrev={prevStep} />
        )}
        {currentStepId === "preview" && (
          <PreviewStep config={config} onNext={nextStep} onPrev={prevStep} onGenerate={handleGenerate} generated={generated} />
        )}
        {currentStepId === "export" && (
          <ExportStep onPrev={prevStep} onExport={handleExport} exporting={exporting} exportedZip={exportedZip} generated={generated} />
        )}
      </main>

      <div className="fixed bottom-4 right-4">
        {!isLastStep && (
          <button
            onClick={nextStep}
            disabled={currentStepId === "oauth-params" && !validation.valid}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-lg"
          >
            Далее <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {isLastStep && (
          <button
            onClick={handleGenerate}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-lg"
          >
            Сгенерировать файлы <Code className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function Checkmark() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function AppTypeStep({ config, onUpdate, onNext }: { config: OAuthConfig; onUpdate: (p: Partial<OAuthConfig>) => void; onNext: () => void }) {
  return (
    <div className="space-y-6">
      <p className="text-gray-600">
        Выберите тип приложения, которое будет использовать OAuth 2.1. Это влияет на требования к PKCE и доступные потоки.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {APP_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => onUpdate({ app_type: t.value })}
            className={cn(
              "p-4 rounded-lg border transition-colors text-left",
              config.app_type === t.value
                ? "bg-primary border-primary text-primary-foreground"
                : "border-gray-300 hover:bg-gray-100",
            )}
          >
            <div className="font-medium">{t.label}</div>
            <div className="text-xs text-gray-600 mt-1">{t.description}</div>
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <button onClick={onNext} className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
          Далее <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>
    </div>
  );
}

function ProviderStep({ config, onUpdate, onNext, onPrev }: { config: OAuthConfig; onUpdate: (p: Partial<OAuthConfig>) => void; onNext: () => void; onPrev: () => void }) {
  return (
    <div className="space-y-6">
      <p className="text-gray-600">
        Выберите поставщика удостоверений (IdP). Для кастомного OIDC укажите свои URL в следующем шаге.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROVIDERS.map((p) => (
          <button
            key={p.value}
            onClick={() => onUpdate({ provider: p.value, scopes: [...(DEFAULT_SCOPES as Record<string, string[]>)[p.value]] })}
            className={cn(
              "p-4 rounded-lg border transition-colors text-left",
              config.provider === p.value
                ? "bg-primary border-primary text-primary-foreground"
                : "border-gray-300 hover:bg-gray-100",
            )}
          >
            <div className="font-medium">{p.label}</div>
            <div className="text-xs text-gray-600 mt-1">{p.description}</div>
          </button>
        ))}
      </div>
      <div className="flex justify-between">
        <button onClick={onPrev} className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-100">
          <ChevronLeft className="w-4 h-4 mr-1" /> Назад
        </button>
        <button onClick={onNext} className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
          Далее <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>
    </div>
  );
}

function OAuthParamsStep({
  config,
  onUpdate,
  onNext,
  onPrev,
  onValidate,
  validation,
}: {
  config: OAuthConfig;
  onUpdate: (p: Partial<OAuthConfig>) => void;
  onNext: () => void;
  onPrev: () => void;
  onValidate: () => void;
  validation: { valid: boolean; errors: Array<{ field: string; message: string }> };
}) {
  const isCustom = config.provider === "custom_oidc";
  const isPublicClient = ["spa", "native", "cli"].includes(config.app_type);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2">Название приложения</label>
          <input
            value={config.app_name}
            onChange={e => onUpdate({ app_name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Redirect URI</label>
          <input
            value={config.redirect_uri}
            onChange={e => onUpdate({ redirect_uri: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary outline-none"
            placeholder="http://localhost:3000/callback"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Scopes (через запятую)</label>
        <input
          value={config.scopes.join(", ")}
          onChange={e => onUpdate({ scopes: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary outline-none"
          placeholder="openid, profile, email"
        />
        <p className="text-xs text-gray-600 mt-1">
          Для OpenID Connect обязателен scope `openid`.
        </p>
      </div>

      {isCustom && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Issuer URL</label>
            <input
              value={config.custom_issuer ?? ""}
              onChange={e => onUpdate({ custom_issuer: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary outline-none"
              placeholder="https://auth.example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Authorization URL</label>
            <input
              value={config.custom_authorization_url ?? ""}
              onChange={e => onUpdate({ custom_authorization_url: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary outline-none"
              placeholder="https://auth.example.com/oauth2/authorize"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Token URL</label>
            <input
              value={config.custom_token_url ?? ""}
              onChange={e => onUpdate({ custom_token_url: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary outline-none"
              placeholder="https://auth.example.com/oauth2/token"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">UserInfo URL</label>
            <input
              value={config.custom_userinfo_url ?? ""}
              onChange={e => onUpdate({ custom_userinfo_url: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary outline-none"
              placeholder="https://auth.example.com/oauth2/userinfo"
            />
          </div>
        </div>
      )}

      <div className="items-start gap-3 p-3 rounded-lg border bg-gray-100">
        <input
          id="pkce"
          type="checkbox"
          checked={config.pkce}
          onChange={e => onUpdate({ pkce: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 text-primary bg-white"
        />
        <label htmlFor="pkce" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          Включить PKCE
        </label>
        <p className="text-xs text-gray-600">
          {isPublicClient
            ? "Обязателен для публичных клиентов (SPA, нативные, CLI) по OAuth 2.1."
            : "Рекомендуется для всех типов клиентов."}
        </p>
      </div>

      {validation.errors.length > 0 && (
        <div className="p-3 rounded-lg border border-destructive bg-destructive/10 text-destructive text-sm">
          <strong>Ошибки валидации:</strong>
          <ul className="list-disc list-inside mt-1">
            {validation.errors.map((e: { field: string; message: string }) => (
              <li key={e.field}>{e.field}: {e.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onPrev} className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-100">
          <ChevronLeft className="w-4 h-4 mr-1" /> Назад
        </button>
        <button onClick={onValidate} className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-100">
          Проверить <Mail className="w-4 h-4 ml-1" />
        </button>
        <button
          onClick={onNext}
          disabled={!validation.valid}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          Далее <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>
    </div>
  );
}

function StackStep({ config, onUpdate, onNext, onPrev }: { config: OAuthConfig; onUpdate: (p: Partial<OAuthConfig>) => void; onNext: () => void; onPrev: () => void }) {
  return (
    <div className="space-y-6">
      <p className="text-gray-600">
        Выберите стек технологий вашего проекта. Будет сгенерирован готовый фрагмент кода для интеграции OAuth.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STACKS.map((s) => (
          <button
            key={s.value}
            onClick={() => onUpdate({ stack: s.value })}
            className={cn(
              "p-4 rounded-lg border transition-colors text-left",
              config.stack === s.value
                ? "bg-primary border-primary text-primary-foreground"
                : "border-gray-300 hover:bg-gray-100",
            )}
          >
            <div className="font-medium">{s.label}</div>
            <div className="text-xs text-gray-600 mt-1">{s.description}</div>
          </button>
        ))}
      </div>
      <div className="flex justify-between">
        <button onClick={onPrev} className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-100">
          <ChevronLeft className="w-4 h-4 mr-1" /> Назад
        </button>
        <button onClick={onNext} className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
          Далее <ChevronRight className="w-4 h-4 ml-1" />
        </button>
      </div>
    </div>
  );
}

function PreviewStep({
  config,
  onNext,
  onPrev,
  onGenerate,
  generated,
}: {
  config: OAuthConfig;
  onNext: () => void;
  onPrev: () => void;
  onGenerate: () => void;
  generated: GenerateResponse | null;
}) {
  return (
    <div className="space-y-6">
      <p className="text-gray-600">
        Проверьте конфигурацию перед генерацией файлов.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-100 rounded-lg p-4">
          <div className="text-xs font-semibold text-gray-600 uppercase mb-2">Приложение</div>
          <div className="space-y-1 text-sm">
            <div><span className="font-medium">Название:</span> {config.app_name}</div>
            <div><span className="font-medium">Тип:</span> {config.app_type}</div>
            <div><span className="font-medium">Провайдер:</span> {config.provider}</div>
            <div><span className="font-medium">Стек:</span> {config.stack}</div>
          </div>
        </div>
        <div className="bg-gray-100 rounded-lg p-4">
          <div className="text-xs font-semibold text-gray-600 uppercase mb-2">OAuth</div>
          <div className="space-y-1 text-sm">
            <div><span className="font-medium">Redirect URI:</span> {config.redirect_uri}</div>
            <div><span className="font-medium">Scopes:</span> {config.scopes.join(", ")}</div>
            <div><span className="font-medium">Flow:</span> {config.flow}</div>
            <div><span className="font-medium">PKCE:</span> {config.pkce ? "Включен" : "Отключен"}</div>
          </div>
        </div>
      </div>

      {generated && (
        <div className="bg-gray-100 rounded-lg p-4">
          <div className="text-xs font-semibold text-gray-600 uppercase mb-2">Сгенерированные файлы</div>
          <ul className="text-sm space-y-1">
            {generated.files.map((f: { name: string; description: string }) => (
              <li key={f.name} className="flex justify-between">
                <span className="font-mono text-xs">{f.name}</span>
                <span className="text-xs text-gray-600">{f.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onPrev} className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-100">
          <ChevronLeft className="w-4 h-4 mr-1" /> Назад
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onGenerate} className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2">
            <Lock className="w-4 h-4" /> Сгенерировать
          </button>
          <button onClick={onNext} className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-100 disabled:opacity-50" disabled={!generated}>
            Далее <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportStep({
  onPrev,
  onExport,
  exporting,
  exportedZip,
  generated,
}: {
  onPrev: () => void;
  onExport: () => void;
  exporting: boolean;
  exportedZip: ZipResponse | null;
  generated: GenerateResponse | null;
}) {
  if (!generated) {
    return (
      <div className="text-center py-10">
        <Info className="w-12 h-12 mx-auto text-gray-600 mb-4" />
        <h3 className="text-lg font-medium">Сначала сгенерируйте файлы</h3>
        <p className="text-gray-600">Перейдите на предыдущий шаг и нажмите «Сгенерировать файлы».</p>
        <button
          onClick={onPrev}
          className="mt-6 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
        >
          Назад
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-success/10 border border-success/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded bg-success flex items-center justify-center text-success-foreground text-sm font-bold mt-0.5">
            ✓
          </div>
          <div>
            <h3 className="font-semibold">Готово!</h3>
            <p className="text-sm text-gray-600">
              Все {generated.files.length} файлов сгенерированы и готовы к скачиванию.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {generated.files.map((f: { name: string; description: string; mime_type: string }) => (
          <div key={f.name} className="p-3 rounded-lg border border-gray-300 bg-white">
            <div className="flex justify-between items-start mb-2">
              <span className="font-mono text-xs font-medium">{f.name}</span>
              <span className="text-xs text-gray-600">{f.mime_type}</span>
            </div>
            <p className="text-xs text-gray-600">{f.description}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onExport}
        disabled={exporting}
        className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
      >
        {exporting ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Подготовка архива...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" /> Скачать ZIP архив ({exportedZip?.file_count ?? generated.files.length} файлов)
          </>
        )}
      </button>

      {exportedZip && (
        <p className="text-xs text-gray-600 text-center">
          Архив будет скачан автоматически. Если не началось — нажмите кнопку снова.
        </p>
      )}

      <button onClick={onPrev} className="text-sm text-gray-600 hover:text-gray-900">
        <ChevronLeft className="w-4 h-4 inline mr-1" /> Вернуться к предпросмотру
      </button>
    </div>
  );
}

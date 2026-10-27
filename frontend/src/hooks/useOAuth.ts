import type {
  OAuthConfig,
  GenerateResponse,
  ValidateResponse,
  ZipResponse,
} from "@/types";

const API_BASE = "/api";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchProviders(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/providers`);
  const data = await json<{ providers: string[] }>(res);
  return data.providers;
}

export async function fetchAppTypes(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/app-types`);
  const data = await json<{ app_types: string[] }>(res);
  return data.app_types;
}

export async function fetchStacks(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/stacks`);
  const data = await json<{ stacks: string[] }>(res);
  return data.stacks;
}

export async function validateConfig(
  config: OAuthConfig,
): Promise<ValidateResponse> {
  const res = await fetch(`${API_BASE}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return json<ValidateResponse>(res);
}

export async function generateConfig(
  config: OAuthConfig,
): Promise<GenerateResponse> {
  const res = await fetch(`${API_BASE}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return json<GenerateResponse>(res);
}

export async function exportZip(
  config: OAuthConfig,
): Promise<ZipResponse> {
  const res = await fetch(`${API_BASE}/zip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return json<ZipResponse>(res);
}

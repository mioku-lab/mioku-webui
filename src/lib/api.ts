const AUTH_KEY = "mioku_webui_auth";

export function saveAuth(token: string, expiresAt: number): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ token, expiresAt }));
}

export function getAuthToken(): string | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { token: string; expiresAt: number };
    if (!parsed.token || Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
    return parsed.token;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    return null;
  }
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_KEY);
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(errorBody || `Request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

export async function apiForm<T>(url: string, form: FormData): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers();
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    method: "POST",
    body: form,
    headers,
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return (await res.json()) as T;
}

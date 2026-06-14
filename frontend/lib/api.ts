export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type ApiError = {
  detail?: string;
  message?: string;
};

type JsonBody = Record<string, unknown> | unknown[];
type ApiOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | JsonBody | null;
};

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("snackflow_token");
}

export function setToken(token: string) {
  window.localStorage.setItem("snackflow_token", token);
}

export function clearToken() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("snackflow_token");
  }
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const { body, ...init } = options;
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body && !(body instanceof FormData) && !(body instanceof URLSearchParams) && typeof body !== "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    body: body && !(body instanceof FormData) && !(body instanceof URLSearchParams) && typeof body !== "string" ? JSON.stringify(body) : body,
    cache: "no-store"
  });

  if (response.status === 401) clearToken();
  if (!response.ok) {
    let payload: ApiError = {};
    try {
      payload = await response.json();
    } catch {
      payload = { detail: response.statusText };
    }
    throw new Error(payload.detail || payload.message || "Request failed");
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function login(username: string, password: string) {
  const body = new URLSearchParams();
  body.set("username", username);
  body.set("password", password);
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) {
    throw new Error("Invalid username or password");
  }
  const data = (await response.json()) as { access_token: string };
  setToken(data.access_token);
  return data;
}

export function money(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `Rs ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function packets(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString();
}

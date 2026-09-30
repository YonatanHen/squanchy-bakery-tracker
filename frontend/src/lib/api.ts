const BASE_URL = "/api/v1";
const TOKEN_KEY = "squanchy.token";

export interface FieldError {
  field: string;
  message: string;
  row?: number;
}

/** Error thrown for a non-2xx response, carrying the backend's message and field errors. */
export class ApiError extends Error {
  status: number;
  fieldErrors: FieldError[];

  /** Create an error from the response status and parsed backend body. */
  constructor(status: number, message: string, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** Return the stored access token, or null when logged out. */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** Store the access token. */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Remove the stored access token. */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

const unauthorizedListeners = new Set<() => void>();

/** Register a callback for a 401 response; returns an unsubscribe function. */
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

interface RequestOptions {
  method?: string | undefined;
  body?: unknown;
}

/** Send a JSON request to the backend API and return the parsed response body. */
export async function apiRequest<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  const init: RequestInit = { method: options.method ?? "GET", headers };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  const response = await fetch(`${BASE_URL}${path}`, init);

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (response.ok) return data as T;

  if (response.status === 401) {
    clearToken();
    unauthorizedListeners.forEach((listener) => listener());
  }
  throw new ApiError(response.status, data?.error ?? response.statusText, data?.errors ?? []);
}

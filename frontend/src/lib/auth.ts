import { apiRequest, clearToken, getToken, setToken } from "./api";

/** Log in with username and password and store the returned access token. */
export async function login(username: string, password: string): Promise<void> {
  const { access_token } = await apiRequest<{ access_token: string }>("/auth/login", {
    method: "POST",
    body: { username, password },
  });
  setToken(access_token);
}

/** Log out by removing the stored token. */
export function logout(): void {
  clearToken();
}

/** Return true when an access token is stored. */
export function isLoggedIn(): boolean {
  return getToken() !== null;
}

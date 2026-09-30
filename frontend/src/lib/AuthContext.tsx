import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onUnauthorized } from "./api";
import { isLoggedIn, login, logout } from "./auth";

interface AuthState {
  loggedIn: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

/** Provide the login state and actions; a 401 from any API call logs the user out. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn);

  useEffect(() => onUnauthorized(() => setLoggedIn(false)), []);

  /** Log in and mark the session as logged in. */
  async function signIn(username: string, password: string) {
    await login(username, password);
    setLoggedIn(true);
  }

  /** Clear the token and mark the session as logged out. */
  function signOut() {
    logout();
    setLoggedIn(false);
  }

  return <AuthContext.Provider value={{ loggedIn, signIn, signOut }}>{children}</AuthContext.Provider>;
}

/** Return the auth state; must be used inside AuthProvider. */
export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider");
  return auth;
}

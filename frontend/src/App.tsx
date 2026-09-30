import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";

/** Render the child routes only when logged in; otherwise go to /login. */
function RequireAuth() {
  const { loggedIn } = useAuth();
  return loggedIn ? <Outlet /> : <Navigate to="/login" replace />;
}

/** Define the public and protected routes. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/readings" element={<PlaceholderPage title="Readings" />} />
          <Route path="/alerts" element={<PlaceholderPage title="Alerts" />} />
          <Route path="/upload" element={<PlaceholderPage title="Upload readings" />} />
          <Route path="/branches" element={<PlaceholderPage title="Branches" />} />
          <Route path="/thresholds" element={<PlaceholderPage title="Thresholds" />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/readings" replace />} />
    </Routes>
  );
}

/** Root component: auth state plus browser routing. */
export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

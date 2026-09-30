import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell/AppShell";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { AlertsPage } from "./pages/AlertsPage/AlertsPage";
import { BranchesPage } from "./pages/BranchesPage/BranchesPage";
import { LoginPage } from "./pages/LoginPage/LoginPage";
import { ReadingsPage } from "./pages/ReadingsPage/ReadingsPage";
import { SingleRecordPage } from "./pages/SingleRecordPage/SingleRecordPage";
import { ThresholdsPage } from "./pages/ThresholdsPage/ThresholdsPage";
import { UploadPage } from "./pages/UploadPage/UploadPage";

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
          <Route path="/readings" element={<ReadingsPage />} />
          <Route path="/readings/new" element={<SingleRecordPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/thresholds" element={<ThresholdsPage />} />
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

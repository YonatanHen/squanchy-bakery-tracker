import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppRoutes } from "./App";
import { setToken } from "./lib/api";
import { AuthProvider } from "./lib/AuthContext";

/** Render the app routes at `path`. */
function renderAt(path: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("routing", () => {
  it.each(["/readings", "/alerts", "/upload", "/branches", "/thresholds"])(
    "redirects %s to the login page without a token",
    (path) => {
      renderAt(path);

      expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    },
  );

  it("opens Readings by default when logged in", () => {
    setToken("jwt-1");
    renderAt("/");

    expect(screen.getByRole("heading", { level: 1, name: "Readings" })).toBeInTheDocument();
  });

  it.each([
    ["/alerts", "Alerts"],
    ["/upload", "Upload readings"],
    ["/branches", "Branches"],
    ["/thresholds", "Thresholds"],
  ])("shows the %s page when logged in", (path, title) => {
    setToken("jwt-1");
    renderAt(path);

    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
  });
});

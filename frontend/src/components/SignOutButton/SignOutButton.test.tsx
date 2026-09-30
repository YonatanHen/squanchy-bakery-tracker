import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppRoutes } from "../../App";
import { getToken, setToken } from "../../lib/api";
import { AuthProvider } from "../../lib/AuthContext";

/** Render the logged-in app at `path`. */
function renderAt(path: string) {
  setToken("jwt-1");
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("Sign out", () => {
  it("from the desktop sidebar removes the token and shows the login page", async () => {
    renderAt("/readings");
    const sidebar = screen.getAllByRole("navigation", { name: "Main" }).find((nav) => within(nav).queryByText("Squanchy Fridge Tracker"))!;

    await userEvent.click(within(sidebar).getByRole("button", { name: "Sign out" }));

    expect(getToken()).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("from the Thresholds page (phone) removes the token and shows the login page", async () => {
    renderAt("/thresholds");
    const page = screen.getByRole("main");

    await userEvent.click(within(page).getByRole("button", { name: "Sign out" }));

    expect(getToken()).toBeNull();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});

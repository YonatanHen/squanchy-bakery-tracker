import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../App";
import { getToken } from "../../lib/api";
import { AuthProvider } from "../../lib/AuthContext";
import { at } from "../../testUtils";

const fetchMock = vi.fn();

/** Build a fetch Response with a JSON body. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Render the app at /login. */
function renderLogin() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  );
}

/** Fill in the form and press Sign in. */
async function signIn(username: string, password: string) {
  if (username) await userEvent.type(screen.getByLabelText("Username"), username);
  if (password) await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginPage", () => {
  it("shows the app title, tagline and labeled fields", () => {
    renderLogin();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Squanchy Fridge Tracker");
    expect(screen.getByText("Temperature log for every branch.")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("stores the token and opens Readings after a successful login", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { access_token: "jwt-1" }));
    renderLogin();

    await signIn("admin", "password");

    expect(await screen.findByRole("heading", { level: 1, name: "Readings" })).toBeInTheDocument();
    expect(getToken()).toBe("jwt-1");
    expect(JSON.parse(at(fetchMock.mock.calls, 0)[1].body)).toEqual({ username: "admin", password: "password" });
  });

  it("shows the wrong-credentials message on 401", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "Invalid username or password" }));
    renderLogin();

    await signIn("admin", "wrong");

    expect(await screen.findByText("Wrong username or password.")).toBeInTheDocument();
    expect(getToken()).toBeNull();
  });

  it("shows the backend's 422 field messages under the matching fields", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, {
        errors: [
          { field: "username", message: "String should have at least 1 character" },
          { field: "password", message: "Field required" },
        ],
      }),
    );
    renderLogin();

    await signIn("", "");

    expect(await screen.findByLabelText("Username")).toHaveAccessibleDescription(
      "String should have at least 1 character",
    );
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Field required");
  });
});

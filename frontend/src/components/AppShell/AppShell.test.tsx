import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppRoutes } from "../../App";
import { setToken } from "../../lib/api";
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

const PAGES = [
  ["Readings", "/readings"],
  ["Alerts", "/alerts"],
  ["Upload", "/upload"],
  ["Branches", "/branches"],
  ["Thresholds", "/thresholds"],
];

describe("AppShell", () => {
  it("shows the five pages in the phone nav and the desktop sidebar", () => {
    renderAt("/readings");

    const navs = screen.getAllByRole("navigation", { name: "Main" });
    expect(navs).toHaveLength(2);
    for (const nav of navs) {
      const links = within(nav).getAllByRole("link");
      expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual(PAGES);
    }
  });

  it("shows the app name in the desktop sidebar", () => {
    renderAt("/readings");

    expect(screen.getByText("Squanchy Fridge Tracker")).toBeInTheDocument();
  });

  it("marks the current page link as active", () => {
    renderAt("/alerts");

    for (const link of screen.getAllByRole("link", { name: "Alerts" })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
    for (const link of screen.getAllByRole("link", { name: "Readings" })) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("opens a page from the nav", async () => {
    renderAt("/readings");

    await userEvent.click(screen.getAllByRole("link", { name: "Branches" })[0]);

    expect(screen.getByRole("heading", { level: 1, name: "Branches" })).toBeInTheDocument();
  });
});

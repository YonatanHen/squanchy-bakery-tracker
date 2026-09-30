import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Branch } from "../../lib/endpoints";
import { mockApi, renderLoggedIn } from "../../testUtils";

const JERUSALEM: Branch = {
  id: 1,
  name: "Jerusalem",
  city: null,
  street: null,
  building_number: null,
  fridges: [
    { id: 1, name: "Dairy", metric: "C", logger_id: "TL-0512", threshold_settings_id: 1, avg_temp: 3.9, last_measured: null },
  ],
};
const HAIFA: Branch = {
  id: 2,
  name: "Haifa",
  city: null,
  street: null,
  building_number: null,
  fridges: [
    { id: 3, name: "Dairy", metric: "F", logger_id: "TL-0231", threshold_settings_id: 1, avg_temp: 38.3, last_measured: null },
  ],
};
const PROFILES = [{ id: 1, name: "default", fridges: 2 }];

/** Mock the calls the Branches page makes on load. */
function mockBranches(branches: Branch[] = [JERUSALEM, HAIFA]) {
  return mockApi([
    ["GET /api/v1/branches", branches],
    ["GET /api/v1/threshold-settings", PROFILES],
  ]);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BranchesPage list", () => {
  it("lists each branch with its fridges, loggers and threshold profile", async () => {
    mockBranches();
    renderLoggedIn("/branches");

    expect(screen.getByRole("heading", { name: "Branches" })).toBeInTheDocument();
    expect(screen.getByText("New branches, fridges and loggers are added from uploads.")).toBeInTheDocument();
    const haifa = await screen.findByRole("list", { name: "Haifa fridges" });
    expect(within(haifa).getByText("TL-0231")).toBeInTheDocument();
    expect(within(haifa).getByText("°F")).toBeInTheDocument();
    expect(within(haifa).getByText("default")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Jerusalem fridges" })).toBeInTheDocument();
  });

  it("shows an empty state before the first upload", async () => {
    mockBranches([]);
    renderLoggedIn("/branches");

    expect(await screen.findByText("No branches yet.")).toBeInTheDocument();
  });

  it("shows an error when the branches cannot be loaded", async () => {
    mockApi([]);
    renderLoggedIn("/branches");

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the branches. Try again.");
  });
});

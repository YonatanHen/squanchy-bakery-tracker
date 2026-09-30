import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const IMPACT = { fridges: 1, loggers: 1, readings: 5, alerts: 2 };

/** Mock load, delete-impact and DELETE; a deleted branch drops out of the next list. */
function mockDeletes(deleteResponse?: Response) {
  let branches = [JERUSALEM, HAIFA];
  return mockApi([
    ["GET /api/v1/branches/2/delete-impact", IMPACT],
    ["GET /api/v1/fridges/3/delete-impact", IMPACT],
    ["GET /api/v1/branches", () => branches],
    ["GET /api/v1/threshold-settings", PROFILES],
    [
      "DELETE /api/v1/branches/2",
      () => deleteResponse ?? ((branches = [JERUSALEM]), new Response(null, { status: 204 })),
    ],
  ]);
}

/** Return the [method, path] of every call the page made. */
function calls(fetchMock: ReturnType<typeof mockApi>): string[] {
  return fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? "GET"} ${new URL(input, "http://x").pathname}`);
}

describe("BranchesPage delete branch", () => {
  it("shows the delete impact counts before anything is deleted", async () => {
    const fetchMock = mockDeletes();
    renderLoggedIn("/branches");

    await userEvent.click(await screen.findByRole("button", { name: "Delete Haifa" }));

    const dialog = await screen.findByRole("dialog", { name: "Delete Haifa?" });
    expect(within(dialog).getByText("readings archived").previousSibling).toHaveTextContent("5");
    expect(calls(fetchMock)).toContain("GET /api/v1/branches/2/delete-impact");
    expect(calls(fetchMock)).not.toContain("DELETE /api/v1/branches/2");
  });

  it("does not delete when the user cancels", async () => {
    const fetchMock = mockDeletes();
    renderLoggedIn("/branches");

    await userEvent.click(await screen.findByRole("button", { name: "Delete Haifa" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calls(fetchMock)).not.toContain("DELETE /api/v1/branches/2");
  });

  it("deletes after the user confirms and reloads the list", async () => {
    const fetchMock = mockDeletes();
    renderLoggedIn("/branches");

    await userEvent.click(await screen.findByRole("button", { name: "Delete Haifa" }));
    await userEvent.click(await screen.findByRole("button", { name: "Delete branch" }));

    await waitFor(() => expect(screen.queryByRole("list", { name: "Haifa fridges" })).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calls(fetchMock).filter((c) => c === "DELETE /api/v1/branches/2")).toHaveLength(1);
  });

  it("keeps the dialog open with an error when the delete fails", async () => {
    mockDeletes(new Response(JSON.stringify({ error: "Not found" }), { status: 404 }));
    renderLoggedIn("/branches");

    await userEvent.click(await screen.findByRole("button", { name: "Delete Haifa" }));
    await userEvent.click(await screen.findByRole("button", { name: "Delete branch" }));

    const dialog = screen.getByRole("dialog", { name: "Delete Haifa?" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Could not delete. Try again.");
  });
});

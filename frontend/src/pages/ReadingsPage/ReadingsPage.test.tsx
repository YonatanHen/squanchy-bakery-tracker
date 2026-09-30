import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Reading } from "../../lib/endpoints";
import { mockApi, renderLoggedIn } from "../../testUtils";

const DAIRY_OK: Reading = {
  id: 4,
  time: "2026-09-14T06:00:00",
  temp: 38.3,
  metric: "F",
  status: "OK",
  logger_id: "TL-0231",
  fridge: "Dairy",
  branch: "Haifa",
  city: "Haifa",
};
const DAIRY_ERR: Reading = { ...DAIRY_OK, id: 11, time: "2026-09-14T06:30:00", temp: null, status: "ERR" };

const BRANCHES = [
  { id: 1, name: "Haifa", fridges: [{ id: 1, name: "Dairy" }] },
  { id: 2, name: "Tel Aviv", fridges: [{ id: 2, name: "Display 2" }] },
];

/** A readings page body. */
function page(items: Reading[], total = items.length, offset = 0, limit = 50) {
  return { items, total, offset, limit };
}

/** Mock the API calls the Readings page makes. */
function mockReadings(items: Reading[] = [DAIRY_OK, DAIRY_ERR]) {
  return mockApi([
    ["GET /api/v1/readings", page(items)],
    ["GET /api/v1/branches", BRANCHES],
    ["GET /api/v1/alerts", page([])],
  ]);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReadingsPage list", () => {
  it("shows each reading as a table row with time, °C temperature, place and status", async () => {
    mockReadings();
    renderLoggedIn("/readings");

    const table = await screen.findByRole("table", { name: "Readings" });
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "14/09 06:00",
      "3.5 °C",
      "Dairy",
      "Haifa",
      "TL-0231",
      "OK",
      "Edit",
    ]);
  });

  it("shows an ERR reading as a dash with the ERR badge", async () => {
    mockReadings();
    renderLoggedIn("/readings");

    const table = await screen.findByRole("table", { name: "Readings" });
    const cells = within(within(table).getAllByRole("row")[2]).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("—");
    expect(within(cells[5]).getByText("ERR")).toHaveAttribute("data-level", "ERR");
  });

  it("shows the same readings as cards for phones", async () => {
    mockReadings();
    renderLoggedIn("/readings");

    const list = await screen.findByRole("list", { name: "Readings" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("3.5°")).toBeInTheDocument();
  });

  it("converts the shown temperatures when the user picks °F (Haifa logs in °F)", async () => {
    mockReadings();
    renderLoggedIn("/readings");
    const table = await screen.findByRole("table", { name: "Readings" });

    await userEvent.click(screen.getByRole("button", { name: "°F" }));

    expect(screen.getByRole("button", { name: "°F" })).toHaveAttribute("aria-pressed", "true");
    expect(await within(table).findByText("38.3 °F")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Readings" })).getByText("38.3°")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    mockReadings([]);
    renderLoggedIn("/readings");

    expect(await screen.findByText("No readings match these filters.")).toBeInTheDocument();
  });
});

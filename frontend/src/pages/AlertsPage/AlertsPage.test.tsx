import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Alert } from "../../lib/endpoints";
import { mockApi, paramsOf, renderLoggedIn } from "../../testUtils";

const GAP: Alert = {
  id: 1,
  level: "URGENT",
  description: "No reading for 71h 30m before this reading",
  reading_id: 9,
  time: "2026-09-17T06:00:00",
  temp: 3.7,
  metric: "C",
  logger_id: "TL-0417",
  fridge: "Display 2",
  branch: "Tel Aviv",
  city: "Tel Aviv",
};
const HAIFA_SPIKE: Alert = {
  ...GAP,
  id: 2,
  level: "NON_URGENT",
  description: "Spike: 9.4°C against an average of 4.0°C",
  temp: 48.9,
  metric: "F",
  fridge: "Dairy",
  branch: "Haifa",
  time: "2026-09-14T06:15:00",
};

/** An alerts page body. */
function page(items: Alert[], total = items.length, offset = 0, limit = 50) {
  return { items, total, offset, limit };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AlertsPage list", () => {
  it("shows each alert as a table row, urgent and non-urgent styled apart", async () => {
    mockApi([["GET /api/v1/alerts", page([GAP, HAIFA_SPIKE])]]);
    renderLoggedIn("/alerts");

    const table = await screen.findByRole("table", { name: "Alerts" });
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]).getAllByRole("cell").map((c) => c.textContent)).toEqual([
      "Urgent",
      "No reading for 71h 30m before this reading",
      "3.7 °C",
      "Display 2",
      "Tel Aviv",
      "17/09 06:00",
    ]);
    expect(rows[1]).toHaveAttribute("data-tone", "urgent");
    expect(rows[2]).toHaveAttribute("data-tone", "light");
  });

  it("shows the reading in its logger's own unit (Haifa logs in °F)", async () => {
    mockApi([["GET /api/v1/alerts", page([HAIFA_SPIKE])]]);
    renderLoggedIn("/alerts");

    const table = await screen.findByRole("table", { name: "Alerts" });
    expect(within(table).getByText("48.9 °F")).toBeInTheDocument();
  });

  it("shows the same alerts as cards for phones", async () => {
    mockApi([["GET /api/v1/alerts", page([GAP, HAIFA_SPIKE])]]);
    renderLoggedIn("/alerts");

    const list = await screen.findByRole("list", { name: "Alerts" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("Haifa · Dairy · Mon 14 Sep 06:15")).toBeInTheDocument();
  });

  it("shows an empty state when there are no active alerts", async () => {
    mockApi([["GET /api/v1/alerts", page([])]]);
    renderLoggedIn("/alerts");

    expect(await screen.findByText("No active alerts.")).toBeInTheDocument();
  });
});

describe("AlertsPage filters", () => {
  it("counts the active alerts on the Active button", async () => {
    mockApi([["GET /api/v1/alerts", page([GAP], 5)]]);
    renderLoggedIn("/alerts");

    expect(await screen.findByRole("button", { name: "Active (5)" })).toHaveAttribute("aria-pressed", "true");
  });

  it("lists the archived alerts (of deleted readings) with archived=true", async () => {
    const fetchMock = mockApi([
      [
        "GET /api/v1/alerts",
        (url: URL) =>
          url.searchParams.get("archived") === "true" ? page([{ ...GAP, archived_at: "2026-09-20T10:05:00" }]) : page([GAP, HAIFA_SPIKE]),
      ],
    ]);
    renderLoggedIn("/alerts");
    await screen.findByRole("table", { name: "Alerts" });

    await userEvent.click(screen.getByRole("button", { name: "Archived" }));

    expect(await screen.findByRole("button", { name: "Archived (1)" })).toHaveAttribute("aria-pressed", "true");
    expect(paramsOf(fetchMock, "/api/v1/alerts").at(-1)!.get("archived")).toBe("true");
    expect(screen.getByText("Archived 20/09 10:05")).toBeInTheDocument();
  });

  it("filters by level from the first page", async () => {
    const fetchMock = mockApi([["GET /api/v1/alerts", page([GAP])]]);
    renderLoggedIn("/alerts");
    await screen.findByRole("table", { name: "Alerts" });

    await userEvent.selectOptions(screen.getByLabelText("Level"), "Urgent");

    await waitFor(() => expect(paramsOf(fetchMock, "/api/v1/alerts").at(-1)!.get("level")).toBe("URGENT"));
    expect(paramsOf(fetchMock, "/api/v1/alerts").at(-1)!.get("offset")).toBe("0");
  });

  it("pages through the alerts", async () => {
    const fetchMock = mockApi([
      ["GET /api/v1/alerts", (url: URL) => page([GAP], 61, Number(url.searchParams.get("offset")), 50)],
    ]);
    renderLoggedIn("/alerts");

    await userEvent.click(await screen.findByRole("button", { name: "Next →" }));

    expect(await screen.findByText("51–51 of 61")).toBeInTheDocument();
    expect(paramsOf(fetchMock, "/api/v1/alerts").at(-1)!.get("offset")).toBe("50");
  });
});

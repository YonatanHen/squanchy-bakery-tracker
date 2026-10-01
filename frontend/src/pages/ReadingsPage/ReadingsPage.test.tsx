import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Reading } from "../../lib/endpoints";
import { at, mockApi, paramsOf, renderLoggedIn } from "../../testUtils";

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
    expect(within(at(rows, 1)).getAllByRole("cell").map((c) => c.textContent)).toEqual([
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
    const cells = within(at(within(table).getAllByRole("row"), 2)).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("—");
    expect(within(at(cells, 5)).getByText("ERR")).toHaveAttribute("data-level", "ERR");
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

describe("ReadingsPage alert badges", () => {
  /** An active alert on reading `readingId`. */
  function alert(id: number, readingId: number, level: "URGENT" | "NON_URGENT") {
    return { ...DAIRY_OK, id, reading_id: readingId, level, description: "Spike" };
  }

  it("counts each reading's alerts in the most severe level's color", async () => {
    const fetchMock = mockApi([
      ["GET /api/v1/readings", page([DAIRY_OK, DAIRY_ERR])],
      ["GET /api/v1/branches", BRANCHES],
      ["GET /api/v1/alerts", page([alert(1, 4, "NON_URGENT"), alert(2, 4, "URGENT")])],
    ]);
    renderLoggedIn("/readings");

    const table = await screen.findByRole("table", { name: "Readings" });
    const row = at(within(table).getAllByRole("row"), 1);
    expect(await within(row).findByText("2 alerts")).toHaveAttribute("data-level", "URGENT");
    expect(row).toHaveAttribute("data-tone", "urgent");
    expect(within(table).getAllByRole("row")[2]).toHaveAttribute("data-tone", "default");

    // Only the alerts of the page's time span are asked for
    const params = at(paramsOf(fetchMock, "/api/v1/alerts"), 0);
    expect(params.get("date_from")).toBe("2026-09-14T06:00:00");
    expect(params.get("date_to")).toBe("2026-09-14T06:30:00");
  });

  it("shows a non-urgent alert in the light style", async () => {
    mockApi([
      ["GET /api/v1/readings", page([DAIRY_OK])],
      ["GET /api/v1/branches", BRANCHES],
      ["GET /api/v1/alerts", page([alert(1, 4, "NON_URGENT")])],
    ]);
    renderLoggedIn("/readings");

    const table = await screen.findByRole("table", { name: "Readings" });
    expect(await within(table).findByText("1 alert")).toHaveAttribute("data-level", "NON_URGENT");
    expect(within(table).getAllByRole("row")[1]).toHaveAttribute("data-tone", "light");
  });
});

describe("ReadingsPage editing", () => {
  it("opens the edit dialog from the table and reloads the list after a save", async () => {
    const fetchMock = mockApi([
      ["GET /api/v1/readings", page([DAIRY_OK])],
      ["GET /api/v1/branches", BRANCHES],
      ["GET /api/v1/alerts", page([])],
      ["PATCH /api/v1/readings/4", DAIRY_OK],
    ]);
    renderLoggedIn("/readings");
    const table = await screen.findByRole("table", { name: "Readings" });

    await userEvent.click(within(table).getByRole("button", { name: "Edit" }));
    const temp = screen.getByLabelText("Temperature (°F, or ERR)");
    await userEvent.clear(temp);
    await userEvent.type(temp, "39");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, save" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(paramsOf(fetchMock, "/api/v1/readings")).toHaveLength(2));
  });

  it("opens the edit dialog from a phone card", async () => {
    mockReadings();
    renderLoggedIn("/readings");
    const list = await screen.findByRole("list", { name: "Readings" });

    await userEvent.click(at(within(list).getAllByRole("button", { name: "Edit reading" }), 0));

    expect(screen.getByRole("dialog", { name: "Edit reading" })).toHaveAccessibleDescription("Haifa · Dairy · TL-0231");
  });
});

describe("ReadingsPage paging", () => {
  it("shows the range and loads the next page from the next offset", async () => {
    const fetchMock = mockApi([
      [
        "GET /api/v1/readings",
        (url: URL) =>
          page([DAIRY_OK], 61, Number(url.searchParams.get("offset")), Number(url.searchParams.get("limit") ?? "50")),
      ],
      ["GET /api/v1/branches", BRANCHES],
      ["GET /api/v1/alerts", page([])],
    ]);
    renderLoggedIn("/readings");
    expect(await screen.findByText("1–1 of 61")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next →" }));

    expect(await screen.findByText("11–11 of 61")).toBeInTheDocument();
    expect(paramsOf(fetchMock, "/api/v1/readings").at(-1)!.get("offset")).toBe("10");
  });

  it("links to adding a reading", async () => {
    mockReadings();
    renderLoggedIn("/readings");

    const links = await screen.findAllByRole("link", { name: "+ Add a reading" });
    await userEvent.click(at(links, 0));

    expect(screen.getByRole("heading", { level: 1, name: "Add one reading" })).toBeInTheDocument();
  });
});

describe("ReadingsPage archive", () => {
  it("shows Active first and loads archived readings when the user picks Archived", async () => {
    const fetchMock = mockReadings();
    renderLoggedIn("/readings");
    await screen.findByRole("table", { name: "Readings" });

    const lists = screen.getByRole("group", { name: "Reading list" });
    expect(within(lists).getByRole("button", { name: "Active" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(within(lists).getByRole("button", { name: "Archived" }));

    await waitFor(() => expect(paramsOf(fetchMock, "/api/v1/readings").at(-1)!.get("archived")).toBe("true"));
    expect(at(paramsOf(fetchMock, "/api/v1/readings"), 0).has("archived")).toBe(false);
    expect(within(lists).getByRole("button", { name: "Archived" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows archived readings read-only, with when they were archived", async () => {
    const deleted: Reading = { ...DAIRY_OK, city: null, archived_at: "2026-09-15T10:05:00" };
    mockApi([
      ["GET /api/v1/readings", (url: URL) => page(url.searchParams.has("archived") ? [deleted] : [DAIRY_OK])],
      ["GET /api/v1/branches", BRANCHES],
      ["GET /api/v1/alerts", page([])],
    ]);
    renderLoggedIn("/readings");
    await screen.findByRole("button", { name: "Edit" });

    await userEvent.click(screen.getByRole("button", { name: "Archived" }));

    const table = await screen.findByRole("table", { name: "Readings" });
    expect(await within(table).findByText("Archived 15/09 10:05")).toBeInTheDocument();
    expect(within(table).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Readings" });
    expect(within(list).getByText("Archived 15/09 10:05")).toBeInTheDocument();
    expect(within(list).queryByRole("button", { name: "Edit reading" })).not.toBeInTheDocument();
  });

  it("restores an archived reading from its row and reloads the list", async () => {
    const deleted: Reading = { ...DAIRY_OK, city: null, archived_at: "2026-09-15T10:05:00" };
    const fetchMock = mockApi([
      ["GET /api/v1/readings", page([deleted])],
      ["GET /api/v1/branches", BRANCHES],
      ["GET /api/v1/alerts", page([])],
      ["POST /api/v1/readings/archive/4/restore", DAIRY_OK],
    ]);
    renderLoggedIn("/readings");
    const table = await screen.findByRole("table", { name: "Readings" });
    expect(within(screen.getByRole("list", { name: "Readings" })).getByRole("button", { name: "Restore" })).toBeInTheDocument();

    await userEvent.click(within(table).getByRole("button", { name: "Restore" }));

    await waitFor(() => expect(paramsOf(fetchMock, "/api/v1/readings")).toHaveLength(2));
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST").map(([input]) => input);
    expect(posts).toEqual(["/api/v1/readings/archive/4/restore"]);
  });

  it("cleans the archive only after a confirmation with the counts, and not on Cancel", async () => {
    const deleted: Reading = { ...DAIRY_OK, city: null, archived_at: "2026-09-15T10:05:00" };
    const alert = { ...DAIRY_OK, reading_id: 4, level: "URGENT", description: "Spike" };
    const fetchMock = mockApi([
      ["GET /api/v1/readings", page([deleted], 2)],
      ["GET /api/v1/branches", BRANCHES],
      ["GET /api/v1/alerts", page([alert], 3)],
      ["DELETE /api/v1/readings/archive", { readings: 2, alerts: 3 }],
    ]);
    const deletes = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE").map(([input]) => input);
    renderLoggedIn("/readings");
    await screen.findByRole("table", { name: "Readings" });
    await userEvent.click(screen.getByRole("button", { name: "Archived" }));

    await userEvent.click(await screen.findByRole("button", { name: "Clean archive" }));
    const dialog = await screen.findByRole("dialog", { name: "Clean archive" });
    expect(within(dialog).getByText("Delete 2 archived readings for good?")).toBeInTheDocument();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Their 3 archived alerts will be deleted as well. This cannot be undone.",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deletes()).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Clean archive" }));
    const readingLoads = paramsOf(fetchMock, "/api/v1/readings").length;
    await userEvent.click(await screen.findByRole("button", { name: "Delete for good" }));

    await waitFor(() => expect(deletes()).toEqual(["/api/v1/readings/archive"]));
    await waitFor(() => expect(paramsOf(fetchMock, "/api/v1/readings").length).toBeGreaterThan(readingLoads));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ReadingsPage filters", () => {
  it("reloads the first page with the applied branch and minimum temperature", async () => {
    const fetchMock = mockReadings();
    renderLoggedIn("/readings");
    await screen.findByRole("option", { name: "Tel Aviv" });

    await userEvent.selectOptions(screen.getByLabelText("Branch"), "Haifa");
    await userEvent.type(screen.getByLabelText("Min °C"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(paramsOf(fetchMock, "/api/v1/readings")).toHaveLength(2));
    const last = at(paramsOf(fetchMock, "/api/v1/readings"), 1);
    expect(last.get("branch")).toBe("Haifa");
    expect(last.get("temp_min")).toBe("5");
    expect(last.get("unit")).toBe("C");
    expect(last.get("offset")).toBe("0");
    expect(await screen.findByText("2 readings · Haifa")).toBeInTheDocument();
  });

  it("keeps the minimum's meaning when the unit changes: above 5 °C becomes above 41 °F", async () => {
    const fetchMock = mockReadings();
    renderLoggedIn("/readings");
    await userEvent.type(await screen.findByLabelText("Min °C"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await userEvent.click(screen.getByRole("button", { name: "°F" }));

    expect(screen.getByLabelText("Min °F")).toHaveValue("41");
    expect(screen.getByRole("button", { name: "Remove filter Above 41 °F" })).toBeInTheDocument();
    await waitFor(() => {
      const last = paramsOf(fetchMock, "/api/v1/readings").at(-1)!;
      expect([last.get("temp_min"), last.get("unit")]).toEqual(["41", "F"]);
    });
  });

  it("shows the backend's message under the field it rejected", async () => {
    mockApi([
      [
        "GET /api/v1/readings",
        (url: URL) =>
          url.searchParams.has("temp_min")
            ? new Response(JSON.stringify({ errors: [{ field: "temp_min", message: "Input should be a valid number" }] }), {
                status: 422,
              })
            : page([DAIRY_OK]),
      ],
      ["GET /api/v1/branches", BRANCHES],
      ["GET /api/v1/alerts", page([])],
    ]);
    renderLoggedIn("/readings");
    await userEvent.type(await screen.findByLabelText("Min °C"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Min °C")).toHaveAccessibleDescription("Input should be a valid number"),
    );
  });
});

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Branch, SaveResult } from "../../lib/endpoints";
import { mockApi, renderLoggedIn } from "../../testUtils";

const BRANCHES: Branch[] = [
  {
    id: 1,
    name: "Haifa",
    fridges: [
      { id: 1, name: "Dairy", logger_id: "TL-0231" },
      { id: 2, name: "Cream cakes", logger_id: "TL-0388" },
    ],
  },
  { id: 2, name: "Rishon LeZion", fridges: [{ id: 3, name: "Display", logger_id: "TL-0400" }] },
];

/** A SaveResult with the given fields over an empty result. */
function result(fields: Partial<SaveResult> = {}): SaveResult {
  return {
    inserted: 0,
    duplicates: 0,
    err_rows: 0,
    rejected: 0,
    renamed_fridges: [],
    alerts: 0,
    errors: [],
    fridge_name_mismatches: [],
    ...fields,
  };
}

/** A JSON response with a non-200 status. */
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Type into a labelled combobox and leave it. */
async function typeInto(name: string, text: string) {
  const input = screen.getByRole("combobox", { name });
  await userEvent.clear(input);
  await userEvent.type(input, `${text}{Escape}`);
}

/** Fill the whole form with a known Haifa / Dairy reading. */
async function fillDairy(temp = "38.3") {
  await typeInto("Branch", "Haifa");
  await typeInto("Fridge", "Dairy");
  await typeInto("Logger id", "TL-0231");
  fireEvent.change(screen.getByLabelText("Time"), { target: { value: "2026-09-14T07:00" } });
  await userEvent.type(screen.getByLabelText("Temperature (number, or ERR)"), temp);
}

/** The JSON body of the n-th POST /readings call. */
function postedBody(fetchMock: ReturnType<typeof mockApi>, n = 0): unknown {
  const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
  return JSON.parse(posts[n][1]?.body as string);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SingleRecordPage", () => {
  it("fills the logger id from the chosen fridge of the chosen branch", async () => {
    mockApi([["GET /api/v1/branches", BRANCHES]]);
    renderLoggedIn("/readings/new");
    await screen.findByRole("heading", { level: 1, name: "Add one reading" });

    await typeInto("Branch", "Haifa");
    await typeInto("Fridge", "Cream cakes");

    expect(screen.getByRole("combobox", { name: "Logger id" })).toHaveValue("TL-0388");
  });

  it("shows each rejected field's message under that field", async () => {
    const rejected = result({
      rejected: 1,
      errors: [
        { row: 1, field: "time", value: "", message: "Time is required" },
        { row: 1, field: "temp", value: "", message: "Temperature is required" },
      ],
    });
    mockApi([
      ["GET /api/v1/branches", BRANCHES],
      ["POST /api/v1/readings", () => json(422, rejected)],
    ]);
    renderLoggedIn("/readings/new");
    await screen.findByRole("heading", { level: 1, name: "Add one reading" });

    await typeInto("Branch", "Haifa");
    await userEvent.click(screen.getByRole("button", { name: "Save reading" }));

    const temp = screen.getByLabelText("Temperature (number, or ERR)");
    await waitFor(() => expect(temp).toHaveAccessibleDescription("Temperature is required"));
    expect(screen.getByLabelText("Time")).toHaveAccessibleDescription("Time is required");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("asks to add an unknown logger, then re-sends the reading with the register block", async () => {
    const unknown = result({
      rejected: 1,
      errors: [{ row: 1, field: "logger", value: "TL-0600", message: "Unknown logger" }],
      unknown: { branches: [], loggers: [{ logger: "TL-0600", branch: "Haifa", fridge: "Dairy 2" }] },
    });
    const fetchMock = mockApi([
      ["GET /api/v1/branches", BRANCHES],
      [
        "POST /api/v1/readings",
        (_url: URL, init?: RequestInit) =>
          JSON.parse(init?.body as string).register ? result({ inserted: 1 }) : json(422, unknown),
      ],
    ]);
    renderLoggedIn("/readings/new");
    await screen.findByRole("heading", { level: 1, name: "Add one reading" });

    await fillDairy();
    await userEvent.click(screen.getByRole("button", { name: "Save reading" }));
    const dialog = await screen.findByRole("dialog", { name: "New in this reading" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Add and save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Reading saved.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(postedBody(fetchMock, 1)).toMatchObject({
      register: { branches: [], fridges: [{ logger_id: "TL-0600", branch: "Haifa", fridge: "Dairy 2", metric: "C" }] },
    });
  });

  it("keeps the dialog open with the backend's reason when the new entries are refused", async () => {
    const unknown = result({
      rejected: 1,
      unknown: { branches: [], loggers: [{ logger: "TL-0600", branch: "Haifa", fridge: "Dairy" }] },
    });
    const refused = { errors: [{ field: "body", message: "Fridge 'Dairy' in Haifa already has logger TL-0231" }] };
    mockApi([
      ["GET /api/v1/branches", BRANCHES],
      [
        "POST /api/v1/readings",
        (_url: URL, init?: RequestInit) => json(422, JSON.parse(init?.body as string).register ? refused : unknown),
      ],
    ]);
    renderLoggedIn("/readings/new");
    await screen.findByRole("heading", { level: 1, name: "Add one reading" });

    await fillDairy();
    await userEvent.click(screen.getByRole("button", { name: "Save reading" }));
    const dialog = await screen.findByRole("dialog", { name: "New in this reading" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Add and save" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Fridge 'Dairy' in Haifa already has logger TL-0231");
  });

  it("sends the typed reading, the datetime-local time as is, and shows it was saved", async () => {
    const fetchMock = mockApi([
      ["GET /api/v1/branches", BRANCHES],
      ["POST /api/v1/readings", result({ inserted: 1, alerts: 1 })],
    ]);
    renderLoggedIn("/readings/new");
    await screen.findByRole("heading", { level: 1, name: "Add one reading" });

    await fillDairy();
    await userEvent.click(screen.getByRole("button", { name: "Save reading" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Reading saved. 1 alert created.");
    expect(postedBody(fetchMock)).toEqual({
      logger: "TL-0231",
      branch: "Haifa",
      fridge: "Dairy",
      time: "2026-09-14T07:00",
      temp: "38.3",
    });
  });
});

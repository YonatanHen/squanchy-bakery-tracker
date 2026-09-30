import { fireEvent, screen } from "@testing-library/react";
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

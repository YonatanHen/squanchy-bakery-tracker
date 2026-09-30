import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SaveResult } from "../../lib/endpoints";
import { at, mockApi, renderLoggedIn } from "../../testUtils";

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

/** Answer the plain upload with `first` and the upload with a register block with `registered`. */
function firstThenRegistered(first: unknown, registered: unknown) {
  return (_url: URL, init?: RequestInit) => ((init?.body as FormData).has("register") ? registered : first);
}

const WEEK = new File(["xlsx"], "week.xlsx");

/** Open the Upload page and choose week.xlsx. */
async function uploadWeek() {
  renderLoggedIn("/upload");
  await userEvent.upload(screen.getByLabelText(/choose/i), WEEK);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UploadPage", () => {
  it("lets the user pick .xlsx and .csv files", () => {
    renderLoggedIn("/upload");

    expect(screen.getByLabelText(/choose/i)).toHaveAttribute("accept", ".xlsx,.csv");
  });

  it("uploads the chosen file and shows saved, duplicates and rows to fix", async () => {
    const fetchMock = mockApi([["POST /api/v1/readings/upload", result({ inserted: 2, duplicates: 0, rejected: 3 })]]);

    await uploadWeek();

    const counts = await screen.findByRole("list", { name: "Upload result" });
    expect(within(counts).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "2saved",
      "0duplicates skipped",
      "3rows to fix",
    ]);
    expect((at(fetchMock.mock.calls, 0)[1]?.body as FormData).get("file")).toBe(WEEK);
  });

  it("uploads a file dropped on the drop zone", async () => {
    const fetchMock = mockApi([["POST /api/v1/readings/upload", result({ inserted: 1 })]]);
    renderLoggedIn("/upload");

    fireEvent.drop(screen.getByText("Drop an .xlsx or .csv file here, or click to choose"), { dataTransfer: { files: [WEEK] } });

    await screen.findByRole("list", { name: "Upload result" });
    expect((at(fetchMock.mock.calls, 0)[1]?.body as FormData).get("file")).toBe(WEEK);
    expect(screen.getByText("Last file: week.xlsx")).toBeInTheDocument();
  });

  it("notes the saved ERR readings, the new alerts and the renamed fridges", async () => {
    mockApi([
      [
        "POST /api/v1/readings/upload",
        result({ inserted: 4, err_rows: 1, alerts: 2, renamed_fridges: ["Haifa: Dairy -> Dairy 2"] }),
      ],
    ]);

    await uploadWeek();

    expect(await screen.findByText("1 ERR reading saved · 2 alerts created")).toBeInTheDocument();
    expect(screen.getByText("Renamed: Haifa: Dairy -> Dairy 2")).toBeInTheDocument();
  });

  it("lists each rejected row with its field, value and message", async () => {
    mockApi([
      [
        "POST /api/v1/readings/upload",
        result({
          rejected: 2,
          errors: [
            { row: 4, field: "time", value: "32/09/2026 06:30", message: "Unrecognized date '32/09/2026 06:30'" },
            { row: 5, field: "logger", value: "TL-51", message: "Logger id must match TL-NNNN" },
          ],
        }),
      ],
    ]);

    await uploadWeek();

    const rows = await screen.findByRole("list", { name: "Rows to fix" });
    expect(within(rows).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Row 4Time “32/09/2026 06:30” — unrecognized date '32/09/2026 06:30'",
      "Row 5Logger “TL-51” — logger id must match TL-NNNN",
    ]);
  });

  it("shows no rows-to-fix list when every row was saved", async () => {
    mockApi([["POST /api/v1/readings/upload", result({ inserted: 5 })]]);

    await uploadWeek();

    await screen.findByRole("list", { name: "Upload result" });
    expect(screen.queryByRole("list", { name: "Rows to fix" })).not.toBeInTheDocument();
  });

  it("lists saved rows whose fridge name differs from their logger's fridge", async () => {
    mockApi([
      [
        "POST /api/v1/readings/upload",
        result({
          inserted: 3,
          fridge_name_mismatches: [{ row: 7, logger: "TL-0231", name_in_file: "Dary", fridge: "Dairy" }],
        }),
      ],
    ]);

    await uploadWeek();

    const rows = await screen.findByRole("list", { name: "Fridge names to check" });
    expect(within(rows).getByRole("listitem")).toHaveTextContent("Row 7“Dary” — saved to Dairy (TL-0231)");
  });

  it("sums up the unknown branches and loggers, and opens the add-it dialog on Review", async () => {
    mockApi([
      [
        "POST /api/v1/readings/upload",
        result({
          rejected: 2,
          unknown: { branches: [{ name: "Eilat" }], loggers: [{ logger: "TL-0600", branch: "Haifa", fridge: "Dairy" }] },
        }),
      ],
    ]);

    await uploadWeek();

    const review = await screen.findByRole("button", { name: /Review/ });
    expect(review).toHaveTextContent(
      "1 branch and 1 logger not registeredEilat, TL-0600 — did you mean something else, or add it?Review →",
    );
    await userEvent.click(review);
    expect(screen.getByRole("dialog", { name: "New in this file" })).toBeInTheDocument();
  });

  it("re-sends the same file with the confirmed entries and shows the new result", async () => {
    const eilat = result({ rejected: 2, unknown: { branches: [{ name: "Eilat" }], loggers: [] } });
    const fetchMock = mockApi([
      ["POST /api/v1/readings/upload", firstThenRegistered(eilat, result({ inserted: 2 }))],
    ]);

    await uploadWeek();
    await userEvent.click(await screen.findByRole("button", { name: /Review/ }));
    await userEvent.click(screen.getByRole("button", { name: "Add and upload again" }));

    const resent = at(fetchMock.mock.calls, 1)[1]?.body as FormData;
    expect(resent.get("file")).toBe(WEEK);
    expect(JSON.parse(resent.get("register") as string)).toEqual({ branches: [{ name: "Eilat", city: "Eilat" }], fridges: [] });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const counts = screen.getByRole("list", { name: "Upload result" });
    expect(within(counts).getAllByRole("listitem")[0]).toHaveTextContent("2saved");
    expect(screen.queryByRole("button", { name: /Review/ })).not.toBeInTheDocument();
  });

  it("keeps the dialog open with the backend's reason when the entries are refused", async () => {
    const eilat = result({ rejected: 1, unknown: { branches: [], loggers: [{ logger: "TL-0600", branch: "Haifa", fridge: "Dairy" }] } });
    const refused = { errors: [{ field: "body", message: "Fridge 'Dairy' in Haifa already has logger TL-0231" }] };
    mockApi([
      ["POST /api/v1/readings/upload", firstThenRegistered(eilat, json(422, refused))],
    ]);

    await uploadWeek();
    await userEvent.click(await screen.findByRole("button", { name: /Review/ }));
    await userEvent.click(screen.getByRole("button", { name: "Add and upload again" }));

    const dialog = screen.getByRole("dialog", { name: "New in this file" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Fridge 'Dairy' in Haifa already has logger TL-0231");
  });

  it("shows the backend message when the file is not an .xlsx or .csv file", async () => {
    mockApi([
      ["POST /api/v1/readings/upload", () => json(415, { error: "Unsupported file format. Upload an .xlsx or .csv file" })],
    ]);

    await uploadWeek();

    expect(await screen.findByRole("alert")).toHaveTextContent("Unsupported file format. Upload an .xlsx or .csv file");
    expect(screen.queryByRole("list", { name: "Upload result" })).not.toBeInTheDocument();
  });

  it("lists the missing columns as rows to fix when the header lacks them", async () => {
    mockApi([
      ["POST /api/v1/readings/upload", () => json(422, { errors: [{ row: 1, field: "temp", message: "Missing column" }] })],
    ]);

    await uploadWeek();

    const rows = await screen.findByRole("list", { name: "Rows to fix" });
    expect(within(rows).getByRole("listitem")).toHaveTextContent("Row 1Temperature — missing column");
  });
});

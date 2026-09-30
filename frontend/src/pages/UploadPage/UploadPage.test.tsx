import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SaveResult } from "../../lib/endpoints";
import { mockApi, renderLoggedIn } from "../../testUtils";

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
  it("uploads the chosen file and shows saved, duplicates and rows to fix", async () => {
    const fetchMock = mockApi([["POST /api/v1/readings/upload", result({ inserted: 2, duplicates: 0, rejected: 3 })]]);

    await uploadWeek();

    const counts = await screen.findByRole("list", { name: "Upload result" });
    expect(within(counts).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "2saved",
      "0duplicates skipped",
      "3rows to fix",
    ]);
    expect((fetchMock.mock.calls[0][1]?.body as FormData).get("file")).toBe(WEEK);
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
});

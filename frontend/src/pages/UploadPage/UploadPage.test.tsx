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
});

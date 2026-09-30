import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ThresholdProfile } from "../../lib/endpoints";
import { mockApi, renderLoggedIn } from "../../testUtils";

const DEFAULT: ThresholdProfile = {
  id: 1,
  name: "default",
  fridges: 4,
  growth_non_urgent: 0.1,
  growth_urgent: 1,
  deviation_non_urgent: 1.5,
  deviation_urgent: 3,
  gap_non_urgent_minutes: 15,
  gap_urgent_minutes: 120,
};
const COLD_ROOM: ThresholdProfile = { ...DEFAULT, id: 2, name: "Cold room", fridges: 0, gap_urgent_minutes: 60 };

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A JSON error response. */
function errorResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Return the parsed body of the first call with `method` to `path`. */
function sentBody(fetchMock: ReturnType<typeof mockApi>, method: string, path: string) {
  const call = fetchMock.mock.calls.find(([input, init]) => init?.method === method && input === `/api/v1${path}`);
  return call && JSON.parse(call[1]!.body as string);
}

describe("ThresholdsPage list", () => {
  it("opens the first profile with its values and lists the others", async () => {
    mockApi([["GET /api/v1/threshold-settings", [DEFAULT, COLD_ROOM]]]);
    renderLoggedIn("/thresholds");

    expect(await screen.findByRole("textbox", { name: "Name" })).toHaveValue("default");
    expect(screen.getByRole("textbox", { name: "Rise non-urgent, degrees C" })).toHaveValue("0.1");
    expect(screen.getByRole("textbox", { name: "Gap urgent, minutes" })).toHaveValue("120");
    expect(screen.getByRole("button", { name: "Cold room Used by 0 fridges" })).toBeInTheDocument();
  });

  it("opens another profile when the user picks it", async () => {
    mockApi([["GET /api/v1/threshold-settings", [DEFAULT, COLD_ROOM]]]);
    renderLoggedIn("/thresholds");

    await userEvent.click(await screen.findByRole("button", { name: "Cold room Used by 0 fridges" }));

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Cold room");
    expect(screen.getByRole("textbox", { name: "Gap urgent, minutes" })).toHaveValue("60");
    expect(screen.getByRole("button", { name: "default Used by 4 fridges" })).toBeInTheDocument();
  });

  it("says where to move a fridge to another profile", async () => {
    mockApi([["GET /api/v1/threshold-settings", [DEFAULT]]]);
    renderLoggedIn("/thresholds");

    expect(await screen.findByText("Move a fridge to other threshold settings from Branches → edit fridge.")).toBeInTheDocument();
  });

  it("shows an error when the profiles cannot be loaded", async () => {
    mockApi([]);
    renderLoggedIn("/thresholds");

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the threshold settings. Try again.");
  });
});

describe("ThresholdsPage save", () => {
  it("replaces the open profile with the typed values and shows the saved values", async () => {
    const fetchMock = mockApi([
      ["GET /api/v1/threshold-settings", [DEFAULT]],
      ["PUT /api/v1/threshold-settings/1", { ...DEFAULT, gap_non_urgent_minutes: 30 }],
    ]);
    renderLoggedIn("/thresholds");
    const gap = await screen.findByRole("textbox", { name: "Gap non-urgent, minutes" });

    await userEvent.clear(gap);
    await userEvent.type(gap, "30");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Threshold settings saved.");
    expect(sentBody(fetchMock, "PUT", "/threshold-settings/1")).toEqual({
      name: "default",
      growth_non_urgent: "0.1",
      growth_urgent: "1",
      deviation_non_urgent: "1.5",
      deviation_urgent: "3",
      gap_non_urgent_minutes: "30",
      gap_urgent_minutes: "120",
    });
  });

  it("shows the backend's 422 messages under the matching fields", async () => {
    mockApi([
      ["GET /api/v1/threshold-settings", [DEFAULT]],
      [
        "PUT /api/v1/threshold-settings/1",
        () =>
          errorResponse(422, {
            errors: [
              { field: "body", message: "growth_non_urgent must be lower than growth_urgent" },
              { field: "gap_urgent_minutes", message: "Input should be a valid integer, unable to parse string as an integer" },
            ],
          }),
      ],
    ]);
    renderLoggedIn("/thresholds");

    await userEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByRole("textbox", { name: "Rise non-urgent, degrees C" })).toHaveAccessibleDescription(
      "Must be lower than urgent",
    );
    expect(screen.getByRole("textbox", { name: "Gap urgent, minutes" })).toHaveAccessibleDescription(
      "Input should be a valid integer, unable to parse string as an integer",
    );
  });

  it("shows the backend's message when the name is already taken", async () => {
    mockApi([
      ["GET /api/v1/threshold-settings", [DEFAULT]],
      [
        "PUT /api/v1/threshold-settings/1",
        () => errorResponse(409, { error: "Conflicts with existing data (duplicate name, logger id or reading time)" }),
      ],
    ]);
    renderLoggedIn("/thresholds");

    await userEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Conflicts with existing data");
  });
});

describe("ThresholdsPage delete", () => {
  it("deletes an unused profile after the user confirms", async () => {
    const fetchMock = mockApi([
      ["GET /api/v1/threshold-settings", [DEFAULT, COLD_ROOM]],
      ["DELETE /api/v1/threshold-settings/2", () => new Response(null, { status: 204 })],
    ]);
    renderLoggedIn("/thresholds");

    await userEvent.click(await screen.findByRole("button", { name: "Delete threshold settings Cold room" }));
    const dialog = screen.getByRole("dialog", { name: "Delete Cold room?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: /Cold room/ })).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(true);
  });

  it("keeps the profile when the user cancels", async () => {
    const fetchMock = mockApi([["GET /api/v1/threshold-settings", [DEFAULT, COLD_ROOM]]]);
    renderLoggedIn("/thresholds");

    await userEvent.click(await screen.findByRole("button", { name: "Delete threshold settings Cold room" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cold room Used by 0 fridges" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });

  it("shows the backend's message when a fridge started using the profile", async () => {
    mockApi([
      ["GET /api/v1/threshold-settings", [DEFAULT, COLD_ROOM]],
      [
        "DELETE /api/v1/threshold-settings/2",
        () => errorResponse(409, { error: "Conflicts with existing data (duplicate name, logger id or reading time)" }),
      ],
    ]);
    renderLoggedIn("/thresholds");

    await userEvent.click(await screen.findByRole("button", { name: "Delete threshold settings Cold room" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Conflicts with existing data");
    expect(screen.getByRole("button", { name: "Cold room Used by 0 fridges" })).toBeInTheDocument();
  });
});

describe("ThresholdsPage new profile", () => {
  it("starts from the suggested limits and creates the profile with POST", async () => {
    const fetchMock = mockApi([
      ["GET /api/v1/threshold-settings", [DEFAULT]],
      ["POST /api/v1/threshold-settings", { ...DEFAULT, id: 5, name: "Dairy", fridges: 0 }],
    ]);
    renderLoggedIn("/thresholds");

    await userEvent.click(await screen.findByRole("button", { name: "+ New threshold settings" }));
    const name = screen.getByRole("textbox", { name: "Name" });
    expect(name).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Deviation urgent, degrees C" })).toHaveValue("3");
    expect(screen.getByRole("button", { name: "default Used by 4 fridges" })).toBeInTheDocument();

    await userEvent.type(name, "Dairy");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Used by 0 fridges")).toBeInTheDocument();
    expect(sentBody(fetchMock, "POST", "/threshold-settings")).toEqual({
      name: "Dairy",
      growth_non_urgent: "0.1",
      growth_urgent: "1",
      deviation_non_urgent: "1.5",
      deviation_urgent: "3",
      gap_non_urgent_minutes: "15",
      gap_urgent_minutes: "120",
    });
  });

  it("shows the 422 message under the name when it is empty", async () => {
    mockApi([
      ["GET /api/v1/threshold-settings", [DEFAULT]],
      [
        "POST /api/v1/threshold-settings",
        () => errorResponse(422, { errors: [{ field: "name", message: "String should have at least 1 character" }] }),
      ],
    ]);
    renderLoggedIn("/thresholds");

    await userEvent.click(await screen.findByRole("button", { name: "+ New threshold settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("textbox", { name: "Name" })).toHaveAccessibleDescription(
      "String should have at least 1 character",
    );
  });
});

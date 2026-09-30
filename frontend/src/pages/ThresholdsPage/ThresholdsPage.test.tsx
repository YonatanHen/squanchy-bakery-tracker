import { screen } from "@testing-library/react";
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

describe("ThresholdsPage list", () => {
  it("opens the first profile with its values and lists the others", async () => {
    mockApi([["GET /api/v1/threshold-settings", [DEFAULT, COLD_ROOM]]]);
    renderLoggedIn("/thresholds");

    expect(await screen.findByRole("textbox", { name: "Profile name" })).toHaveValue("default");
    expect(screen.getByRole("textbox", { name: "Rise non-urgent, degrees C" })).toHaveValue("0.1");
    expect(screen.getByRole("textbox", { name: "Gap urgent, minutes" })).toHaveValue("120");
    expect(screen.getByRole("button", { name: "Cold room Used by 0 fridges" })).toBeInTheDocument();
  });

  it("opens another profile when the user picks it", async () => {
    mockApi([["GET /api/v1/threshold-settings", [DEFAULT, COLD_ROOM]]]);
    renderLoggedIn("/thresholds");

    await userEvent.click(await screen.findByRole("button", { name: "Cold room Used by 0 fridges" }));

    expect(screen.getByRole("textbox", { name: "Profile name" })).toHaveValue("Cold room");
    expect(screen.getByRole("textbox", { name: "Gap urgent, minutes" })).toHaveValue("60");
    expect(screen.getByRole("button", { name: "default Used by 4 fridges" })).toBeInTheDocument();
  });

  it("says where to move a fridge to another profile", async () => {
    mockApi([["GET /api/v1/threshold-settings", [DEFAULT]]]);
    renderLoggedIn("/thresholds");

    expect(await screen.findByText("Move a fridge to another profile from Branches → edit fridge.")).toBeInTheDocument();
  });

  it("shows an error when the profiles cannot be loaded", async () => {
    mockApi([]);
    renderLoggedIn("/thresholds");

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the threshold profiles. Try again.");
  });
});

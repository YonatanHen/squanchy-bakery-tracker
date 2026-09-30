import { describe, expect, it } from "vitest";
import { thresholdSettingsErrors } from "./thresholdSettingsErrors";

describe("thresholdSettingsErrors", () => {
  it("keeps each field error's backend message under its field", () => {
    const errors = thresholdSettingsErrors([
      { field: "name", message: "String should have at least 1 character" },
      { field: "gap_urgent_minutes", message: "Input should be greater than 0" },
    ]);

    expect(errors).toEqual({
      name: "String should have at least 1 character",
      gap_urgent_minutes: "Input should be greater than 0",
    });
  });

  it("keeps a min-not-below-max error on the min field", () => {
    const errors = thresholdSettingsErrors([{ field: "min_temp", message: "Must be lower than the max limit" }]);

    expect(errors).toEqual({ min_temp: "Must be lower than the max limit" });
  });
});

import { describe, expect, it } from "vitest";
import { profileErrors } from "./profileErrors";

describe("profileErrors", () => {
  it("keeps each field error's backend message under its field", () => {
    const errors = profileErrors([
      { field: "name", message: "String should have at least 1 character" },
      { field: "gap_urgent_minutes", message: "Input should be greater than 0" },
    ]);

    expect(errors).toEqual({
      name: "String should have at least 1 character",
      gap_urgent_minutes: "Input should be greater than 0",
    });
  });

  it("puts a non-urgent-not-below-urgent error under the non-urgent field", () => {
    const errors = profileErrors([{ field: "body", message: "deviation_non_urgent must be lower than deviation_urgent" }]);

    expect(errors).toEqual({ deviation_non_urgent: "Must be lower than urgent" });
  });
});

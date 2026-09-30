import { describe, expect, it } from "vitest";
import { formatClock, formatDay, formatShort, toDateTimeLocal } from "./format";

// The API sends naive local times (no timezone), as the loggers record them
const TIME = "2026-09-14T06:15:00";

describe("date formats", () => {
  it("shows the weekday, day and month for cards", () => {
    expect(formatDay(TIME)).toBe("Mon 14 Sep");
    expect(formatDay("2026-09-17T06:00:00")).toBe("Thu 17 Sep");
  });

  it("shows the time of day", () => {
    expect(formatClock(TIME)).toBe("06:15");
  });

  it("shows day/month and time for tables", () => {
    expect(formatShort(TIME)).toBe("14/09 06:15");
  });

  it("gives the datetime-local input value without seconds", () => {
    expect(toDateTimeLocal(TIME)).toBe("2026-09-14T06:15");
  });
});

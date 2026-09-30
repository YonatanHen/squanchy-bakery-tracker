import { describe, expect, it } from "vitest";
import { formatTemp, fromCelsius, toCelsius } from "./units";

describe("toCelsius", () => {
  it("converts a Fahrenheit logger value (Haifa 38.3°F ≈ 3.5°C)", () => {
    expect(toCelsius(38.3, "F")).toBeCloseTo(3.5, 1);
  });

  it("keeps a Celsius value unchanged", () => {
    expect(toCelsius(4.1, "C")).toBe(4.1);
  });
});

describe("fromCelsius", () => {
  it("converts Celsius to Fahrenheit", () => {
    expect(fromCelsius(5, "F")).toBeCloseTo(41, 5);
  });

  it("keeps Celsius unchanged", () => {
    expect(fromCelsius(5, "C")).toBe(5);
  });
});

describe("formatTemp", () => {
  it("shows a Fahrenheit reading in Celsius with one decimal", () => {
    expect(formatTemp(38.3, "F", "C")).toBe("3.5 °C");
  });

  it("shows a Celsius reading in Fahrenheit", () => {
    expect(formatTemp(5.4, "C", "F")).toBe("41.7 °F");
  });

  it("shows a reading in its own unit unchanged", () => {
    expect(formatTemp(38.3, "F", "F")).toBe("38.3 °F");
  });

  it("shows an ERR reading (null temp) as a dash", () => {
    expect(formatTemp(null, "F", "C")).toBe("—");
  });
});

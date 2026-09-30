import { describe, expect, it } from "vitest";
import { convertTypedTemp, formatTemp, fromCelsius, toCelsius } from "./units";

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

describe("convertTypedTemp", () => {
  it("converts a typed filter value to the new unit, one decimal at most", () => {
    expect(convertTypedTemp("5", "C", "F")).toBe("41");
    expect(convertTypedTemp("38.3", "F", "C")).toBe("3.5");
  });

  it("keeps empty or non-numeric text as typed", () => {
    expect(convertTypedTemp("", "C", "F")).toBe("");
    expect(convertTypedTemp("abc", "C", "F")).toBe("abc");
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

  it("drops the unit letter in the compact card format", () => {
    expect(formatTemp(38.3, "F", "C", { compact: true })).toBe("3.5°");
    expect(formatTemp(null, "F", "C", { compact: true })).toBe("—");
  });
});

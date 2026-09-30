import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TemperatureField } from "./TemperatureField";

describe("TemperatureField", () => {
  it("is a labeled decimal input that reports the typed text, ERR included", async () => {
    const onChange = vi.fn();
    render(<TemperatureField label="Temperature (°F, or ERR)" value="" onChange={onChange} />);

    const input = screen.getByLabelText("Temperature (°F, or ERR)");
    expect(input).toHaveAttribute("inputmode", "decimal");
    await userEvent.type(input, "E");
    expect(onChange).toHaveBeenLastCalledWith("E");
  });

  it("links the backend error to the input", () => {
    render(<TemperatureField label="Min °C" value="x" onChange={() => {}} error="Enter a number" />);

    expect(screen.getByLabelText("Min °C")).toHaveAccessibleDescription("Enter a number");
  });
});

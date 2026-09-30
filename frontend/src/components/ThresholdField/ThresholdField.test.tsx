import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThresholdField } from "./ThresholdField";

describe("ThresholdField", () => {
  it("shows the unit as its label and names the input in full", () => {
    render(<ThresholdField label="Rise urgent, degrees C" unit="°C" value="1.0" onChange={() => {}} />);

    expect(screen.getByText("°C")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Rise urgent, degrees C" })).toHaveValue("1.0");
  });

  it("reports the typed text", async () => {
    const onChange = vi.fn();
    render(<ThresholdField label="Gap urgent, minutes" unit="min" value="" onChange={onChange} />);

    await userEvent.type(screen.getByRole("textbox", { name: "Gap urgent, minutes" }), "9");

    expect(onChange).toHaveBeenCalledWith("9");
  });

  it("links the error to the input", () => {
    render(<ThresholdField label="Rise non-urgent, degrees C" unit="°C" value="2" onChange={() => {}} error="Must be lower than the urgent limit" />);

    const input = screen.getByRole("textbox", { name: "Rise non-urgent, degrees C" });
    expect(input).toHaveAccessibleDescription("Must be lower than the urgent limit");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedToggle } from "./SegmentedToggle";

const UNITS = [
  { value: "C", label: "°C" },
  { value: "F", label: "°F" },
] as const;

describe("SegmentedToggle", () => {
  it("is a labeled group that marks the selected option as pressed", () => {
    render(<SegmentedToggle label="Unit" options={UNITS} value="C" onChange={() => {}} />);

    expect(screen.getByRole("group", { name: "Unit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "°C" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "°F" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the option the user picks", async () => {
    const onChange = vi.fn();
    render(<SegmentedToggle label="Unit" options={UNITS} value="C" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "°F" }));

    expect(onChange).toHaveBeenCalledWith("F");
  });
});

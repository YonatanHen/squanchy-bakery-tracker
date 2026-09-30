import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateTimeField } from "./DateTimeField";

describe("DateTimeField", () => {
  it("is a labeled datetime-local input that reports the browser value as is", () => {
    const onChange = vi.fn();
    render(<DateTimeField label="Time" value="2026-09-14T08:30" onChange={onChange} />);

    const input = screen.getByLabelText("Time");
    expect(input).toHaveAttribute("type", "datetime-local");
    fireEvent.change(input, { target: { value: "2026-09-14T08:45" } });
    expect(onChange).toHaveBeenCalledWith("2026-09-14T08:45");
  });

  it("can pick a day only, for the From and To filters", () => {
    render(<DateTimeField label="From" dateOnly value="" onChange={() => {}} />);

    expect(screen.getByLabelText("From")).toHaveAttribute("type", "date");
  });

  it("links the backend error to the input", () => {
    render(<DateTimeField label="Time" value="" onChange={() => {}} error="Another reading has this time" />);

    expect(screen.getByLabelText("Time")).toHaveAccessibleDescription("Another reading has this time");
  });
});

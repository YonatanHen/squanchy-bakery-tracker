import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("shows the message and the optional hint", () => {
    render(<EmptyState message="No readings match these filters." hint="Clear a filter to see more." />);

    expect(screen.getByText("No readings match these filters.")).toBeInTheDocument();
    expect(screen.getByText("Clear a filter to see more.")).toBeInTheDocument();
  });
});

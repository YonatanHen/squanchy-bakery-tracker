import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("shows its content in the default tone", () => {
    render(<Card>Cream cakes</Card>);

    expect(screen.getByText("Cream cakes")).toHaveAttribute("data-tone", "default");
  });

  it.each(["urgent", "light"] as const)("marks the %s alert tone", (tone) => {
    render(<Card tone={tone}>Spike</Card>);

    expect(screen.getByText("Spike")).toHaveAttribute("data-tone", tone);
  });
});

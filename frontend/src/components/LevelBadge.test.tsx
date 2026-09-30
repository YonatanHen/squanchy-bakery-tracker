import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LevelBadge } from "./LevelBadge";

describe("LevelBadge", () => {
  it.each([
    ["URGENT", "Urgent"],
    ["NON_URGENT", "Non-urgent"],
    ["ERR", "ERR"],
  ] as const)("labels the %s level", (level, text) => {
    render(<LevelBadge level={level} />);

    expect(screen.getByText(text)).toHaveAttribute("data-level", level);
  });

  it("can show a custom text in the level's style", () => {
    render(<LevelBadge level="URGENT">2 alerts</LevelBadge>);

    expect(screen.getByText("2 alerts")).toHaveAttribute("data-level", "URGENT");
  });
});

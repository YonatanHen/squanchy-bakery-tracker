import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("shows the page title as the level-1 heading next to its actions", () => {
    render(
      <PageHeader title="Readings">
        <button>°C</button>
      </PageHeader>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Readings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "°C" })).toBeInTheDocument();
  });
});

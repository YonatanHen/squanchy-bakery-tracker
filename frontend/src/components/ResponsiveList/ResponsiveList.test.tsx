import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResponsiveList } from "./ResponsiveList";

const ROWS = [
  { id: 1, fridge: "Dairy" },
  { id: 2, fridge: "Cream cakes" },
];

describe("ResponsiveList", () => {
  it("renders the rows as a labeled card list and as a labeled table", () => {
    render(
      <ResponsiveList
        label="Readings"
        rows={ROWS}
        rowKey={(r) => r.id}
        renderCard={(r) => <span>{`card ${r.fridge}`}</span>}
        columns={[{ key: "fridge", header: "Fridge", cell: (r) => r.fridge }]}
        rowTone={(r) => (r.id === 2 ? "urgent" : "default")}
      />,
    );

    const list = screen.getByRole("list", { name: "Readings" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["card Dairy", "card Cream cakes"]);
    const table = screen.getByRole("table", { name: "Readings" });
    expect(within(table).getAllByRole("row")[2]).toHaveAttribute("data-tone", "urgent");
  });
});

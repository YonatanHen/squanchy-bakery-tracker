import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { at } from "../../testUtils";
import { DataTable, type Column } from "./DataTable";

interface Row {
  id: number;
  fridge: string;
  temp: string;
}

const COLUMNS: Column<Row>[] = [
  { key: "fridge", header: "Fridge", cell: (r) => r.fridge },
  { key: "temp", header: "Temperature", cell: (r) => r.temp, mono: true },
  { key: "actions", header: "Actions", cell: () => <button>Edit</button>, hideHeader: true },
];

const ROWS: Row[] = [
  { id: 1, fridge: "Dairy", temp: "3.8 °C" },
  { id: 2, fridge: "Display 2", temp: "9.4 °C" },
];

describe("DataTable", () => {
  it("renders a labeled table with one row per item", () => {
    render(<DataTable label="Readings" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);

    const table = screen.getByRole("table", { name: "Readings" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(at(rows, 2)).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Display 2", "9.4 °C", "Edit"]);
  });

  it("keeps a visually hidden header readable by screen readers", () => {
    render(<DataTable label="Readings" columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);

    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
  });

  it("marks each row with its alert tone", () => {
    render(
      <DataTable
        label="Readings"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        rowTone={(r) => (r.id === 2 ? "light" : "default")}
      />,
    );

    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveAttribute("data-tone", "default");
    expect(rows[2]).toHaveAttribute("data-tone", "light");
  });
});

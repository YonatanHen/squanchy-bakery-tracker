import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Reading } from "../../lib/endpoints";
import { ReadingCard } from "./ReadingCard";

const HAIFA: Reading = {
  id: 4,
  time: "2026-09-14T06:00:00",
  temp: 38.3,
  metric: "F",
  status: "OK",
  logger_id: "TL-0231",
  fridge: "Dairy",
  branch: "Haifa",
  city: "Haifa",
};

describe("ReadingCard", () => {
  it("shows the day, time, place and the temperature in the selected unit", () => {
    render(<ReadingCard reading={HAIFA} unit="C" alerts={[]} onEdit={() => {}} />);

    expect(screen.getByText("Mon 14 Sep · 06:00")).toBeInTheDocument();
    expect(screen.getByText(/Haifa · Dairy ·/)).toHaveTextContent("Haifa · Dairy · TL-0231");
    expect(screen.getByText("3.5°")).toBeInTheDocument();
  });

  it("shows an ERR reading as a dash with the ERR badge", () => {
    render(<ReadingCard reading={{ ...HAIFA, temp: null, status: "ERR" }} unit="C" alerts={[]} onEdit={() => {}} />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("ERR")).toHaveAttribute("data-level", "ERR");
  });

  it("counts the reading's alerts in the most severe level's color", () => {
    render(<ReadingCard reading={HAIFA} unit="C" alerts={["NON_URGENT", "URGENT"]} onEdit={() => {}} />);

    expect(screen.getByText("2 alerts")).toHaveAttribute("data-level", "URGENT");
  });

  it("opens the edit dialog for this reading", async () => {
    const onEdit = vi.fn();
    render(<ReadingCard reading={HAIFA} unit="C" alerts={[]} onEdit={onEdit} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit reading" }));

    expect(onEdit).toHaveBeenCalledWith(HAIFA);
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Alert } from "../../lib/endpoints";
import { AlertCard } from "./AlertCard";

const GAP: Alert = {
  id: 1,
  level: "URGENT",
  description: "No reading for 71h 30m before this reading",
  reading_id: 9,
  time: "2026-09-17T06:00:00",
  temp: 3.7,
  metric: "C",
  logger_id: "TL-0417",
  fridge: "Display 2",
  branch: "Tel Aviv",
  city: "Tel Aviv",
};

describe("AlertCard", () => {
  it("shows an urgent alert's level, what happened, and where and when", () => {
    render(<AlertCard alert={GAP} />);

    expect(screen.getByText("Urgent")).toHaveAttribute("data-level", "URGENT");
    expect(screen.getByText("No reading for 71h 30m before this reading")).toBeInTheDocument();
    expect(screen.getByText("Tel Aviv · Display 2 · Thu 17 Sep 06:00")).toBeInTheDocument();
    expect(screen.getByText("Urgent").closest("[data-tone]")).toHaveAttribute("data-tone", "urgent");
  });

  it("shows a non-urgent alert in the light style", () => {
    render(<AlertCard alert={{ ...GAP, level: "NON_URGENT", description: "Spike: 9.4°C against an average of 4.0°C" }} />);

    expect(screen.getByText("Non-urgent")).toHaveAttribute("data-level", "NON_URGENT");
    expect(screen.getByText("Non-urgent").closest("[data-tone]")).toHaveAttribute("data-tone", "light");
  });

  it("says when an archived alert was archived", () => {
    render(<AlertCard alert={{ ...GAP, archived_at: "2026-09-20T10:05:00" }} />);

    expect(screen.getByText("Archived 20/09 10:05")).toBeInTheDocument();
  });
});

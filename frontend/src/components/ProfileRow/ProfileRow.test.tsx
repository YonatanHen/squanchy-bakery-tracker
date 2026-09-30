import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfileRow } from "./ProfileRow";

describe("ProfileRow", () => {
  it("shows the name and the fridge count, and opens the profile on click", async () => {
    const onOpen = vi.fn();
    render(<ProfileRow name="Dairy" fridges={2} onOpen={onOpen} onDelete={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: "Dairy Used by 2 fridges" }));

    expect(onOpen).toHaveBeenCalled();
  });

  it("offers delete for a profile no fridge uses", async () => {
    const onDelete = vi.fn();
    render(<ProfileRow name="Cold room" fridges={0} onOpen={() => {}} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete threshold settings Cold room" }));

    expect(onDelete).toHaveBeenCalled();
  });

  it("hides delete while fridges use the profile", () => {
    render(<ProfileRow name="Dairy" fridges={2} onOpen={() => {}} onDelete={() => {}} />);

    expect(screen.queryByRole("button", { name: /Delete threshold settings/ })).not.toBeInTheDocument();
  });
});

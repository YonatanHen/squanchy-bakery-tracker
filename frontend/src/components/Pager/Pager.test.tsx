import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pager } from "./Pager";

describe("Pager", () => {
  it("shows the range of the current page", () => {
    render(<Pager offset={50} limit={50} count={11} total={61} onPage={() => {}} />);

    expect(screen.getByText("51–61 of 61")).toBeInTheDocument();
  });

  it("moves by one page and disables the ends", async () => {
    const onPage = vi.fn();
    render(<Pager offset={0} limit={50} count={50} total={61} onPage={onPage} />);

    expect(screen.getByRole("button", { name: "← Previous" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next →" }));
    expect(onPage).toHaveBeenCalledWith(50);
  });

  it("hides the buttons when everything fits on one page", () => {
    render(<Pager offset={0} limit={50} count={3} total={3} onPage={() => {}} />);

    expect(screen.getByText("1–3 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

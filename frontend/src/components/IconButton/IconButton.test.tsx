import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EditIcon, TrashIcon } from "../icons/icons";
import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("names the icon-only button with its label and fires onClick", async () => {
    const onClick = vi.fn();
    render(<IconButton label="Edit Jerusalem" icon={<EditIcon />} onClick={onClick} />);

    const button = screen.getByRole("button", { name: "Edit Jerusalem" });
    expect(button).toHaveAttribute("data-tone", "neutral");
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("marks the delete action with the danger tone", () => {
    render(<IconButton label="Delete Jerusalem" tone="danger" icon={<TrashIcon />} onClick={() => {}} />);

    expect(screen.getByRole("button", { name: "Delete Jerusalem" })).toHaveAttribute("data-tone", "danger");
  });
});

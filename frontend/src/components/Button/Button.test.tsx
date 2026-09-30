import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it.each(["primary", "secondary", "danger", "link", "danger-link"] as const)("renders the %s variant and fires onClick", async (variant) => {
    const onClick = vi.fn();
    render(
      <Button variant={variant} onClick={onClick}>
        Sign out
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Sign out" });
    expect(button).toHaveAttribute("data-variant", variant);
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("defaults to a primary, non-submit button", () => {
    render(<Button>Apply</Button>);

    const button = screen.getByRole("button", { name: "Apply" });
    expect(button).toHaveAttribute("data-variant", "primary");
    expect(button).toHaveAttribute("type", "button");
  });

  it("can submit its form", () => {
    render(<Button type="submit">Sign in</Button>);

    expect(screen.getByRole("button", { name: "Sign in" })).toHaveAttribute("type", "submit");
  });
});

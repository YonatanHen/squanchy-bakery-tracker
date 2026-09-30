import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./Field";

describe("Field", () => {
  it("labels its control", () => {
    render(<Field label="Username">{(control) => <input {...control} />}</Field>);

    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });

  it("links the error to the control with aria-describedby and marks it invalid", () => {
    render(
      <Field label="Username" error="Field required">
        {(control) => <input {...control} />}
      </Field>,
    );

    const input = screen.getByLabelText("Username");
    expect(input).toHaveAccessibleDescription("Field required");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("links the hint to the control", () => {
    render(
      <Field label="Temperature" hint="In the fridge's own unit">
        {(control) => <input {...control} />}
      </Field>,
    );

    expect(screen.getByLabelText("Temperature")).toHaveAccessibleDescription("In the fridge's own unit");
  });
});

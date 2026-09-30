import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Field } from "./Field";
import { TextInput } from "./TextInput";

describe("TextInput", () => {
  it("works inside a Field and reports typed text", async () => {
    const onChange = vi.fn();
    render(
      <Field label="Username" error="Field required">
        {(control) => <TextInput {...control} value="" onChange={onChange} />}
      </Field>,
    );

    const input = screen.getByLabelText("Username");
    await userEvent.type(input, "a");

    expect(onChange).toHaveBeenCalled();
    expect(input).toHaveAccessibleDescription("Field required");
  });

  it("supports the password type", () => {
    render(
      <Field label="Password">{(control) => <TextInput {...control} type="password" defaultValue="" />}</Field>,
    );

    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });
});

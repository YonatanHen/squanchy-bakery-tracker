import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Combobox } from "./Combobox";

const BRANCHES = ["Haifa", "Rishon LeZion", "Tel Aviv"];

/** A Combobox with its own value state; reports each change to `onChange`. */
function Harness({ onChange = () => {}, initial = "" }: { onChange?: (value: string) => void; initial?: string }) {
  const [value, setValue] = useState<string>(initial);
  return (
    <Combobox
      label="Branch"
      value={value}
      options={BRANCHES}
      newOptionLabel={(text) => `Use “${text}” as a new branch…`}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

/** The option texts of the open list. */
function optionTexts(): string[] {
  return within(screen.getByRole("listbox")).getAllByRole("option").map((option) => option.textContent ?? "");
}

describe("Combobox", () => {
  it("filters the options by the typed text and picks one on click", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const input = screen.getByRole("combobox", { name: "Branch" });
    await userEvent.type(input, "ris");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(optionTexts()).toEqual(["Rishon LeZion", "Use “ris” as a new branch…"]);

    await userEvent.click(screen.getByRole("option", { name: "Rishon LeZion" }));
    expect(onChange).toHaveBeenLastCalledWith("Rishon LeZion");
    expect(input).toHaveValue("Rishon LeZion");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens with ArrowDown, moves the active option with the arrows and picks it with Enter", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const input = screen.getByRole("combobox", { name: "Branch" });
    input.focus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowUp}");
    const active = screen.getByRole("option", { name: "Rishon LeZion" });
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", active.id);

    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("Rishon LeZion");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("offers the typed text as a new value only when no option matches it exactly", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    const input = screen.getByRole("combobox", { name: "Branch" });
    await userEvent.type(input, "haifa");
    expect(optionTexts()).toEqual(["Haifa"]);

    await userEvent.clear(input);
    await userEvent.type(input, "Eilat");
    await userEvent.click(screen.getByRole("option", { name: "Use “Eilat” as a new branch…" }));
    expect(onChange).toHaveBeenLastCalledWith("Eilat");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes the list when focus leaves the input", async () => {
    render(
      <>
        <Harness />
        <button type="button">Next</button>
      </>,
    );

    await userEvent.type(screen.getByRole("combobox", { name: "Branch" }), "Hai");
    await userEvent.tab();

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes the list on Escape and keeps the typed text", async () => {
    render(<Harness />);

    const input = screen.getByRole("combobox", { name: "Branch" });
    await userEvent.type(input, "Eil{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("Eil");
  });
});

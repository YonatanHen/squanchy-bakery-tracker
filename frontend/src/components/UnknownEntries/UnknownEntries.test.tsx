import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { UnknownEntries as Entries } from "../../lib/endpoints";
import { UnknownEntries } from "./UnknownEntries";

/** Render the dialog for `entries` with spy callbacks. */
function renderEntries(entries: Entries, props: Partial<Parameters<typeof UnknownEntries>[0]> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <UnknownEntries
      open
      title="New in this file"
      entries={entries}
      confirmLabel="Add and upload again"
      suggestionHint="fix the file and upload again"
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />,
  );
  return { onConfirm, onClose };
}

describe("UnknownEntries", () => {
  it("offers the close registered name for a misspelled branch, without adding it", () => {
    renderEntries({ branches: [{ name: "Rishon LeZoin", suggestion: "Rishon LeZion" }], loggers: [] });

    const dialog = screen.getByRole("dialog", { name: "New in this file" });
    expect(dialog).toHaveTextContent("Branch “Rishon LeZoin” does not exist.");
    expect(dialog).toHaveTextContent("Did you mean Rishon LeZion → fix the file and upload again");
    expect(within(dialog).queryByLabelText("City")).not.toBeInTheDocument();
  });

  it("adds a new branch with its city (prefilled from the name) and optional address", async () => {
    const { onConfirm } = renderEntries({ branches: [{ name: "Eilat", suggestion: null }], loggers: [] });

    expect(screen.getByRole("dialog")).toHaveTextContent("Branch “Eilat” does not exist. Add it?");
    expect(screen.getByLabelText("City")).toHaveValue("Eilat");
    await userEvent.type(screen.getByLabelText("Street (optional)"), "HaTmarim");
    await userEvent.type(screen.getByLabelText("No. (optional)"), "12a");
    await userEvent.click(screen.getByRole("button", { name: "Add and upload again" }));

    expect(onConfirm).toHaveBeenCalledWith({
      branches: [{ name: "Eilat", city: "Eilat", street: "HaTmarim", building_number: "12a" }],
      fridges: [],
    });
  });

  it("leaves out the empty optional address fields", async () => {
    const { onConfirm } = renderEntries({ branches: [{ name: "Eilat" }], loggers: [] });

    await userEvent.click(screen.getByRole("button", { name: "Add and upload again" }));

    expect(onConfirm).toHaveBeenCalledWith({ branches: [{ name: "Eilat", city: "Eilat" }], fridges: [] });
  });

  it("closes without adding anything on Not now", async () => {
    const { onConfirm, onClose } = renderEntries({ branches: [{ name: "Eilat" }], loggers: [] });

    await userEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

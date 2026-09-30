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
});

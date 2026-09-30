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

  it("adds a new logger with its fridge and unit, edited before adding", async () => {
    const { onConfirm } = renderEntries({
      branches: [],
      loggers: [{ logger: "TL-0600", branch: "Haifa", fridge: "Dairy" }],
    });

    expect(screen.getByRole("dialog")).toHaveTextContent("Logger TL-0600 does not exist. Add it, or edit before adding.");
    expect(screen.getByLabelText("Logger id")).toHaveValue("TL-0600");
    expect(screen.getByRole("button", { name: "°C" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.clear(screen.getByLabelText("Fridge"));
    await userEvent.type(screen.getByLabelText("Fridge"), "Dairy 2");
    await userEvent.click(screen.getByRole("button", { name: "°F" }));
    await userEvent.click(screen.getByRole("button", { name: "Add and upload again" }));

    expect(onConfirm).toHaveBeenCalledWith({
      branches: [],
      fridges: [{ logger_id: "TL-0600", branch: "Haifa", fridge: "Dairy 2", metric: "F" }],
    });
  });

  it("adds a logger of a new branch together with that branch", async () => {
    const { onConfirm } = renderEntries({
      branches: [{ name: "Eilat" }],
      loggers: [{ logger: "TL-0700", branch: "Eilat", fridge: "Display" }],
    });

    await userEvent.click(screen.getByRole("button", { name: "Add and upload again" }));

    expect(onConfirm).toHaveBeenCalledWith({
      branches: [{ name: "Eilat", city: "Eilat" }],
      fridges: [{ logger_id: "TL-0700", branch: "Eilat", fridge: "Display", metric: "C" }],
    });
  });

  it("does not add a logger whose branch is misspelled; the branch must be fixed first", () => {
    renderEntries({
      branches: [{ name: "Rishon LeZoin", suggestion: "Rishon LeZion" }],
      loggers: [{ logger: "TL-0600", branch: "Rishon LeZoin", fridge: "Dairy" }],
    });

    expect(screen.getByRole("dialog")).toHaveTextContent("Logger TL-0600 does not exist. Fix its branch “Rishon LeZoin” first.");
    expect(screen.queryByLabelText("Logger id")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add and upload again" })).not.toBeInTheDocument();
  });

  it("shows why the backend refused the entries, and blocks a second send while busy", () => {
    renderEntries(
      { branches: [], loggers: [{ logger: "TL-0600", branch: "Haifa", fridge: "Dairy" }] },
      { errors: ["Fridge 'Dairy' in Haifa already has logger TL-0231; edit the fridge's logger instead"], busy: true },
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Fridge 'Dairy' in Haifa already has logger TL-0231");
    expect(screen.getByRole("button", { name: "Add and upload again" })).toBeDisabled();
  });

  it("closes without adding anything on Not now", async () => {
    const { onConfirm, onClose } = renderEntries({ branches: [{ name: "Eilat" }], loggers: [] });

    await userEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

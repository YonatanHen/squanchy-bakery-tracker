import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Reading } from "../../lib/endpoints";
import { makeBranch, makeFridge, mockApi } from "../../testUtils";
import { EditReadingDialog } from "./EditReadingDialog";

const JERUSALEM: Reading = {
  id: 12,
  time: "2026-09-14T08:30:00",
  temp: 4,
  metric: "C",
  status: "OK",
  logger_id: "TL-0512",
  fridge: "Dairy",
  branch: "Jerusalem",
  city: "Jerusalem",
};

const BRANCHES = [
  makeBranch(1, "Jerusalem", [makeFridge(1, "Dairy", "TL-0512")]),
  makeBranch(2, "Rishon LeZion", [makeFridge(2, "Cream cakes", "TL-0388")]),
];

/** Render the dialog for `reading` with spies for its callbacks. */
function renderDialog(reading: Reading = JERUSALEM) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<EditReadingDialog reading={reading} branches={BRANCHES} onClose={onClose} onSaved={onSaved} />);
  return { onClose, onSaved };
}

/** Return the [method, body] of every write call. */
function writes(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method && init.method !== "GET")
    .map(([input, init]) => [init!.method, input, init!.body ? JSON.parse(String(init!.body)) : undefined]);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("EditReadingDialog", () => {
  it("shows the reading's place and prefills its time and temperature in its own unit", () => {
    mockApi([]);
    renderDialog({ ...JERUSALEM, temp: 38.3, metric: "F" });

    expect(screen.getByRole("dialog", { name: "Edit reading" })).toHaveAccessibleDescription("Jerusalem · Dairy · TL-0512");
    expect(screen.getByLabelText("Time")).toHaveValue("2026-09-14T08:30");
    expect(screen.getByLabelText("Temperature (°F, or ERR)")).toHaveValue("38.3");
  });

  it("asks Are you sure? before saving, then sends only the changed field", async () => {
    const fetchMock = mockApi([["PATCH /api/v1/readings/12", { ...JERUSALEM, temp: 4.4 }]]);
    const { onSaved } = renderDialog();

    const temp = screen.getByLabelText("Temperature (°C, or ERR)");
    await userEvent.clear(temp);
    await userEvent.type(temp, "4.4");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    expect(screen.getByText(/4\.0 °C → 4\.4 °C\./)).toHaveTextContent(
      "The reading is changed in place and the fridge average is recalculated. Edits are not archived.",
    );
    expect(writes(fetchMock)).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Yes, save" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(writes(fetchMock)).toEqual([["PATCH", "/api/v1/readings/12", { temp: "4.4" }]]);
  });

  it("sends a changed time as the browser's YYYY-MM-DDTHH:MM value", async () => {
    const fetchMock = mockApi([["PATCH /api/v1/readings/12", JERUSALEM]]);
    renderDialog();

    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "2026-09-14T08:45" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, save" }));

    await waitFor(() => expect(writes(fetchMock)).toEqual([["PATCH", "/api/v1/readings/12", { time: "2026-09-14T08:45" }]]));
  });

  it("moves the reading to another fridge: the logger id follows the chosen branch and fridge", async () => {
    const fetchMock = mockApi([["PATCH /api/v1/readings/12", { ...JERUSALEM, logger_id: "TL-0388" }]]);
    renderDialog();

    expect(screen.getByLabelText("Fridge")).toHaveAccessibleDescription("Logger TL-0512");
    await userEvent.selectOptions(screen.getByLabelText("Branch"), "Rishon LeZion");
    expect(screen.getByLabelText("Fridge")).toHaveDisplayValue("Cream cakes");
    expect(screen.getByLabelText("Fridge")).toHaveAccessibleDescription("Logger TL-0388");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText(/Jerusalem · Dairy → Rishon LeZion · Cream cakes\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Yes, save" }));

    await waitFor(() => expect(writes(fetchMock)).toEqual([["PATCH", "/api/v1/readings/12", { logger_id: "TL-0388" }]]));
  });

  it("shows a rejected logger under the Fridge field", async () => {
    mockApi([
      [
        "PATCH /api/v1/readings/12",
        new Response(JSON.stringify({ errors: [{ field: "logger_id", message: "Unknown logger" }] }), { status: 422 }),
      ],
    ]);
    renderDialog();

    await userEvent.selectOptions(screen.getByLabelText("Branch"), "Rishon LeZion");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, save" }));

    await waitFor(() => expect(screen.getByLabelText("Fridge")).toHaveAccessibleDescription("Logger TL-0388 Unknown logger"));
  });

  it("changes only the unit of a Haifa value entered as °C by mistake, keeping the typed value", async () => {
    const haifa: Reading = { ...JERUSALEM, temp: 38.3, logger_id: "TL-0231", branch: "Haifa", city: "Haifa" };
    const fetchMock = mockApi([["PATCH /api/v1/readings/12", { ...haifa, metric: "F" }]]);
    renderDialog(haifa);

    const unit = screen.getByRole("group", { name: "Unit" });
    expect(within(unit).getByRole("button", { name: "°C" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(within(unit).getByRole("button", { name: "°F" }));
    expect(screen.getByLabelText("Temperature (°F, or ERR)")).toHaveValue("38.3");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText(/38\.3 °C → 38\.3 °F\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Yes, save" }));

    await waitFor(() => expect(writes(fetchMock)).toEqual([["PATCH", "/api/v1/readings/12", { metric: "F" }]]));
  });

  it("accepts ERR for a logger that reported no temperature", async () => {
    const fetchMock = mockApi([["PATCH /api/v1/readings/12", { ...JERUSALEM, temp: null, status: "ERR" }]]);
    renderDialog();

    const temp = screen.getByLabelText("Temperature (°C, or ERR)");
    await userEvent.clear(temp);
    await userEvent.type(temp, "ERR");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText(/4\.0 °C → ERR\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Yes, save" }));

    await waitFor(() => expect(writes(fetchMock)).toEqual([["PATCH", "/api/v1/readings/12", { temp: "ERR" }]]));
  });

  it("shows the backend's rejection under the field", async () => {
    mockApi([
      [
        "PATCH /api/v1/readings/12",
        new Response(JSON.stringify({ errors: [{ field: "temp", message: "Temperature must be a number or ERR" }] }), {
          status: 422,
        }),
      ],
    ]);
    const { onSaved } = renderDialog();

    const temp = screen.getByLabelText("Temperature (°C, or ERR)");
    await userEvent.clear(temp);
    await userEvent.type(temp, "hot");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, save" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Temperature (°C, or ERR)")).toHaveAccessibleDescription(
        "Temperature must be a number or ERR",
      ),
    );
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("explains a time clash with another reading of the logger (409)", async () => {
    mockApi([["PATCH /api/v1/readings/12", new Response(JSON.stringify({ error: "Conflicts" }), { status: 409 })]]);
    renderDialog();

    fireEvent.change(screen.getByLabelText("Time"), { target: { value: "2026-09-14T08:45" } });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, save" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Time")).toHaveAccessibleDescription("This logger already has a reading at this time."),
    );
  });

  it("deletes only after a confirmation that says the reading is archived", async () => {
    const fetchMock = mockApi([["DELETE /api/v1/readings/12", new Response(null, { status: 204 })]]);
    const { onSaved } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Delete reading (moves to the archive)" }));

    expect(screen.getByRole("dialog", { name: "Delete this reading?" })).toBeInTheDocument();
    expect(screen.getByText(/archived with its alerts/)).toBeInTheDocument();
    expect(writes(fetchMock)).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Delete reading" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(writes(fetchMock)).toEqual([["DELETE", "/api/v1/readings/12", undefined]]);
  });

  it("closes without saving on Cancel", async () => {
    const fetchMock = mockApi([]);
    const { onClose } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(writes(fetchMock)).toEqual([]);
  });
});

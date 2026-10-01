import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../../testUtils";
import { CleanArchive } from "./CleanArchive";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CleanArchive", () => {
  it("is disabled while the archive has no readings", async () => {
    const fetchMock = mockApi([
      ["GET /api/v1/readings", { items: [], total: 0, offset: 0, limit: 10 }],
      ["GET /api/v1/alerts", { items: [], total: 0, offset: 0, limit: 1 }],
    ]);
    render(<CleanArchive reloadKey={0} onCleaned={() => {}} onError={() => {}} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Clean archive" })).toBeDisabled();
  });
});

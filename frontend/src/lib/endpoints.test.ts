import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { at } from "../testUtils";
import {
  deleteBranch,
  deleteFridge,
  deleteImpact,
  deleteReading,
  listAlerts,
  listReadings,
  listThresholdProfiles,
  updateBranch,
  updateFridge,
  updateReading,
} from "./endpoints";

const fetchMock = vi.fn();

/** Return the URL of the n-th fetch call. */
function calledUrl(n = 0): string {
  return at(fetchMock.mock.calls, n)[0];
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(
    async () => new Response(JSON.stringify({ items: [], total: 0, offset: 0, limit: 50 }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listReadings", () => {
  it("sends only the filters that are set, with the temperature range in the selected unit", async () => {
    await listReadings({ branch: "Haifa", fridge: "", tempMin: "41", tempMax: "" }, "F", 0);

    expect(calledUrl()).toBe("/api/v1/readings?branch=Haifa&temp_min=41&unit=F&offset=0");
  });

  it("covers the whole From and To days", async () => {
    await listReadings({ dateFrom: "2026-09-14", dateTo: "2026-09-15" }, "C", 50);

    const params = new URL(calledUrl(), "http://x").searchParams;
    expect(params.get("date_from")).toBe("2026-09-14T00:00:00");
    expect(params.get("date_to")).toBe("2026-09-15T23:59:59");
    expect(params.get("offset")).toBe("50");
  });
});

describe("listAlerts", () => {
  it("asks for archived alerts with archived=true and the level", async () => {
    await listAlerts({ archived: true, level: "URGENT", offset: 0 });

    expect(calledUrl()).toBe("/api/v1/alerts?level=URGENT&archived=true&offset=0");
  });

  it("asks for active alerts without the archived flag", async () => {
    await listAlerts({ archived: false, offset: 0 });

    expect(calledUrl()).toBe("/api/v1/alerts?offset=0");
  });
});

describe("reading edits", () => {
  it("sends only the changed fields with PATCH", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    await updateReading(7, { temp: "ERR" });

    expect(calledUrl()).toBe("/api/v1/readings/7");
    expect(at(fetchMock.mock.calls, 0)[1].method).toBe("PATCH");
    expect(JSON.parse(at(fetchMock.mock.calls, 0)[1].body)).toEqual({ temp: "ERR" });
  });

  it("deletes with DELETE", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await deleteReading(7);

    expect(calledUrl()).toBe("/api/v1/readings/7");
    expect(at(fetchMock.mock.calls, 0)[1].method).toBe("DELETE");
  });
});

describe("branch and fridge deletes", () => {
  it("gets the delete impact of a branch or a fridge with GET", async () => {
    const counts = { fridges: 1, loggers: 1, readings: 5, alerts: 2 };
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(counts), { status: 200 }));

    expect(await deleteImpact("branches", 2)).toEqual(counts);
    await deleteImpact("fridges", 3);

    expect(calledUrl(0)).toBe("/api/v1/branches/2/delete-impact");
    expect(calledUrl(1)).toBe("/api/v1/fridges/3/delete-impact");
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("deletes a branch and a fridge with DELETE", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }));

    await deleteBranch(2);
    await deleteFridge(3);

    expect(calledUrl(0)).toBe("/api/v1/branches/2");
    expect(calledUrl(1)).toBe("/api/v1/fridges/3");
    expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual(["DELETE", "DELETE"]);
  });
});

describe("listThresholdProfiles", () => {
  it("gets the threshold profiles for the fridge profile names", async () => {
    const profiles = [{ id: 1, name: "default", fridges: 4 }];
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(profiles), { status: 200 }));

    expect(await listThresholdProfiles()).toEqual(profiles);
    expect(calledUrl()).toBe("/api/v1/threshold-settings");
  });
});

describe("branch and fridge edits", () => {
  it("sends only the changed branch fields with PATCH", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    await updateBranch(2, { street: "Herzl" });

    expect(calledUrl()).toBe("/api/v1/branches/2");
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ street: "Herzl" });
  });

  it("sends only the changed fridge fields with PATCH", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    await updateFridge(3, { metric: "F", logger_id: "TL-0231" });

    expect(calledUrl()).toBe("/api/v1/fridges/3");
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ metric: "F", logger_id: "TL-0231" });
  });
});

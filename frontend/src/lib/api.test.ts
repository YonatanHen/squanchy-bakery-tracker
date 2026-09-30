import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { at } from "../testUtils";
import { ApiError, apiRequest, getToken, onUnauthorized, setToken } from "./api";

/** Build a fetch Response with a JSON body. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiRequest", () => {
  it("calls /api/v1 with the stored bearer token and returns the JSON body", async () => {
    setToken("abc");
    fetchMock.mockResolvedValue(jsonResponse(200, [{ name: "Haifa" }]));

    const result = await apiRequest("/branches");

    expect(result).toEqual([{ name: "Haifa" }]);
    const [url, init] = at(fetchMock.mock.calls, 0);
    expect(url).toBe("/api/v1/branches");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer abc");
  });

  it("sends no Authorization header without a token", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await apiRequest("/auth/login", { method: "POST", body: { username: "admin", password: "password" } });

    const [, init] = at(fetchMock.mock.calls, 0);
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
  });

  it("sends a JSON body with its content type", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await apiRequest("/auth/login", { method: "POST", body: { username: "admin", password: "password" } });

    const [, init] = at(fetchMock.mock.calls, 0);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ username: "admin", password: "password" }));
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
  });

  it("sends a FormData body as multipart, without a JSON content type", async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, {}));
    const form = new FormData();
    form.append("file", new File(["x"], "week.xlsx"));

    await apiRequest("/readings/upload", { method: "POST", body: form });

    const [, init] = at(fetchMock.mock.calls, 0);
    expect(init.body).toBe(form);
    expect(new Headers(init.headers).has("Content-Type")).toBe(false);
  });

  it("keeps the whole error body, for responses that carry more than errors", async () => {
    const body = { rejected: 1, errors: [], unknown: { branches: [{ name: "Eilat" }], loggers: [] } };
    fetchMock.mockResolvedValue(jsonResponse(422, body));

    const error = (await apiRequest("/readings", { method: "POST", body: {} }).catch((e) => e)) as ApiError;

    expect(error.body).toEqual(body);
  });

  it("returns undefined for a 204 delete response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiRequest("/readings/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("on 401 clears the token, signals logout and throws the backend error", async () => {
    setToken("expired");
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "Token has expired" }));

    await expect(apiRequest("/readings")).rejects.toMatchObject({ status: 401, message: "Token has expired" });

    expect(getToken()).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("surfaces the backend field errors of a 422 response", async () => {
    const errors = [{ field: "temp", message: "Input should be a valid number", row: 3 }];
    fetchMock.mockResolvedValue(jsonResponse(422, { errors }));

    const error = (await apiRequest("/upload", { method: "POST", body: {} }).catch((e) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.fieldErrors).toEqual(errors);
  });
});

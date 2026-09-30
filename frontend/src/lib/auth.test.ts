import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { at } from "../testUtils";
import { getToken } from "./api";
import { isLoggedIn, login, logout } from "./auth";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("auth", () => {
  it("login posts the credentials and stores the access token", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ access_token: "jwt-1" }), { status: 200 }));

    await login("admin", "password");

    const [url, init] = at(fetchMock.mock.calls, 0);
    expect(url).toBe("/api/v1/auth/login");
    expect(JSON.parse(init.body)).toEqual({ username: "admin", password: "password" });
    expect(getToken()).toBe("jwt-1");
    expect(isLoggedIn()).toBe(true);
  });

  it("wrong credentials reject and store no token", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "Invalid username or password" }), { status: 401 }));

    await expect(login("admin", "wrong")).rejects.toMatchObject({ status: 401 });
    expect(isLoggedIn()).toBe(false);
  });

  it("logout removes the token", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ access_token: "jwt-1" }), { status: 200 }));
    await login("admin", "password");

    logout();

    expect(isLoggedIn()).toBe(false);
  });
});

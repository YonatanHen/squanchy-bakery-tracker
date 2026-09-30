import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { AppRoutes } from "./App";
import { setToken } from "./lib/api";
import { AuthProvider } from "./lib/AuthContext";

type Handler = (url: URL, init?: RequestInit) => unknown;

/** Stub fetch: the first route whose path prefix matches answers with its JSON body (or handler result). */
export function mockApi(routes: [string, unknown | Handler][]) {
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, "http://localhost");
    const method = init?.method ?? "GET";
    const route = routes.find(([prefix]) => `${method} ${url.pathname}`.startsWith(prefix));
    if (!route) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    const body = typeof route[1] === "function" ? (route[1] as Handler)(url, init) : route[1];
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Return the query params of every GET call to `path`. */
export function paramsOf(fetchMock: ReturnType<typeof mockApi>, path: string): URLSearchParams[] {
  return fetchMock.mock.calls
    .map(([input, init]) => ({ url: new URL(input, "http://localhost"), method: init?.method ?? "GET" }))
    .filter(({ url, method }) => method === "GET" && url.pathname === path)
    .map(({ url }) => url.searchParams);
}

/** Render the logged-in app at `path`. */
export function renderLoggedIn(path: string) {
  setToken("jwt-1");
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  );
}

/**
 * Unit tests for the apiFetch client.
 * We mock tokenStorage and global fetch to test the client in isolation.
 *
 * Important: because `BASE_URL` is evaluated at module-import time we must
 * set the env variable and use jest.isolateModules() to get a fresh module
 * instance for tests that care about the resolved URL.
 */

import { ApiError } from "../api/client";

// ──────────────────────────────────────────────────────────────────────────────
// Persistent mock for tokenStorage (used by all tests)
// ──────────────────────────────────────────────────────────────────────────────
jest.mock("../auth/tokenStorage", () => ({
  tokenStorage: {
    loadSession: jest.fn(),
    saveSession: jest.fn(),
    clearSession: jest.fn(),
  },
}));

import { tokenStorage } from "../auth/tokenStorage";
import { apiFetch } from "../api/client";

const mockLoadSession = tokenStorage.loadSession as jest.Mock;

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function setupSession(accessToken = "access-token", refreshToken = "refresh-token") {
  mockLoadSession.mockResolvedValue({
    accessToken,
    refreshToken,
    expiresAt: null,
    user: null,
  });
}

function makeFetchResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function mockFetchOnce(status: number, body: unknown) {
  (global.fetch as jest.Mock).mockResolvedValueOnce(makeFetchResponse(status, body));
}

// ──────────────────────────────────────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

// ──────────────────────────────────────────────────────────────────────────────
// ApiError
// ──────────────────────────────────────────────────────────────────────────────

describe("ApiError", () => {
  it("is an Error subclass with status, code and details", () => {
    const err = new ApiError(404, "Not Found", "NOT_FOUND", { resource: "ticket" });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.details).toEqual({ resource: "ticket" });
    expect(err.message).toBe("Not Found");
    expect(err.name).toBe("ApiError");
  });

  it("works without optional fields", () => {
    const err = new ApiError(500, "Server Error");
    expect(err.code).toBeUndefined();
    expect(err.details).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// apiFetch — behaviour tests (base URL comes from whatever the cached module has)
// ──────────────────────────────────────────────────────────────────────────────

describe("apiFetch()", () => {
  it("attaches Authorization header when a session token exists", async () => {
    setupSession("my-access-token");
    mockFetchOnce(200, { data: [] });

    await apiFetch("/api/items");

    const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
    const authHeader = (opts.headers as Headers).get("Authorization");
    expect(authHeader).toBe("Bearer my-access-token");
  });

  it("sets Accept: application/json on every request", async () => {
    setupSession();
    mockFetchOnce(200, { ok: true });

    await apiFetch("/api/items");

    const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect((opts.headers as Headers).get("Accept")).toBe("application/json");
  });

  it("serialises a plain-object body to JSON and sets Content-Type", async () => {
    setupSession();
    mockFetchOnce(200, { ok: true });

    // Pass a raw object — apiFetch should JSON.stringify it
    await apiFetch("/api/items", {
      method: "POST",
      body: { foo: "bar" } as unknown as BodyInit,
    });

    const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect((opts.headers as Headers).get("Content-Type")).toBe("application/json");
    expect(opts.body).toBe(JSON.stringify({ foo: "bar" }));
  });

  it("does NOT override Content-Type for FormData bodies", async () => {
    setupSession();
    mockFetchOnce(200, { ok: true });

    const fd = new FormData();
    await apiFetch("/api/upload", {
      method: "POST",
      body: fd as unknown as BodyInit,
    });

    const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
    // Content-Type must be absent so the runtime sets the multipart boundary
    expect((opts.headers as Headers).get("Content-Type")).toBeNull();
  });

  it("throws ApiError(0) on network failure", async () => {
    setupSession();
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network Error"));

    await expect(apiFetch("/api/items")).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("Erro de conexão"),
    });
  });

  it("throws ApiError with server status on non-2xx response", async () => {
    setupSession();
    mockFetchOnce(422, { error: "Validation failed", code: "VALIDATION_ERROR" });

    await expect(apiFetch("/api/items")).rejects.toMatchObject({
      status: 422,
      message: "Validation failed",
      code: "VALIDATION_ERROR",
    });
  });

  it("returns parsed JSON on a 2xx response", async () => {
    setupSession();
    mockFetchOnce(200, { data: { id: "abc" } });

    const result = await apiFetch<{ data: { id: string } }>("/api/items");
    expect(result).toEqual({ data: { id: "abc" } });
  });

  it("throws ApiError(401) and clears session when token refresh fails", async () => {
    setupSession("expired-token", "expired-refresh");

    // First call → 401
    mockFetchOnce(401, { error: "Unauthorized" });
    // Refresh endpoint → also fails
    mockFetchOnce(401, { error: "Refresh token expired" });

    await expect(apiFetch("/api/items")).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining("Sessão expirada"),
    });

    expect(tokenStorage.clearSession).toHaveBeenCalled();
  });

  it("does not attempt refresh for login route 401s", async () => {
    setupSession("bad-token");
    mockFetchOnce(401, { error: "Bad credentials" });

    await expect(apiFetch("/api/auth/login", { method: "POST" })).rejects.toMatchObject({
      status: 401,
    });

    // fetch was only called once — no refresh attempt
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });
});

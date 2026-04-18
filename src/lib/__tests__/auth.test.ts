// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import { createSession, getSession, deleteSession, verifySession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "development-secret-key"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSession", () => {
  test("calls the cookie store set exactly once", async () => {
    await createSession("user-123", "test@example.com");
    expect(mockCookieStore.set).toHaveBeenCalledOnce();
  });

  test("uses the cookie name 'auth-token'", async () => {
    await createSession("user-123", "test@example.com");
    const [name] = mockCookieStore.set.mock.calls[0];
    expect(name).toBe("auth-token");
  });

  test("produces a valid three-part JWT string", async () => {
    await createSession("user-123", "test@example.com");
    const [, token] = mockCookieStore.set.mock.calls[0];
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);
  });

  test("JWT payload contains the correct userId and email", async () => {
    await createSession("user-123", "test@example.com");
    const [, token] = mockCookieStore.set.mock.calls[0];
    const { payload } = await jwtVerify(token, JWT_SECRET);
    expect(payload.userId).toBe("user-123");
    expect(payload.email).toBe("test@example.com");
  });

  test("JWT expires in 7 days", async () => {
    const before = Math.floor(Date.now() / 1000);
    await createSession("user-123", "test@example.com");
    const after = Math.floor(Date.now() / 1000);

    const [, token] = mockCookieStore.set.mock.calls[0];
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const sevenDays = 7 * 24 * 60 * 60;
    expect(payload.exp).toBeGreaterThanOrEqual(before + sevenDays);
    expect(payload.exp).toBeLessThanOrEqual(after + sevenDays + 5);
  });

  test("cookie options include httpOnly, sameSite lax, and path /", async () => {
    await createSession("user-123", "test@example.com");
    const [, , options] = mockCookieStore.set.mock.calls[0];
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("cookie expiry is a Date ~7 days in the future", async () => {
    const before = Date.now();
    await createSession("user-123", "test@example.com");
    const after = Date.now();

    const [, , options] = mockCookieStore.set.mock.calls[0];
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(options.expires).toBeInstanceOf(Date);
    expect(options.expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs);
    expect(options.expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 5000);
  });

  test("secure is false outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    await createSession("user-123", "test@example.com");
    const [, , options] = mockCookieStore.set.mock.calls[0];
    expect(options.secure).toBe(false);
    vi.unstubAllEnvs();
  });

  test("secure is true in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await createSession("user-123", "test@example.com");
    const [, , options] = mockCookieStore.set.mock.calls[0];
    expect(options.secure).toBe(true);
    vi.unstubAllEnvs();
  });

  test("different userIds produce different tokens", async () => {
    await createSession("user-1", "a@example.com");
    const [, token1] = mockCookieStore.set.mock.calls[0];
    vi.clearAllMocks();
    await createSession("user-2", "a@example.com");
    const [, token2] = mockCookieStore.set.mock.calls[0];
    expect(token1).not.toBe(token2);
  });
});

describe("getSession", () => {
  test("returns null when no cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);
    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns null for an invalid token", async () => {
    mockCookieStore.get.mockReturnValue({ value: "not.a.valid.jwt" });
    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    await createSession("user-abc", "alice@example.com");
    const [, token] = mockCookieStore.set.mock.calls[0];
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user-abc");
    expect(session?.email).toBe("alice@example.com");
  });
});

describe("deleteSession", () => {
  test("deletes the auth-token cookie", async () => {
    await deleteSession();
    expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
  });
});

describe("verifySession", () => {
  test("returns null when no cookie is present in the request", async () => {
    const request = new NextRequest("http://localhost/");
    const session = await verifySession(request);
    expect(session).toBeNull();
  });

  test("returns null for an invalid token in the request", async () => {
    const request = new NextRequest("http://localhost/", {
      headers: { cookie: "auth-token=bad.token.value" },
    });
    const session = await verifySession(request);
    expect(session).toBeNull();
  });

  test("returns session payload for a valid token in the request", async () => {
    await createSession("user-xyz", "bob@example.com");
    const [, token] = mockCookieStore.set.mock.calls[0];

    const request = new NextRequest("http://localhost/", {
      headers: { cookie: `auth-token=${token}` },
    });
    const session = await verifySession(request);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user-xyz");
    expect(session?.email).toBe("bob@example.com");
  });
});

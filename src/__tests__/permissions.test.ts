import { can, isAdmin } from "../auth/permissions";
import { AuthUser } from "../types/api";

// Helper to build a mock user
function mockUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    role: "employee",
    permissions: [],
    company_id: "company-1",
    avatar_url: null,
    ...overrides,
  };
}

// ─── can() ─────────────────────────────────────────────────────────────────

describe("can()", () => {
  it("returns false for null user", () => {
    expect(can(null, "ticket:create")).toBe(false);
  });

  it("returns true for super_admin regardless of permission list", () => {
    const user = mockUser({ role: "super_admin", permissions: [] });
    expect(can(user, "ticket:delete")).toBe(true);
    expect(can(user, "equipment:manage")).toBe(true);
    expect(can(user, "user:invite")).toBe(true);
  });

  it("returns true when user has exact permission", () => {
    const user = mockUser({ role: "employee", permissions: ["ticket:create", "equipment:read"] });
    expect(can(user, "ticket:create")).toBe(true);
    expect(can(user, "equipment:read")).toBe(true);
  });

  it("returns false when user does not have the permission", () => {
    const user = mockUser({ role: "employee", permissions: ["ticket:create"] });
    expect(can(user, "ticket:delete")).toBe(false);
    expect(can(user, "user:invite")).toBe(false);
  });

  it("returns false for admin without explicit permission", () => {
    // admin still relies on permissions array (not blanket granted)
    const user = mockUser({ role: "admin", permissions: ["equipment:read"] });
    expect(can(user, "user:invite")).toBe(false);
  });
});

// ─── isAdmin() ──────────────────────────────────────────────────────────────

describe("isAdmin()", () => {
  it("returns false for null user", () => {
    expect(isAdmin(null)).toBe(false);
  });

  it("returns false for employee role", () => {
    const user = mockUser({ role: "employee" });
    expect(isAdmin(user)).toBe(false);
  });

  it("returns true for admin role", () => {
    const user = mockUser({ role: "admin" });
    expect(isAdmin(user)).toBe(true);
  });

  it("returns true for super_admin role", () => {
    const user = mockUser({ role: "super_admin" });
    expect(isAdmin(user)).toBe(true);
  });
});

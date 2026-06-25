import { AuthUser, Permission } from "../types/api";

/**
 * Checks if a user has a specific permission.
 * A super_admin possesses all permissions implicitly.
 */
export function can(user: AuthUser | null, permission: Permission): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  return user.permissions.includes(permission);
}

/**
 * Checks if a user has admin rights (admin or super_admin).
 */
export function isAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  return user.role === "super_admin" || user.role === "admin";
}

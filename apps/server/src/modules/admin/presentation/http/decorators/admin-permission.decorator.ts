import { SetMetadata } from "@nestjs/common";
import type { AdminPermissionRequest } from "@wandit/auth/admin-permissions";

export const ADMIN_PERMISSION_KEY = Symbol("ADMIN_PERMISSION_KEY");

/**
 * Declares the admin-dashboard permission required by a controller or handler.
 *
 * Handler metadata overrides controller metadata. An `@AdminOnly()` route with
 * no permission metadata is full-admin-only as a safe default; the admin-route
 * coverage test requires every handler to have explicit effective metadata.
 * `"any-staff"` is reserved for routes that only need the staff check already
 * performed by AdminGuard (for example, the effective-permissions endpoint).
 */
export const AdminPermission = (
	permission: AdminPermissionRequest | "any-staff",
) => SetMetadata(ADMIN_PERMISSION_KEY, permission);

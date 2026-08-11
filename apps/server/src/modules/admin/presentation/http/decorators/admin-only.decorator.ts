import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";

import {
	ADMIN_AUTH_SURFACE,
	AUTH_SURFACE_KEY,
} from "../../../../auth/auth.constants";
import { AdminGuard } from "../guards/admin.guard";

/**
 * Couples admin authorization to admin-session authentication.
 *
 * The global AuthGuard reads this metadata before AdminGuard runs, so these
 * routes never fall back to the web Better Auth instance.
 */
export const AdminOnly = () =>
	applyDecorators(
		SetMetadata(AUTH_SURFACE_KEY, ADMIN_AUTH_SURFACE),
		UseGuards(AdminGuard),
	);

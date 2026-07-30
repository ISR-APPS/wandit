import { Controller, Get } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import { isAdminRole } from "@wandit/contracts";

import { CurrentUser } from "../decorators/current-user.decorator";

@Controller("v1/auth")
export class AuthMeController {
	@Get("me")
	me(@CurrentUser() user: AuthUser) {
		return {
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			image: user.image ?? null,
			// Defensive: any unexpected role value maps to plain "user".
			role: isAdminRole(user.role) ? ("admin" as const) : ("user" as const),
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		};
	}
}

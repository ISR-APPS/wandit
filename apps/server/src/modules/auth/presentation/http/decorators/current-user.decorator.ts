/**
 * Gives a controller method the logged-in user.
 *
 * Express version: you might read `req.user`.
 * Nest version: the controller can write `@CurrentUser() user`.
 *
 * This works because `AuthGuard` runs first and puts `user` on the request.
 */
import {
	createParamDecorator,
	type ExecutionContext,
	InternalServerErrorException,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";

import type { MaybeAuthenticatedRequest } from "../types/authenticated-request";

// `createParamDecorator` tells Nest how to create the value for `@CurrentUser()`.
export const CurrentUser = createParamDecorator(
	(_data: unknown, context: ExecutionContext): AuthUser => {
		// Get the real HTTP request from Nest's generic context.
		const request = context
			.switchToHttp()
			.getRequest<MaybeAuthenticatedRequest>();

		if (!request.user) {
			// This means the route was wired incorrectly: `@CurrentUser()` was used
			// where the auth guard did not put a user on the request.
			throw new InternalServerErrorException(
				"CurrentUser used without an authenticated request",
			);
		}

		// Return the user object to the controller method.
		return request.user;
	},
);

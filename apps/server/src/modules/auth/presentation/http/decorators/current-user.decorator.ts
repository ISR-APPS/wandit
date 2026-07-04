import {
	createParamDecorator,
	type ExecutionContext,
	InternalServerErrorException,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";

import type { MaybeAuthenticatedRequest } from "../types/authenticated-request";

export const CurrentUser = createParamDecorator(
	(_data: unknown, context: ExecutionContext): AuthUser => {
		const request = context
			.switchToHttp()
			.getRequest<MaybeAuthenticatedRequest>();

		if (!request.user) {
			throw new InternalServerErrorException(
				"CurrentUser used without an authenticated request",
			);
		}

		return request.user;
	},
);

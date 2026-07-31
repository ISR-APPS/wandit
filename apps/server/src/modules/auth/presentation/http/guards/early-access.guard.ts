/**
 * Restricts product creation/generation/publishing/purchase routes to beta
 * users. The global AuthGuard runs first and populates `request.user` from a
 * fresh database read, so grants and revocations take effect immediately.
 */
import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import { isAdminRole } from "@wandit/contracts";

import type { MaybeAuthenticatedRequest } from "../types/authenticated-request";

export const EARLY_ACCESS_REQUIRED_ERROR_CODE = "EARLY_ACCESS_REQUIRED";

@Injectable()
export class EarlyAccessGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context
			.switchToHttp()
			.getRequest<MaybeAuthenticatedRequest>();

		if (request.user?.earlyAccess === true || isAdminRole(request.user?.role)) {
			return true;
		}

		throw new ForbiddenException({
			code: EARLY_ACCESS_REQUIRED_ERROR_CODE,
			message: "Early access is required",
		});
	}
}

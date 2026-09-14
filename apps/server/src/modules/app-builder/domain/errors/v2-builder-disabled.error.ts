/**
 * Denial error for V2 builder routes.
 * The `V2BuilderEnabledGuard` throws it; the API exception filter turns it
 * into a 403 envelope with the V2_BUILDER_DISABLED code.
 */
import { ForbiddenException } from "@nestjs/common";

/** Stable code the client reads when the guard denies. */
export const V2_BUILDER_DISABLED_ERROR_CODE = "V2_BUILDER_DISABLED";

/** Thrown when the V2 app builder is off for the account. */
export class V2BuilderDisabledError extends ForbiddenException {
	constructor() {
		super({
			code: V2_BUILDER_DISABLED_ERROR_CODE,
			message: "The V2 app builder is not enabled for this account",
		});
	}
}

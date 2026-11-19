/**
 * The 403 of the user referral summary route while the admin switch is off.
 * UserReferralsService throws it. The API exception filter turns it into the error reply.
 */
import { ForbiddenException } from "@nestjs/common";

/**
 * Uses the generic `FORBIDDEN` code. The web hides each referral entry while the
 * public setting `userReferralsEnabled` is false, so no screen needs its own message.
 */
export class UserReferralsDisabledError extends ForbiddenException {
	constructor() {
		super({
			code: "FORBIDDEN",
			message: "User referrals are disabled",
		});
	}
}

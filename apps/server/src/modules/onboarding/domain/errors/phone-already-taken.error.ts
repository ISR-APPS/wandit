/**
 * Error for a phone number that another account's onboarding row already holds.
 * Thrown by OnboardingService.complete. The API exception filter maps it to a
 * 409 reply with the code PHONE_ALREADY_TAKEN, which the web app shows at the
 * phone step.
 */
import { ConflictException } from "@nestjs/common";

/** 409 Conflict. The code is an entry of `apiErrorCodes` in packages/contracts. The web app translates it. */
export class PhoneAlreadyTakenError extends ConflictException {
	constructor() {
		super({
			code: "PHONE_ALREADY_TAKEN",
			message: "This phone number is already used by another account",
		});
	}
}

/**
 * HTTP routes of the user referral program, under `/api/v1/user-referrals`.
 * The web feature `user-referrals` calls them. Both routes need a signed-in user.
 * They call UserReferralsService.
 */
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Inject,
	Post,
} from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type ClaimUserReferralBody,
	type ClaimUserReferralResponse,
	claimUserReferralBodySchema,
	type UserReferralSummary,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { UserReferralsService } from "../../../application/services/user-referrals.service";

// The routes are user-scoped, with no workspace header: the rewards go to the personal pool.
@Controller("v1/user-referrals")
export class UserReferralsController {
	constructor(
		@Inject(UserReferralsService)
		private readonly userReferralsService: UserReferralsService,
	) {}

	/** The invite code, the totals, and the newest friends of the caller. A 403 while the program is off. */
	@Get("me")
	getSummary(@CurrentUser() user: AuthUser): Promise<UserReferralSummary> {
		return this.userReferralsService.getSummary(user.id);
	}

	/** The caller claims the invite code of a friend. A rejection is a 200 with a reason, not an error. */
	@Post("claim")
	// The contract promises a 200 for each outcome. The Nest default of a POST is 201.
	@HttpCode(HttpStatus.OK)
	claim(
		@Body(new ZodValidationPipe(claimUserReferralBodySchema))
		body: ClaimUserReferralBody,
		@CurrentUser() user: AuthUser,
	): Promise<ClaimUserReferralResponse> {
		return this.userReferralsService.claim(user.id, body.code, new Date());
	}
}

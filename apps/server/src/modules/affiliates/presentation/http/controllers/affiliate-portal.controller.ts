import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type AffiliatePortalCommissionsResponse,
	type AffiliatePortalMeResponse,
	type AffiliatePortalOverview,
	type AffiliatePortalPayoutsResponse,
	type AffiliatePortalReferralsResponse,
	type ListAffiliatePortalCommissionsQuery,
	type ListAffiliatePortalPayoutsQuery,
	type ListAffiliatePortalReferralsQuery,
	listAffiliatePortalCommissionsQuerySchema,
	listAffiliatePortalPayoutsQuerySchema,
	listAffiliatePortalReferralsQuerySchema,
} from "@wandit/contracts";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import { CurrentUser } from "../../../../auth";
import { AffiliatePortalService } from "../../../application/services/affiliate-portal.service";

@Controller("v1/affiliates/me")
export class AffiliatePortalController {
	constructor(
		@Inject(AffiliatePortalService)
		private readonly service: AffiliatePortalService,
	) {}

	@Get()
	me(@CurrentUser() user: AuthUser): Promise<AffiliatePortalMeResponse> {
		return this.service.me(user.id);
	}

	@Get("overview")
	overview(@CurrentUser() user: AuthUser): Promise<AffiliatePortalOverview> {
		return this.service.overview(user.id);
	}

	@Get("referrals")
	referrals(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(listAffiliatePortalReferralsQuerySchema))
		query: ListAffiliatePortalReferralsQuery,
	): Promise<AffiliatePortalReferralsResponse> {
		return this.service.listReferrals(user.id, query);
	}

	@Get("commissions")
	commissions(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(listAffiliatePortalCommissionsQuerySchema))
		query: ListAffiliatePortalCommissionsQuery,
	): Promise<AffiliatePortalCommissionsResponse> {
		return this.service.listCommissions(user.id, query);
	}

	@Get("payouts")
	payouts(
		@CurrentUser() user: AuthUser,
		@Query(new ZodValidationPipe(listAffiliatePortalPayoutsQuerySchema))
		query: ListAffiliatePortalPayoutsQuery,
	): Promise<AffiliatePortalPayoutsResponse> {
		return this.service.listPayouts(user.id, query);
	}
}

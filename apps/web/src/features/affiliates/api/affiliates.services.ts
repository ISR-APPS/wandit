import {
	affiliatePortalCommissionsResponseSchema,
	affiliatePortalMeResponseSchema,
	affiliatePortalOverviewSchema,
	affiliatePortalPayoutsResponseSchema,
	affiliatePortalReferralsResponseSchema,
	affiliatesRoutes,
} from "@wandit/contracts";

import { ApiService } from "@/lib/api-client";
import type {
	AffiliatePortalCommissionsResponse,
	AffiliatePortalMeResponse,
	AffiliatePortalOverview,
	AffiliatePortalPayoutsResponse,
	AffiliatePortalReferralsResponse,
	ListAffiliatePortalCommissionsQuery,
	ListAffiliatePortalPayoutsQuery,
	ListAffiliatePortalReferralsQuery,
} from "./affiliates.dto";

export async function getAffiliatePortalMe(): Promise<AffiliatePortalMeResponse> {
	const payload = await ApiService.get<unknown>(affiliatesRoutes.portalMe);

	return affiliatePortalMeResponseSchema.parse(payload);
}

export async function getAffiliatePortalOverview(): Promise<AffiliatePortalOverview> {
	const payload = await ApiService.get<unknown>(
		affiliatesRoutes.portalOverview,
	);

	return affiliatePortalOverviewSchema.parse(payload);
}

export async function listAffiliatePortalReferrals(
	query: ListAffiliatePortalReferralsQuery,
): Promise<AffiliatePortalReferralsResponse> {
	const payload = await ApiService.get<unknown>(
		affiliatesRoutes.portalReferrals,
		{ query },
	);

	return affiliatePortalReferralsResponseSchema.parse(payload);
}

export async function listAffiliatePortalCommissions(
	query: ListAffiliatePortalCommissionsQuery,
): Promise<AffiliatePortalCommissionsResponse> {
	const payload = await ApiService.get<unknown>(
		affiliatesRoutes.portalCommissions,
		{ query },
	);

	return affiliatePortalCommissionsResponseSchema.parse(payload);
}

export async function listAffiliatePortalPayouts(
	query: ListAffiliatePortalPayoutsQuery,
): Promise<AffiliatePortalPayoutsResponse> {
	const payload = await ApiService.get<unknown>(
		affiliatesRoutes.portalPayouts,
		{ query },
	);

	return affiliatePortalPayoutsResponseSchema.parse(payload);
}

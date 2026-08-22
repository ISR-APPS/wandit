import {
	type QueryClient,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";

import { useSession } from "@/features/auth";
import { isApiClientError } from "@/lib/api-client";

import type {
	ListAffiliatePortalCommissionsQuery,
	ListAffiliatePortalPayoutsQuery,
	ListAffiliatePortalReferralsQuery,
} from "./affiliates.dto";
import {
	getAffiliatePortalMe,
	getAffiliatePortalOverview,
	listAffiliatePortalCommissions,
	listAffiliatePortalPayouts,
	listAffiliatePortalReferrals,
} from "./affiliates.services";

// Portal data is scoped to the signed-in user, not the active workspace. The
// server resolves the user's linked affiliate and never accepts an affiliate id.
export const affiliatePortalKeys = {
	all: ["affiliate-portal"] as const,
	me: (userId: string | null) =>
		[...affiliatePortalKeys.all, userId, "me"] as const,
	overview: (userId: string | null) =>
		[...affiliatePortalKeys.all, userId, "overview"] as const,
	referrals: (
		userId: string | null,
		query: ListAffiliatePortalReferralsQuery,
	) => [...affiliatePortalKeys.all, userId, "referrals", query] as const,
	commissions: (
		userId: string | null,
		query: ListAffiliatePortalCommissionsQuery,
	) => [...affiliatePortalKeys.all, userId, "commissions", query] as const,
	payouts: (userId: string | null, query: ListAffiliatePortalPayoutsQuery) =>
		[...affiliatePortalKeys.all, userId, "payouts", query] as const,
};

type AffiliatePortalQueryOptions = {
	enabled?: boolean;
};

type AffiliatePortalMeQueryOptions = AffiliatePortalQueryOptions & {
	refetchOnMount?: "always" | boolean;
};

export function useAffiliatePortalMeQuery(
	options: AffiliatePortalMeQueryOptions = {},
) {
	const userId = useSession().data?.user.id ?? null;

	return useQuery({
		queryKey: affiliatePortalKeys.me(userId),
		queryFn: getAffiliatePortalMe,
		enabled: Boolean(userId) && (options.enabled ?? true),
		refetchOnMount: options.refetchOnMount,
		staleTime: 5 * 60_000,
	});
}

export function useAffiliatePortalOverviewQuery(
	options: AffiliatePortalQueryOptions = {},
) {
	const userId = useSession().data?.user.id ?? null;
	const queryClient = useQueryClient();

	return useQuery({
		queryKey: affiliatePortalKeys.overview(userId),
		queryFn: () =>
			withNotFoundHealing(getAffiliatePortalOverview, queryClient, userId),
		enabled: Boolean(userId) && (options.enabled ?? true),
	});
}

export function useAffiliatePortalReferralsQuery(
	query: ListAffiliatePortalReferralsQuery,
	options: AffiliatePortalQueryOptions = {},
) {
	const userId = useSession().data?.user.id ?? null;
	const queryClient = useQueryClient();

	return useQuery({
		queryKey: affiliatePortalKeys.referrals(userId, query),
		queryFn: () =>
			withNotFoundHealing(
				() => listAffiliatePortalReferrals(query),
				queryClient,
				userId,
			),
		enabled: Boolean(userId) && (options.enabled ?? true),
		placeholderData: (previousData, previousQuery) =>
			keepPreviousPortalData(previousData, previousQuery?.queryKey, userId),
	});
}

export function useAffiliatePortalCommissionsQuery(
	query: ListAffiliatePortalCommissionsQuery,
	options: AffiliatePortalQueryOptions = {},
) {
	const userId = useSession().data?.user.id ?? null;
	const queryClient = useQueryClient();

	return useQuery({
		queryKey: affiliatePortalKeys.commissions(userId, query),
		queryFn: () =>
			withNotFoundHealing(
				() => listAffiliatePortalCommissions(query),
				queryClient,
				userId,
			),
		enabled: Boolean(userId) && (options.enabled ?? true),
		placeholderData: (previousData, previousQuery) =>
			keepPreviousPortalData(previousData, previousQuery?.queryKey, userId),
	});
}

export function useAffiliatePortalPayoutsQuery(
	query: ListAffiliatePortalPayoutsQuery,
	options: AffiliatePortalQueryOptions = {},
) {
	const userId = useSession().data?.user.id ?? null;
	const queryClient = useQueryClient();

	return useQuery({
		queryKey: affiliatePortalKeys.payouts(userId, query),
		queryFn: () =>
			withNotFoundHealing(
				() => listAffiliatePortalPayouts(query),
				queryClient,
				userId,
			),
		enabled: Boolean(userId) && (options.enabled ?? true),
		placeholderData: (previousData, previousQuery) =>
			keepPreviousPortalData(previousData, previousQuery?.queryKey, userId),
	});
}

export function keepPreviousPortalData<T>(
	previousData: T | undefined,
	previousQueryKey: readonly unknown[] | undefined,
	userId: string | null,
): T | undefined {
	return userId !== null && previousQueryKey?.[1] === userId
		? previousData
		: undefined;
}

async function withNotFoundHealing<T>(
	request: () => Promise<T>,
	queryClient: QueryClient,
	userId: string | null,
): Promise<T> {
	try {
		return await request();
	} catch (error) {
		if (isApiClientError(error) && error.statusCode === 404) {
			void queryClient.invalidateQueries({
				queryKey: affiliatePortalKeys.me(userId),
			});
		}

		throw error;
	}
}

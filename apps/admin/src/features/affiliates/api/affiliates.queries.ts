import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
	type AffiliateAttributionsQueryInput,
	type AffiliateCommissionsQueryInput,
	type AffiliateLinksQueryInput,
	type AffiliatePayoutsQueryInput,
	type AffiliateProgramsQueryInput,
	type AffiliatesQueryInput,
	getAffiliate,
	getAffiliatePayout,
	getAffiliateProgram,
	listAffiliateAttributions,
	listAffiliateCommissions,
	listAffiliateLinks,
	listAffiliatePayouts,
	listAffiliatePrograms,
	listAffiliates,
} from "./affiliates.services";

export const affiliateKeys = {
	all: ["admin-affiliates"] as const,
	programs: (query?: AffiliateProgramsQueryInput) =>
		[...affiliateKeys.all, "programs", query ?? {}] as const,
	program: (programId: string) =>
		[...affiliateKeys.all, "program", programId] as const,
	affiliates: (query?: AffiliatesQueryInput) =>
		[...affiliateKeys.all, "affiliates", query ?? {}] as const,
	affiliate: (affiliateId: string) =>
		[...affiliateKeys.all, "affiliate", affiliateId] as const,
	links: (affiliateId: string, query?: AffiliateLinksQueryInput) =>
		[...affiliateKeys.all, "links", affiliateId, query ?? {}] as const,
	attributions: (
		affiliateId: string,
		query?: AffiliateAttributionsQueryInput,
	) =>
		[...affiliateKeys.all, "attributions", affiliateId, query ?? {}] as const,
	commissions: (query?: AffiliateCommissionsQueryInput) =>
		[...affiliateKeys.all, "commissions", query ?? {}] as const,
	payouts: (query?: AffiliatePayoutsQueryInput) =>
		[...affiliateKeys.all, "payouts", query ?? {}] as const,
	payout: (payoutId: string) =>
		[...affiliateKeys.all, "payout", payoutId] as const,
};

export function useAffiliateProgramsQuery(
	query: AffiliateProgramsQueryInput = {},
) {
	return useQuery({
		queryKey: affiliateKeys.programs(query),
		queryFn: () => listAffiliatePrograms(query),
		placeholderData: keepPreviousData,
	});
}

export function useAffiliateProgramQuery(
	programId: string | undefined,
	enabled = true,
) {
	return useQuery({
		queryKey: affiliateKeys.program(programId ?? "none"),
		queryFn: () => getAffiliateProgram(programId as string),
		enabled: enabled && Boolean(programId),
	});
}

export function useAffiliatesQuery(query: AffiliatesQueryInput = {}) {
	return useQuery({
		queryKey: affiliateKeys.affiliates(query),
		queryFn: () => listAffiliates(query),
		placeholderData: keepPreviousData,
	});
}

export function useAffiliateQuery(
	affiliateId: string | undefined,
	enabled = true,
) {
	return useQuery({
		queryKey: affiliateKeys.affiliate(affiliateId ?? "none"),
		queryFn: () => getAffiliate(affiliateId as string),
		enabled: enabled && Boolean(affiliateId),
	});
}

export function useAffiliateLinksQuery(
	affiliateId: string | undefined,
	query: AffiliateLinksQueryInput = {},
	enabled = true,
) {
	return useQuery({
		queryKey: affiliateKeys.links(affiliateId ?? "none", query),
		queryFn: () => listAffiliateLinks(affiliateId as string, query),
		enabled: enabled && Boolean(affiliateId),
		placeholderData: keepPreviousData,
	});
}

export function useAffiliateAttributionsQuery(
	affiliateId: string | undefined,
	query: AffiliateAttributionsQueryInput = {},
	enabled = true,
) {
	return useQuery({
		queryKey: affiliateKeys.attributions(affiliateId ?? "none", query),
		queryFn: () => listAffiliateAttributions(affiliateId as string, query),
		enabled: enabled && Boolean(affiliateId),
		placeholderData: keepPreviousData,
	});
}

export function useAffiliateCommissionsQuery(
	query: AffiliateCommissionsQueryInput = {},
) {
	return useQuery({
		queryKey: affiliateKeys.commissions(query),
		queryFn: () => listAffiliateCommissions(query),
		placeholderData: keepPreviousData,
	});
}

export function useAffiliatePayoutsQuery(
	query: AffiliatePayoutsQueryInput = {},
) {
	return useQuery({
		queryKey: affiliateKeys.payouts(query),
		queryFn: () => listAffiliatePayouts(query),
		placeholderData: keepPreviousData,
	});
}

export function useAffiliatePayoutQuery(
	payoutId: string | undefined,
	enabled = true,
) {
	return useQuery({
		queryKey: affiliateKeys.payout(payoutId ?? "none"),
		queryFn: () => getAffiliatePayout(payoutId as string),
		enabled: enabled && Boolean(payoutId),
	});
}

import {
	type AdminOrganizationLedgerEntry,
	type AdminOrganizationMember,
	type AdminOrganizationSubscription,
	type AdminOrganizationSummary,
	type AdminUserPlan,
	billingPlanIdSchema,
	billingPlanIds,
	centiCreditsToCredits,
} from "@wandit/contracts";
import type {
	AdminOrganizationMemberRow,
	AdminOrganizationSummaryRow,
	AdminOrgLedgerRow,
	AdminOrgSubscriptionRow,
} from "../persistence/admin-organizations.repository";
import { normalizeCostProvenance } from "./ai-cost-provenance.mapper";

export function mapAdminOrganizationSummary(
	row: AdminOrganizationSummaryRow,
): AdminOrganizationSummary {
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		logo: row.logo,
		createdAt: toIso(row.createdAt),
		membersCount: Number(row.membersCount),
		projectsCount: Number(row.projectsCount),
		plan: normalizePlan(row.plan),
		// Ledger sums are integer centi-credits; the API carries decimal credits.
		creditsBalance: centiCreditsToCredits(Number(row.creditsBalance)),
	};
}

// Limit and spend arrive as internal centi-credits; the API exposes the limit
// in whole credits (stored x100) and the spend in decimal credits.
export function mapAdminOrganizationMember(
	row: AdminOrganizationMemberRow,
	monthlyCreditLimitCentiCredits: number | null,
	spentThisMonthCentiCredits: number,
): AdminOrganizationMember {
	return {
		userId: row.userId,
		name: row.name,
		email: row.email,
		image: row.image,
		role: row.role,
		joinedAt: toIso(row.joinedAt),
		monthlyCreditLimit:
			monthlyCreditLimitCentiCredits === null
				? null
				: centiCreditsToCredits(monthlyCreditLimitCentiCredits),
		spentThisMonth: centiCreditsToCredits(spentThisMonthCentiCredits),
	};
}

export function mapAdminOrganizationSubscription(
	row: AdminOrgSubscriptionRow,
): AdminOrganizationSubscription {
	return {
		plan: billingPlanIdSchema.parse(row.plan),
		status: row.status,
		interval: row.interval,
		currentPeriodEnd: row.currentPeriodEnd ? toIso(row.currentPeriodEnd) : null,
		cancelAtPeriodEnd: row.cancelAtPeriodEnd,
		tierCredits: row.tierCredits,
		pendingTierCredits:
			row.pendingTierCredits === null ? null : Number(row.pendingTierCredits),
		purchasedByUserId: row.purchasedByUserId,
	};
}

export function mapAdminOrganizationLedgerEntry(
	row: AdminOrgLedgerRow,
): AdminOrganizationLedgerEntry {
	return {
		id: row.id,
		delta: centiCreditsToCredits(row.delta),
		kind: row.kind,
		bucket: row.bucket,
		meta: isRecord(row.meta) ? row.meta : null,
		createdAt: toIso(row.createdAt),
		actorUserId: row.actorUserId,
		actorName: row.actorName,
		aiModel: row.aiModel,
		aiProvider: row.aiProvider,
		aiCostUsdMicros:
			row.aiCostUsdMicros === null ? null : Number(row.aiCostUsdMicros),
		aiCostProvenance:
			row.aiCostUsdMicros === null
				? null
				: normalizeCostProvenance(row.aiCostProvenance),
	};
}

// "free" is derived: no entitled subscription row means the free plan.
function normalizePlan(plan: string | null): AdminUserPlan {
	if (plan !== null && (billingPlanIds as readonly string[]).includes(plan)) {
		return plan as AdminUserPlan;
	}

	return "free";
}

// Raw SQL expressions can surface as Date or string depending on pg parsers.
function toIso(value: Date | string): string {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

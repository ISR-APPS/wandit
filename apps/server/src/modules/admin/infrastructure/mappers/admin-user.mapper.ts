import {
	type AdminCreditLedgerEntry,
	type AdminUserDetail,
	type AdminUserPlan,
	type AdminUserProject,
	type AdminUserRole,
	type AdminUserSubscription,
	type AdminUserSummary,
	billingPlanIds,
	isAdminRole,
} from "@wandit/contracts";

import type {
	AdminCreditLedgerRow,
	AdminProjectRow,
	AdminSubscriptionRow,
	AdminUserDetailRow,
	AdminUserSummaryRow,
} from "../persistence/admin.repository";

export function mapAdminUserSummary(
	row: AdminUserSummaryRow,
): AdminUserSummary {
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		emailVerified: row.emailVerified,
		image: row.image,
		role: normalizeRole(row.role),
		earlyAccess: row.earlyAccess,
		banned: row.banned ?? false,
		createdAt: toIso(row.createdAt),
		lastSeenAt: row.lastSeenAt === null ? null : toIso(row.lastSeenAt),
		plan: normalizePlan(row.plan),
		creditsBalance: Number(row.creditsBalance),
		projectsCount: Number(row.projectsCount),
	};
}

export function mapAdminUserDetail(
	row: AdminUserDetailRow,
	subscription: AdminSubscriptionRow | null,
	projects: AdminProjectRow[],
	creditLedger: AdminCreditLedgerRow[],
): AdminUserDetail {
	return {
		...mapAdminUserSummary(row),
		updatedAt: toIso(row.updatedAt),
		banReason: row.banReason,
		subscription: subscription ? mapAdminUserSubscription(subscription) : null,
		projects: projects.map(mapAdminUserProject),
		creditLedger: creditLedger.map(mapAdminCreditLedgerEntry),
	};
}

function mapAdminUserSubscription(
	row: AdminSubscriptionRow,
): AdminUserSubscription {
	return {
		plan: row.plan,
		status: row.status,
		interval: row.interval,
		currentPeriodEnd: row.currentPeriodEnd ? toIso(row.currentPeriodEnd) : null,
		cancelAtPeriodEnd: row.cancelAtPeriodEnd,
	};
}

function mapAdminUserProject(row: AdminProjectRow): AdminUserProject {
	return {
		id: row.id,
		name: row.name,
		createdAt: toIso(row.createdAt),
	};
}

function mapAdminCreditLedgerEntry(
	row: AdminCreditLedgerRow,
): AdminCreditLedgerEntry {
	return {
		id: row.id,
		delta: row.delta,
		kind: row.kind,
		bucket: row.bucket,
		meta: isRecord(row.meta) ? row.meta : null,
		createdAt: toIso(row.createdAt),
	};
}

// Defensive: any role value outside the contract enum maps to plain "user".
function normalizeRole(role: string | null | undefined): AdminUserRole {
	return isAdminRole(role) ? "admin" : "user";
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

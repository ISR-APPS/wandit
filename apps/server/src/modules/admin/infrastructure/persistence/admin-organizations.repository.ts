import { Inject, Injectable } from "@nestjs/common";
import {
	type AdminListOrganizationsQuery,
	ENTITLED_SUBSCRIPTION_STATUSES,
	type PaginatedResult,
} from "@wandit/contracts";
import {
	and,
	asc,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	notInArray,
	or,
	sql,
} from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import {
	organizationBillingCustomers,
	subscriptions,
} from "@wandit/db/schema/billing";
import { aiUsageEvents, creditLedger } from "@wandit/db/schema/credits";
import {
	invitation,
	member,
	organization,
	organizationBillingSettings,
	organizationMemberCreditLimits,
} from "@wandit/db/schema/organizations";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	AI_SPEND_STATUSES,
	aiUsageEventCostProvenance,
	aiUsageEventCostUsdMicros,
} from "./ai-usage-cost.sql";

export type AdminOrganizationSummaryRow = {
	id: string;
	name: string;
	slug: string;
	logo: string | null;
	createdAt: Date;
	membersCount: number;
	projectsCount: number;
	plan: string | null;
	creditsBalance: number;
};

export type AdminOrganizationMemberRow = {
	userId: string;
	name: string;
	email: string;
	image: string | null;
	role: string;
	joinedAt: Date;
};

export type AdminUserMembershipRow = {
	organizationId: string;
	name: string;
	slug: string;
	role: string;
	joinedAt: Date;
};

export type AdminOrgSubscriptionRow = {
	id: string;
	provider: string;
	plan: (typeof subscriptions.plan)["_"]["data"];
	status: string;
	interval: (typeof subscriptions.interval)["_"]["data"];
	currentPeriodEnd: Date;
	cancelAtPeriodEnd: boolean;
	tierCredits: number;
	pendingTierCredits: number | null;
	purchasedByUserId: string | null;
};

export type AdminOrgLedgerRow = {
	id: string;
	delta: number;
	kind: (typeof creditLedger.kind)["_"]["data"];
	bucket: (typeof creditLedger.bucket)["_"]["data"];
	meta: unknown;
	createdAt: Date;
	actorUserId: string | null;
	actorName: string | null;
	aiModel: string | null;
	aiProvider: string | null;
	aiCostUsdMicros: number | null;
	aiCostProvenance: string | null;
};

export type AdminOrgAiSpendRow = {
	totalCostUsdMicros: number;
	meteredOperations: number;
};

const entitledStatuses = [...ENTITLED_SUBSCRIPTION_STATUSES];

// Same terminal set as the subscriptions partial unique indexes
// (packages/db/src/schema/billing.ts) and AdminRepository — there is no shared
// constant to import.
const TERMINAL_SUBSCRIPTION_STATUSES = ["canceled", "incomplete_expired"];

type AdminOrganizationsDbClient = Pick<Database, "select">;

@Injectable()
export class AdminOrganizationsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async listOrganizations(
		query: AdminListOrganizationsQuery,
	): Promise<PaginatedResult<AdminOrganizationSummaryRow>> {
		const where = this.buildSearchFilter(query.q);
		const offset = (query.page - 1) * query.pageSize;

		const [totalRow] = await this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(organization)
			.where(where);

		const items: AdminOrganizationSummaryRow[] = await this.db
			.select(this.summaryColumns())
			.from(organization)
			.where(where)
			.orderBy(...this.buildOrderBy(query.sort))
			.limit(query.pageSize)
			.offset(offset);

		return {
			items,
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	async findOrganizationSummary(
		organizationId: string,
	): Promise<AdminOrganizationSummaryRow | null> {
		const [row] = await this.db
			.select(this.summaryColumns())
			.from(organization)
			.where(eq(organization.id, organizationId))
			.limit(1);

		return row ?? null;
	}

	listMembersWithUsers(
		organizationId: string,
	): Promise<AdminOrganizationMemberRow[]> {
		return this.db
			.select({
				userId: member.userId,
				name: user.name,
				email: user.email,
				image: user.image,
				role: member.role,
				joinedAt: member.createdAt,
			})
			.from(member)
			.innerJoin(user, eq(user.id, member.userId))
			.where(eq(member.organizationId, organizationId))
			.orderBy(asc(member.createdAt), asc(member.id));
	}

	/** All team workspaces a user belongs to — the user-detail sidebar list. */
	listUserMemberships(
		userId: string,
		client: AdminOrganizationsDbClient = this.db,
	): Promise<AdminUserMembershipRow[]> {
		return client
			.select({
				organizationId: member.organizationId,
				name: organization.name,
				slug: organization.slug,
				role: member.role,
				joinedAt: member.createdAt,
			})
			.from(member)
			.innerJoin(organization, eq(organization.id, member.organizationId))
			.where(eq(member.userId, userId))
			.orderBy(asc(member.createdAt), asc(member.id));
	}

	async findMember(
		organizationId: string,
		userId: string,
	): Promise<{ id: string; role: string } | null> {
		const [row] = await this.db
			.select({ id: member.id, role: member.role })
			.from(member)
			.where(
				and(
					eq(member.organizationId, organizationId),
					eq(member.userId, userId),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async updateMemberRole(
		organizationId: string,
		userId: string,
		role: string,
	): Promise<void> {
		await this.db
			.update(member)
			.set({ role })
			.where(
				and(
					eq(member.organizationId, organizationId),
					eq(member.userId, userId),
				),
			);
	}

	/** Mirrors AdminRepository.findLatestSubscription, org-scoped. */
	async findLatestSubscription(
		organizationId: string,
	): Promise<AdminOrgSubscriptionRow | null> {
		const [row] = await this.db
			.select({
				id: subscriptions.id,
				provider: subscriptions.provider,
				plan: subscriptions.plan,
				status: subscriptions.status,
				interval: subscriptions.interval,
				currentPeriodEnd: subscriptions.currentPeriodEnd,
				cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
				tierCredits: subscriptions.tierCredits,
				pendingTierCredits: subscriptions.pendingTierCredits,
				purchasedByUserId: subscriptions.userId,
			})
			.from(subscriptions)
			.where(
				and(
					eq(subscriptions.organizationId, organizationId),
					notInArray(subscriptions.status, TERMINAL_SUBSCRIPTION_STATUSES),
				),
			)
			.orderBy(desc(subscriptions.createdAt))
			.limit(1);

		return row ?? null;
	}

	listRecentLedger(
		organizationId: string,
		limit: number,
	): Promise<AdminOrgLedgerRow[]> {
		return (
			this.db
				.select({
					id: creditLedger.id,
					delta: creditLedger.delta,
					kind: creditLedger.kind,
					bucket: creditLedger.bucket,
					meta: creditLedger.meta,
					createdAt: creditLedger.createdAt,
					actorUserId: creditLedger.userId,
					actorName: user.name,
					aiModel: aiUsageEvents.model,
					aiProvider: aiUsageEvents.provider,
					// Cost only on consume rows: metering refund grants link to the
					// same operation but are credit compensation, not new spend.
					aiCostUsdMicros: sql<
						number | null
					>`case when ${creditLedger.kind} = 'consume' then ${aiUsageEventCostUsdMicros} end`.mapWith(
						aiUsageEvents.reconciledCostUsdMicros,
					),
					aiCostProvenance: sql<
						string | null
					>`case when ${creditLedger.kind} = 'consume' and ${aiUsageEventCostUsdMicros} is not null then ${aiUsageEventCostProvenance} end`,
				})
				.from(creditLedger)
				.leftJoin(user, eq(user.id, creditLedger.userId))
				// Metering rows (reserve/settle consumes and refund grants) carry the
				// operation id in meta.usageEventId; every other kind joins to
				// nothing. Text comparison: a malformed historical id must not fail
				// the whole query with a cast error.
				.leftJoin(
					aiUsageEvents,
					sql`${creditLedger.meta} ->> 'usageEventId' = ${aiUsageEvents.id}::text`,
				)
				.where(eq(creditLedger.organizationId, organizationId))
				.orderBy(desc(creditLedger.createdAt), desc(creditLedger.id))
				.limit(limit)
		);
	}

	// Actual AI-provider spend charged to this org's pool, across all acting
	// members. Completed operations only; ops without any recorded provider
	// cost count 0. Bigint: lifetime micros can pass 2^31.
	async sumAiSpend(organizationId: string): Promise<AdminOrgAiSpendRow> {
		const [row] = await this.db
			.select({
				totalCostUsdMicros:
					sql<number>`coalesce(sum(coalesce(${aiUsageEventCostUsdMicros}, 0)), 0)::bigint`.mapWith(
						aiUsageEvents.reconciledCostUsdMicros,
					),
				meteredOperations: sql<number>`count(*)::int`,
			})
			.from(aiUsageEvents)
			.where(
				and(
					eq(aiUsageEvents.organizationId, organizationId),
					inArray(aiUsageEvents.status, [...AI_SPEND_STATUSES]),
				),
			);

		return row ?? { meteredOperations: 0, totalCostUsdMicros: 0 };
	}

	async countPendingInvitations(organizationId: string): Promise<number> {
		const [row] = await this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(invitation)
			.where(
				and(
					eq(invitation.organizationId, organizationId),
					eq(invitation.status, "pending"),
				),
			);

		return row?.total ?? 0;
	}

	async findDefaultMemberLimit(organizationId: string): Promise<number | null> {
		const [row] = await this.db
			.select({
				defaultMemberMonthlyCreditLimit:
					organizationBillingSettings.defaultMemberMonthlyCreditLimit,
			})
			.from(organizationBillingSettings)
			.where(eq(organizationBillingSettings.organizationId, organizationId))
			.limit(1);

		return row?.defaultMemberMonthlyCreditLimit ?? null;
	}

	async listMemberLimits(organizationId: string): Promise<Map<string, number>> {
		const rows = await this.db
			.select({
				userId: organizationMemberCreditLimits.userId,
				monthlyCreditLimit: organizationMemberCreditLimits.monthlyCreditLimit,
			})
			.from(organizationMemberCreditLimits)
			.where(eq(organizationMemberCreditLimits.organizationId, organizationId));

		return new Map(rows.map((row) => [row.userId, row.monthlyCreditLimit]));
	}

	/**
	 * Per-member spend this UTC calendar month, one grouped query. Same
	 * COALESCE(final, reserved) semantics as OrganizationLimitsRepository
	 * .sumMemberSpendThisMonth — refunded work counts 0, open holds count full.
	 */
	async sumMemberSpendThisMonth(
		organizationId: string,
		now: Date,
	): Promise<Map<string, number>> {
		const monthStart = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
		);
		const rows = await this.db
			.select({
				userId: aiUsageEvents.userId,
				spent: sql<number>`coalesce(sum(coalesce(${aiUsageEvents.finalCredits}, ${aiUsageEvents.reservedCredits})), 0)::int`,
			})
			.from(aiUsageEvents)
			.where(
				and(
					eq(aiUsageEvents.organizationId, organizationId),
					gte(aiUsageEvents.createdAt, monthStart),
				),
			)
			.groupBy(aiUsageEvents.userId);

		return new Map(rows.map((row) => [row.userId, Number(row.spent)]));
	}

	async findAttributionUserId(organizationId: string): Promise<string | null> {
		const [row] = await this.db
			.select({
				attributionUserId: organizationBillingCustomers.attributionUserId,
			})
			.from(organizationBillingCustomers)
			.where(eq(organizationBillingCustomers.organizationId, organizationId))
			.limit(1);

		return row?.attributionUserId ?? null;
	}

	/**
	 * Per-org aggregates as correlated scalar subqueries — one row per org, so
	 * LIMIT/OFFSET pagination and the total count stay correct.
	 *
	 * Identifiers inside the subqueries are fully qualified: in a join-less
	 * select, drizzle strips table prefixes from embedded column refs, which
	 * would break the correlation with the outer "organization" row.
	 */
	private summaryColumns() {
		return {
			id: organization.id,
			name: organization.name,
			slug: organization.slug,
			logo: organization.logo,
			createdAt: organization.createdAt,
			membersCount: sql<number>`(
				select count(*)
				from "member"
				where "member"."organization_id" = "organization"."id"
			)::int`,
			projectsCount: sql<number>`(
				select count(*)
				from "projects"
				where "projects"."organization_id" = "organization"."id"
					and "projects"."deleted_at" is null
			)::int`,
			plan: sql<string | null>`(
				select "subscriptions"."plan"
				from "subscriptions"
				where "subscriptions"."organization_id" = "organization"."id"
					and "subscriptions"."status" in (${sql.join(
						entitledStatuses.map((status) => sql`${status}`),
						sql`, `,
					)})
				order by "subscriptions"."created_at" desc
				limit 1
			)`,
			creditsBalance: sql<number>`coalesce((
				select sum("credit_ledger"."delta")
				from "credit_ledger"
				where "credit_ledger"."organization_id" = "organization"."id"
			), 0)::int`,
		};
	}

	private buildSearchFilter(q: string | undefined) {
		if (!q) {
			return undefined;
		}

		const pattern = `%${escapeLikePattern(q)}%`;

		return or(
			ilike(organization.name, pattern),
			ilike(organization.slug, pattern),
		);
	}

	private buildOrderBy(sort: AdminListOrganizationsQuery["sort"]) {
		switch (sort) {
			case "oldest":
				return [asc(organization.createdAt), asc(organization.id)];
			case "name":
				return [asc(organization.name), asc(organization.id)];
			default:
				return [desc(organization.createdAt), desc(organization.id)];
		}
	}
}

// Escape LIKE wildcards so a search for "100%" matches literally.
function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

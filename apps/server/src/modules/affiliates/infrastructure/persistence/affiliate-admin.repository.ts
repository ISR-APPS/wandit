import { Inject, Injectable } from "@nestjs/common";
import {
	type AffiliateCsvExportQuery,
	type AffiliateCurrencyAggregate,
	billingIntervals,
	billingPlanIds,
	CREDIT_TIERS,
	type CreateAffiliateInput,
	type CreateAffiliateLinkInput,
	type CreateAffiliateProgramInput,
	type ListAffiliateAttributionsQuery,
	type ListAffiliateCommissionsQuery,
	type ListAffiliateLinksQuery,
	type ListAffiliatePayoutsQuery,
	type ListAffiliateProgramsQuery,
	type ListAffiliatesQuery,
	priceLookupKey,
	priceUsdFor,
	type UpdateAffiliateInput,
	type UpdateAffiliateLinkInput,
	type UpdateAffiliateProgramInput,
} from "@wandit/contracts";
import {
	and,
	asc,
	desc,
	eq,
	ilike,
	inArray,
	or,
	type SQL,
	sql,
} from "@wandit/db";
import {
	affiliateAttributions,
	affiliateCommissions,
	affiliateLinks,
	affiliatePayouts,
	affiliatePrograms,
	affiliates,
} from "@wandit/db/schema/affiliates";
import { user } from "@wandit/db/schema/auth";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
export type AffiliateAdminProgramRow = typeof affiliatePrograms.$inferSelect;
export type AffiliateAdminAffiliateRow = typeof affiliates.$inferSelect;
export type AffiliateAdminLinkRow = typeof affiliateLinks.$inferSelect;
export type AffiliateAdminAttributionRow =
	typeof affiliateAttributions.$inferSelect;
export type AffiliateAdminCommissionRow =
	typeof affiliateCommissions.$inferSelect;
export type AffiliateAdminPayoutRow = typeof affiliatePayouts.$inferSelect;

export type AffiliateAdminPage<T> = {
	items: T[];
	page: number;
	pageSize: number;
	total: number;
};

export type AffiliateAdminProgramAggregate = {
	affiliateCount: number;
	linkCount: number;
	activeLinkCount: number;
	attributedUserCount: number;
	paidCustomerCount: number;
	paidInvoiceCount: number;
	currencies: AffiliateCurrencyAggregate[];
};

export type AffiliateAdminAggregate = {
	linkCount: number;
	activeLinkCount: number;
	clickCount: number;
	uniqueVisitorCount: number;
	attributedUserCount: number;
	paidCustomerCount: number;
	healthyTrials: number;
	churnedCustomers: number;
	referredMrrCents: number;
	referredLtvCents: number | null;
	paidInvoiceCount: number;
	lastConversionAt: Date | null;
	currencies: AffiliateCurrencyAggregate[];
};

export type AffiliateAdminCoreAggregate = Pick<
	AffiliateAdminAggregate,
	| "activeLinkCount"
	| "attributedUserCount"
	| "clickCount"
	| "currencies"
	| "lastConversionAt"
	| "linkCount"
	| "paidCustomerCount"
	| "paidInvoiceCount"
	| "uniqueVisitorCount"
>;

export type AffiliateAdminLinkAggregate = {
	clickCount: number;
	uniqueVisitorCount: number;
	attributedUserCount: number;
	paidCustomerCount: number;
	paidInvoiceCount: number;
	lastConversionAt: Date | null;
	currencies: AffiliateCurrencyAggregate[];
};

export type AffiliateAdminProgramRecord = {
	program: AffiliateAdminProgramRow;
	aggregates: AffiliateAdminProgramAggregate;
};

export type AffiliateAdminAffiliateRecord = {
	affiliate: AffiliateAdminAffiliateRow;
	aggregates: AffiliateAdminAggregate;
};

export type AffiliateAdminLinkRecord = {
	link: AffiliateAdminLinkRow;
	program: Pick<AffiliateAdminProgramRow, "id" | "kind" | "name" | "status">;
	aggregates: AffiliateAdminLinkAggregate;
};

export type AffiliateAdminAttributionRecord = {
	attribution: AffiliateAdminAttributionRow;
	user: { id: string; name: string; email: string };
	link: { id: string; code: string; label: string | null };
	program: Pick<AffiliateAdminProgramRow, "id" | "kind" | "name" | "status">;
	paidInvoiceCount: number;
	firstPaidAt: Date | null;
	lastPaidAt: Date | null;
	currencies: AffiliateCurrencyAggregate[];
};

export type AffiliateAdminCommissionRecord = {
	commission: AffiliateAdminCommissionRow;
	affiliate: { id: string; name: string; email: string };
	attributedUser: { id: string; name: string; email: string };
	link: { id: string; code: string; label: string | null };
};

export type AffiliateAdminPayoutRecord = {
	payout: AffiliateAdminPayoutRow;
	affiliate: { id: string; name: string; email: string };
	entryCount: number;
};

export type AffiliateAdminSummary = {
	affiliateCount: number;
	activeAffiliateCount: number;
	linkCount: number;
	activeLinkCount: number;
	clickCount: number;
	uniqueVisitorCount: number;
	attributedUserCount: number;
	paidCustomerCount: number;
	paidInvoiceCount: number;
	currencies: AffiliateCurrencyAggregate[];
};

type AffiliateQualityAggregate = Pick<
	AffiliateAdminAggregate,
	"churnedCustomers" | "healthyTrials" | "referredLtvCents" | "referredMrrCents"
>;
type AffiliateAggregateColumns = Omit<
	AffiliateAdminAggregate,
	| "churnedCustomers"
	| "currencies"
	| "healthyTrials"
	| "referredLtvCents"
	| "referredMrrCents"
>;
type LinkAggregateColumns = Omit<AffiliateAdminLinkAggregate, "currencies">;
type AffiliateAdminWriteClient = Pick<Database, "update">;

type AffiliateQualityRow = {
	affiliate_id: string;
	baseline_live_paid_owners: number | string;
	churned_customers: number | string;
	healthy_trials: number | string;
	live_paid_owners: number | string;
	referred_mrr_cents: number | string;
	trailing_churned_owners: number | string;
};

// 20 WHOLE credits, expressed in centi-credits because the CTE sums the
// centi-credit ledger. Keep in sync with admin-analytics.metrics.ts.
const HEALTHY_TRIAL_MIN_CENTI_CREDITS = 20 * 100;
const HEALTHY_TRIAL_MIN_COMPLETED_GENERATIONS = 2;
const LIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"] as const;

const EMPTY_AFFILIATE_QUALITY: AffiliateQualityAggregate = {
	churnedCustomers: 0,
	healthyTrials: 0,
	referredLtvCents: null,
	referredMrrCents: 0,
};

// Mirrors the catalog-to-monthly-MRR derivation in admin-analytics.metrics.ts:
// lookup-key catalog prices are cents, with annual prices divided by 12.
const AFFILIATE_MRR_CATALOG = billingPlanIds.flatMap((plan) =>
	CREDIT_TIERS.flatMap((tierCredits) =>
		billingIntervals.map((interval) => ({
			lookupKey: priceLookupKey(plan, tierCredits, interval),
			monthlyMrrCents:
				(priceUsdFor(plan, tierCredits, interval) * 100) /
				(interval === "year" ? 12 : 1),
		})),
	),
);

@Injectable()
export class AffiliateAdminRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async listPrograms(
		query: ListAffiliateProgramsQuery,
	): Promise<AffiliateAdminPage<AffiliateAdminProgramRecord>> {
		const where = this.programFilter(query);
		const offset = (query.page - 1) * query.pageSize;
		const [totalRow, rows] = await Promise.all([
			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(affiliatePrograms)
				.where(where)
				.then((result) => result[0]),
			this.db
				.select({
					program: affiliatePrograms,
					affiliateCount: sql<number>`(
						select count(distinct "affiliate_links"."affiliate_id")::int
						from "affiliate_links"
						where "affiliate_links"."program_id" = "affiliate_programs"."id"
					)`,
					linkCount: sql<number>`(
						select count(*)::int from "affiliate_links"
						where "affiliate_links"."program_id" = "affiliate_programs"."id"
					)`,
					activeLinkCount: sql<number>`(
						select count(*)::int from "affiliate_links"
						where "affiliate_links"."program_id" = "affiliate_programs"."id"
							and "affiliate_links"."active" = true
							and ("affiliate_links"."expires_at" is null or "affiliate_links"."expires_at" > now())
					)`,
					attributedUserCount: sql<number>`(
						select count(*)::int from "affiliate_attributions"
						where "affiliate_attributions"."program_id" = "affiliate_programs"."id"
					)`,
					paidCustomerCount: sql<number>`(
						select count(distinct "affiliate_attributions"."user_id")::int
						from "affiliate_attributions"
						inner join "affiliate_commissions"
							on "affiliate_commissions"."attribution_id" = "affiliate_attributions"."id"
							and "affiliate_commissions"."entry_type" = 'earning'
						where "affiliate_attributions"."program_id" = "affiliate_programs"."id"
					)`,
					paidInvoiceCount: sql<number>`(
						select count(*)::int from "affiliate_commissions"
						inner join "affiliate_attributions"
							on "affiliate_attributions"."id" = "affiliate_commissions"."attribution_id"
						where "affiliate_attributions"."program_id" = "affiliate_programs"."id"
							and "affiliate_commissions"."entry_type" = 'earning'
					)`,
				})
				.from(affiliatePrograms)
				.where(where)
				.orderBy(desc(affiliatePrograms.createdAt), desc(affiliatePrograms.id))
				.limit(query.pageSize)
				.offset(offset),
		]);

		const currencies = await this.currenciesByProgramIds(
			rows.map((row) => row.program.id),
		);

		return {
			items: rows.map((row) => ({
				program: row.program,
				aggregates: {
					affiliateCount: row.affiliateCount,
					linkCount: row.linkCount,
					activeLinkCount: row.activeLinkCount,
					attributedUserCount: row.attributedUserCount,
					paidCustomerCount: row.paidCustomerCount,
					paidInvoiceCount: row.paidInvoiceCount,
					currencies: currencies.get(row.program.id) ?? [],
				},
			})),
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	async getProgram(id: string): Promise<AffiliateAdminProgramRecord | null> {
		const program = await this.findProgram(id);

		if (!program) {
			return null;
		}

		const currencies = await this.currenciesByProgramIds([id]);
		const [counts] = await this.db
			.select({
				affiliateCount: sql<number>`count(distinct ${affiliateLinks.affiliateId})::int`,
				linkCount: sql<number>`count(distinct ${affiliateLinks.id})::int`,
				activeLinkCount: sql<number>`count(distinct ${affiliateLinks.id}) filter (
					where ${affiliateLinks.active} = true
						and (${affiliateLinks.expiresAt} is null or ${affiliateLinks.expiresAt} > now())
				)::int`,
				attributedUserCount: sql<number>`count(distinct ${affiliateAttributions.id})::int`,
				paidCustomerCount: sql<number>`count(distinct ${affiliateAttributions.userId}) filter (
					where ${affiliateCommissions.entryType} = 'earning'
				)::int`,
				paidInvoiceCount: sql<number>`count(distinct ${affiliateCommissions.id}) filter (
					where ${affiliateCommissions.entryType} = 'earning'
				)::int`,
			})
			.from(affiliatePrograms)
			.leftJoin(
				affiliateLinks,
				eq(affiliateLinks.programId, affiliatePrograms.id),
			)
			.leftJoin(
				affiliateAttributions,
				eq(affiliateAttributions.programId, affiliatePrograms.id),
			)
			.leftJoin(
				affiliateCommissions,
				eq(affiliateCommissions.attributionId, affiliateAttributions.id),
			)
			.where(eq(affiliatePrograms.id, id));

		return {
			program,
			aggregates: {
				affiliateCount: counts?.affiliateCount ?? 0,
				linkCount: counts?.linkCount ?? 0,
				activeLinkCount: counts?.activeLinkCount ?? 0,
				attributedUserCount: counts?.attributedUserCount ?? 0,
				paidCustomerCount: counts?.paidCustomerCount ?? 0,
				paidInvoiceCount: counts?.paidInvoiceCount ?? 0,
				currencies: currencies.get(id) ?? [],
			},
		};
	}

	async findProgram(id: string): Promise<AffiliateAdminProgramRow | null> {
		const [row] = await this.db
			.select()
			.from(affiliatePrograms)
			.where(eq(affiliatePrograms.id, id))
			.limit(1);

		return row ?? null;
	}

	async findUserIdentity(
		userId: string,
	): Promise<{ id: string; name: string; email: string } | null> {
		const [row] = await this.db
			.select({ id: user.id, name: user.name, email: user.email })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		return row ?? null;
	}

	async createProgram(
		input: CreateAffiliateProgramInput,
	): Promise<AffiliateAdminProgramRow> {
		const [row] = await this.db
			.insert(affiliatePrograms)
			.values(this.programInsertValues(input))
			.returning();

		if (!row) {
			throw new Error("Affiliate program insert did not return a row");
		}

		return row;
	}

	async updateProgram(
		id: string,
		input: UpdateAffiliateProgramInput,
	): Promise<AffiliateAdminProgramRow | null> {
		const values: Partial<typeof affiliatePrograms.$inferInsert> = {
			...input,
			updatedAt: new Date(),
		};

		if ("kind" in input) {
			if (input.kind === "percentage_recurring") {
				values.commissionRateBps = input.commissionRateBps;
				values.fixedAmountCents = null;
				values.fixedCurrency = null;
			} else {
				values.commissionRateBps = null;
				values.fixedAmountCents = input.fixedAmountCents;
				values.fixedCurrency = input.fixedCurrency;
			}
		}

		const [row] = await this.db
			.update(affiliatePrograms)
			.set(values)
			.where(eq(affiliatePrograms.id, id))
			.returning();

		return row ?? null;
	}

	async archiveProgram(id: string): Promise<boolean> {
		const rows = await this.db
			.update(affiliatePrograms)
			.set({ status: "archived", updatedAt: new Date() })
			.where(eq(affiliatePrograms.id, id))
			.returning({ id: affiliatePrograms.id });

		return rows.length > 0;
	}

	async listAffiliates(query: ListAffiliatesQuery): Promise<{
		page: AffiliateAdminPage<AffiliateAdminAffiliateRecord>;
		summary: AffiliateAdminSummary;
	}> {
		const where = this.affiliateFilter(query);
		const offset = (query.page - 1) * query.pageSize;
		const [totalRow, rows, allAffiliates] = await Promise.all([
			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(affiliates)
				.where(where)
				.then((result) => result[0]),
			this.db
				.select({
					affiliate: affiliates,
					...this.affiliateAggregateColumns(),
				})
				.from(affiliates)
				.where(where)
				.orderBy(...this.affiliateOrder(query.sort))
				.limit(query.pageSize)
				.offset(offset),
			this.db
				.select({ id: affiliates.id, status: affiliates.status })
				.from(affiliates)
				.where(where),
		]);

		const affiliateIds = rows.map((row) => row.affiliate.id);
		const [currencies, quality, summary] = await Promise.all([
			this.currenciesByAffiliateIds(affiliateIds),
			this.qualityByAffiliateIds(affiliateIds),
			this.buildSummary(allAffiliates),
		]);

		return {
			page: {
				items: rows.map((row) => ({
					affiliate: row.affiliate,
					aggregates: {
						...this.pickAffiliateAggregate(row, quality.get(row.affiliate.id)),
						currencies: currencies.get(row.affiliate.id) ?? [],
					},
				})),
				page: query.page,
				pageSize: query.pageSize,
				total: totalRow?.total ?? 0,
			},
			summary,
		};
	}

	async getAffiliate(
		id: string,
	): Promise<AffiliateAdminAffiliateRecord | null> {
		const [row] = await this.db
			.select({ affiliate: affiliates, ...this.affiliateAggregateColumns() })
			.from(affiliates)
			.where(eq(affiliates.id, id))
			.limit(1);

		if (!row) {
			return null;
		}

		const [currencies, quality] = await Promise.all([
			this.currenciesByAffiliateIds([id]),
			this.qualityByAffiliateIds([id]),
		]);

		return {
			affiliate: row.affiliate,
			aggregates: {
				...this.pickAffiliateAggregate(row, quality.get(id)),
				currencies: currencies.get(id) ?? [],
			},
		};
	}

	async getAffiliateCoreAggregates(
		id: string,
	): Promise<AffiliateAdminCoreAggregate | null> {
		const [row] = await this.db
			.select(this.affiliateAggregateColumns())
			.from(affiliates)
			.where(eq(affiliates.id, id))
			.limit(1);

		if (!row) {
			return null;
		}

		const currencies = await this.currenciesByAffiliateIds([id]);

		return {
			...row,
			currencies: currencies.get(id) ?? [],
		};
	}

	async createAffiliate(
		input: CreateAffiliateInput,
	): Promise<AffiliateAdminAffiliateRow> {
		const [row] = await this.db.insert(affiliates).values(input).returning();

		if (!row) {
			throw new Error("Affiliate insert did not return a row");
		}

		return row;
	}

	async updateAffiliate(
		id: string,
		input: UpdateAffiliateInput,
		client: AffiliateAdminWriteClient = this.db,
	): Promise<AffiliateAdminAffiliateRow | null> {
		const [row] = await client
			.update(affiliates)
			.set({ ...input, updatedAt: new Date() })
			.where(eq(affiliates.id, id))
			.returning();

		return row ?? null;
	}

	async listLinks(
		affiliateId: string,
		query: ListAffiliateLinksQuery,
	): Promise<AffiliateAdminPage<AffiliateAdminLinkRecord>> {
		const where = this.linkFilter(affiliateId, query);
		const offset = (query.page - 1) * query.pageSize;
		const [totalRow, rows] = await Promise.all([
			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(affiliateLinks)
				.innerJoin(
					affiliatePrograms,
					eq(affiliatePrograms.id, affiliateLinks.programId),
				)
				.where(where)
				.then((result) => result[0]),
			this.db
				.select({
					link: affiliateLinks,
					program: {
						id: affiliatePrograms.id,
						kind: affiliatePrograms.kind,
						name: affiliatePrograms.name,
						status: affiliatePrograms.status,
					},
					...this.linkAggregateColumns(),
				})
				.from(affiliateLinks)
				.innerJoin(
					affiliatePrograms,
					eq(affiliatePrograms.id, affiliateLinks.programId),
				)
				.where(where)
				.orderBy(desc(affiliateLinks.createdAt), desc(affiliateLinks.id))
				.limit(query.pageSize)
				.offset(offset),
		]);

		const currencies = await this.currenciesByLinkIds(
			rows.map((row) => row.link.id),
		);

		return {
			items: rows.map((row) => ({
				link: row.link,
				program: row.program,
				aggregates: {
					...this.pickLinkAggregate(row),
					currencies: currencies.get(row.link.id) ?? [],
				},
			})),
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	async listAllLinks(affiliateId: string): Promise<AffiliateAdminLinkRecord[]> {
		const rows = await this.db
			.select({
				link: affiliateLinks,
				program: {
					id: affiliatePrograms.id,
					kind: affiliatePrograms.kind,
					name: affiliatePrograms.name,
					status: affiliatePrograms.status,
				},
				...this.linkAggregateColumns(),
			})
			.from(affiliateLinks)
			.innerJoin(
				affiliatePrograms,
				eq(affiliatePrograms.id, affiliateLinks.programId),
			)
			.where(eq(affiliateLinks.affiliateId, affiliateId))
			.orderBy(desc(affiliateLinks.createdAt), desc(affiliateLinks.id));
		const currencies = await this.currenciesByLinkIds(
			rows.map((row) => row.link.id),
		);

		return rows.map((row) => ({
			link: row.link,
			program: row.program,
			aggregates: {
				...this.pickLinkAggregate(row),
				currencies: currencies.get(row.link.id) ?? [],
			},
		}));
	}

	async getLink(
		affiliateId: string,
		linkId: string,
	): Promise<AffiliateAdminLinkRecord | null> {
		const [row] = await this.db
			.select({
				link: affiliateLinks,
				program: {
					id: affiliatePrograms.id,
					kind: affiliatePrograms.kind,
					name: affiliatePrograms.name,
					status: affiliatePrograms.status,
				},
				...this.linkAggregateColumns(),
			})
			.from(affiliateLinks)
			.innerJoin(
				affiliatePrograms,
				eq(affiliatePrograms.id, affiliateLinks.programId),
			)
			.where(
				and(
					eq(affiliateLinks.id, linkId),
					eq(affiliateLinks.affiliateId, affiliateId),
				),
			)
			.limit(1);

		if (!row) {
			return null;
		}

		const currencies = await this.currenciesByLinkIds([linkId]);

		return {
			link: row.link,
			program: row.program,
			aggregates: {
				...this.pickLinkAggregate(row),
				currencies: currencies.get(linkId) ?? [],
			},
		};
	}

	async createLink(
		affiliateId: string,
		input: CreateAffiliateLinkInput,
	): Promise<AffiliateAdminLinkRow> {
		const [row] = await this.db
			.insert(affiliateLinks)
			.values({
				...input,
				affiliateId,
				label: input.label ?? null,
				expiresAt:
					input.expiresAt === undefined
						? undefined
						: input.expiresAt === null
							? null
							: new Date(input.expiresAt),
			})
			.returning();

		if (!row) {
			throw new Error("Affiliate link insert did not return a row");
		}

		return row;
	}

	async updateLink(
		affiliateId: string,
		linkId: string,
		input: UpdateAffiliateLinkInput,
	): Promise<AffiliateAdminLinkRow | null> {
		const expiresAt =
			input.expiresAt === undefined
				? undefined
				: input.expiresAt === null
					? null
					: new Date(input.expiresAt);
		const [row] = await this.db
			.update(affiliateLinks)
			.set({ ...input, expiresAt, updatedAt: new Date() })
			.where(
				and(
					eq(affiliateLinks.id, linkId),
					eq(affiliateLinks.affiliateId, affiliateId),
				),
			)
			.returning();

		return row ?? null;
	}

	async deactivateLink(affiliateId: string, linkId: string): Promise<boolean> {
		const rows = await this.db
			.update(affiliateLinks)
			.set({ active: false, updatedAt: new Date() })
			.where(
				and(
					eq(affiliateLinks.id, linkId),
					eq(affiliateLinks.affiliateId, affiliateId),
				),
			)
			.returning({ id: affiliateLinks.id });

		return rows.length > 0;
	}

	async listAttributions(
		affiliateId: string,
		query: ListAffiliateAttributionsQuery,
	): Promise<AffiliateAdminPage<AffiliateAdminAttributionRecord>> {
		const where = this.attributionFilter(affiliateId, query);
		const offset = (query.page - 1) * query.pageSize;
		const aggregateColumns = {
			paidInvoiceCount: sql<number>`count(distinct ${affiliateCommissions.id}) filter (
				where ${affiliateCommissions.entryType} = 'earning'
			)::int`,
			firstPaidAt:
				sql<Date | null>`min(${affiliateCommissions.createdAt}) filter (
				where ${affiliateCommissions.entryType} = 'earning'
			)`.mapWith(affiliateCommissions.createdAt),
			lastPaidAt:
				sql<Date | null>`max(${affiliateCommissions.createdAt}) filter (
				where ${affiliateCommissions.entryType} = 'earning'
			)`.mapWith(affiliateCommissions.createdAt),
		};
		const [totalRow, rows] = await Promise.all([
			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(affiliateAttributions)
				.innerJoin(user, eq(user.id, affiliateAttributions.userId))
				.innerJoin(
					affiliateLinks,
					eq(affiliateLinks.id, affiliateAttributions.linkId),
				)
				.where(where)
				.then((result) => result[0]),
			this.db
				.select({
					attribution: affiliateAttributions,
					user: { id: user.id, name: user.name, email: user.email },
					link: {
						id: affiliateLinks.id,
						code: affiliateLinks.code,
						label: affiliateLinks.label,
					},
					program: {
						id: affiliatePrograms.id,
						kind: affiliatePrograms.kind,
						name: affiliatePrograms.name,
						status: affiliatePrograms.status,
					},
					...aggregateColumns,
				})
				.from(affiliateAttributions)
				.innerJoin(user, eq(user.id, affiliateAttributions.userId))
				.innerJoin(
					affiliateLinks,
					eq(affiliateLinks.id, affiliateAttributions.linkId),
				)
				.innerJoin(
					affiliatePrograms,
					eq(affiliatePrograms.id, affiliateAttributions.programId),
				)
				.leftJoin(
					affiliateCommissions,
					eq(affiliateCommissions.attributionId, affiliateAttributions.id),
				)
				.where(where)
				.groupBy(
					affiliateAttributions.id,
					user.id,
					affiliateLinks.id,
					affiliatePrograms.id,
				)
				.orderBy(
					desc(affiliateAttributions.lockedAt),
					desc(affiliateAttributions.id),
				)
				.limit(query.pageSize)
				.offset(offset),
		]);

		const currencies = await this.currenciesByAttributionIds(
			rows.map((row) => row.attribution.id),
		);

		return {
			items: rows.map((row) => ({
				...row,
				currencies: currencies.get(row.attribution.id) ?? [],
			})),
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	async listCommissions(
		query: ListAffiliateCommissionsQuery,
	): Promise<AffiliateAdminPage<AffiliateAdminCommissionRecord>> {
		const where = this.commissionFilter(query);
		const offset = (query.page - 1) * query.pageSize;
		const base = () =>
			this.db
				.select({
					commission: affiliateCommissions,
					affiliate: {
						id: affiliates.id,
						name: affiliates.name,
						email: affiliates.email,
					},
					attributedUser: { id: user.id, name: user.name, email: user.email },
					link: {
						id: affiliateLinks.id,
						code: affiliateLinks.code,
						label: affiliateLinks.label,
					},
				})
				.from(affiliateCommissions)
				.innerJoin(
					affiliates,
					eq(affiliates.id, affiliateCommissions.affiliateId),
				)
				.innerJoin(
					affiliateAttributions,
					eq(affiliateAttributions.id, affiliateCommissions.attributionId),
				)
				.innerJoin(user, eq(user.id, affiliateAttributions.userId))
				.innerJoin(
					affiliateLinks,
					eq(affiliateLinks.id, affiliateAttributions.linkId),
				)
				.where(where);

		const [totalRow, rows] = await Promise.all([
			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(affiliateCommissions)
				.innerJoin(
					affiliates,
					eq(affiliates.id, affiliateCommissions.affiliateId),
				)
				.innerJoin(
					affiliateAttributions,
					eq(affiliateAttributions.id, affiliateCommissions.attributionId),
				)
				.innerJoin(user, eq(user.id, affiliateAttributions.userId))
				.innerJoin(
					affiliateLinks,
					eq(affiliateLinks.id, affiliateAttributions.linkId),
				)
				.where(where)
				.then((result) => result[0]),
			base()
				.orderBy(
					query.sort === "oldest"
						? asc(affiliateCommissions.createdAt)
						: desc(affiliateCommissions.createdAt),
					desc(affiliateCommissions.id),
				)
				.limit(query.pageSize)
				.offset(offset),
		]);

		return {
			items: rows,
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	async listPayouts(
		query: ListAffiliatePayoutsQuery,
	): Promise<AffiliateAdminPage<AffiliateAdminPayoutRecord>> {
		const where = this.payoutFilter(query);
		const offset = (query.page - 1) * query.pageSize;
		const columns = {
			payout: affiliatePayouts,
			affiliate: {
				id: affiliates.id,
				name: affiliates.name,
				email: affiliates.email,
			},
			entryCount: sql<number>`count(${affiliateCommissions.id})::int`,
		};
		const [totalRow, rows] = await Promise.all([
			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(affiliatePayouts)
				.innerJoin(affiliates, eq(affiliates.id, affiliatePayouts.affiliateId))
				.where(where)
				.then((result) => result[0]),
			this.db
				.select(columns)
				.from(affiliatePayouts)
				.innerJoin(affiliates, eq(affiliates.id, affiliatePayouts.affiliateId))
				.leftJoin(
					affiliateCommissions,
					eq(affiliateCommissions.payoutId, affiliatePayouts.id),
				)
				.where(where)
				.groupBy(affiliatePayouts.id, affiliates.id)
				.orderBy(desc(affiliatePayouts.createdAt), desc(affiliatePayouts.id))
				.limit(query.pageSize)
				.offset(offset),
		]);

		return {
			items: rows,
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	async getPayout(id: string): Promise<{
		payout: AffiliateAdminPayoutRow;
		affiliate: AffiliateAdminPayoutRecord["affiliate"];
		entries: AffiliateAdminCommissionRecord[];
	} | null> {
		const [row] = await this.db
			.select({
				payout: affiliatePayouts,
				affiliate: {
					id: affiliates.id,
					name: affiliates.name,
					email: affiliates.email,
				},
			})
			.from(affiliatePayouts)
			.innerJoin(affiliates, eq(affiliates.id, affiliatePayouts.affiliateId))
			.where(eq(affiliatePayouts.id, id))
			.limit(1);

		if (!row) {
			return null;
		}

		const entries = await this.db
			.select({
				commission: affiliateCommissions,
				affiliate: {
					id: affiliates.id,
					name: affiliates.name,
					email: affiliates.email,
				},
				attributedUser: { id: user.id, name: user.name, email: user.email },
				link: {
					id: affiliateLinks.id,
					code: affiliateLinks.code,
					label: affiliateLinks.label,
				},
			})
			.from(affiliateCommissions)
			.innerJoin(
				affiliates,
				eq(affiliates.id, affiliateCommissions.affiliateId),
			)
			.innerJoin(
				affiliateAttributions,
				eq(affiliateAttributions.id, affiliateCommissions.attributionId),
			)
			.innerJoin(user, eq(user.id, affiliateAttributions.userId))
			.innerJoin(
				affiliateLinks,
				eq(affiliateLinks.id, affiliateAttributions.linkId),
			)
			.where(eq(affiliateCommissions.payoutId, row.payout.id))
			.orderBy(
				desc(affiliateCommissions.createdAt),
				desc(affiliateCommissions.id),
			);

		return {
			...row,
			entries,
		};
	}

	async listAffiliateCsvRows(
		query: AffiliateCsvExportQuery,
	): Promise<AffiliateAdminAffiliateRecord[]> {
		const where = this.affiliateFilter(query);
		const rows = await this.db
			.select({ affiliate: affiliates, ...this.affiliateAggregateColumns() })
			.from(affiliates)
			.where(where)
			.orderBy(asc(affiliates.name), asc(affiliates.id));
		const affiliateIds = rows.map((row) => row.affiliate.id);
		const [currencies, quality] = await Promise.all([
			this.currenciesByAffiliateIds(affiliateIds),
			this.qualityByAffiliateIds(affiliateIds),
		]);

		return rows.map((row) => ({
			affiliate: row.affiliate,
			aggregates: {
				...this.pickAffiliateAggregate(row, quality.get(row.affiliate.id)),
				currencies: currencies.get(row.affiliate.id) ?? [],
			},
		}));
	}

	private programFilter(query: ListAffiliateProgramsQuery) {
		const pattern = query.q ? `%${escapeLikePattern(query.q)}%` : undefined;

		return and(
			pattern ? ilike(affiliatePrograms.name, pattern) : undefined,
			query.kind ? eq(affiliatePrograms.kind, query.kind) : undefined,
			query.status ? eq(affiliatePrograms.status, query.status) : undefined,
		);
	}

	private affiliateFilter(
		query: Pick<ListAffiliatesQuery, "programId" | "q" | "status">,
	) {
		const pattern = query.q ? `%${escapeLikePattern(query.q)}%` : undefined;

		return and(
			pattern
				? or(ilike(affiliates.name, pattern), ilike(affiliates.email, pattern))
				: undefined,
			query.status ? eq(affiliates.status, query.status) : undefined,
			query.programId
				? sql`exists (
					select 1 from ${affiliateLinks}
					where ${affiliateLinks.affiliateId} = ${affiliates.id}
						and ${affiliateLinks.programId} = ${query.programId}
				)`
				: undefined,
		);
	}

	private linkFilter(affiliateId: string, query: ListAffiliateLinksQuery) {
		const pattern = query.q ? `%${escapeLikePattern(query.q)}%` : undefined;
		const status =
			query.status === "active"
				? and(
						eq(affiliateLinks.active, true),
						sql`(${affiliateLinks.expiresAt} is null or ${affiliateLinks.expiresAt} > now())`,
					)
				: query.status === "expired"
					? sql`${affiliateLinks.expiresAt} is not null and ${affiliateLinks.expiresAt} <= now()`
					: query.status === "paused"
						? and(
								eq(affiliateLinks.active, false),
								sql`(${affiliateLinks.expiresAt} is null or ${affiliateLinks.expiresAt} > now())`,
							)
						: undefined;

		return and(
			eq(affiliateLinks.affiliateId, affiliateId),
			pattern
				? or(
						ilike(affiliateLinks.code, pattern),
						ilike(affiliateLinks.label, pattern),
					)
				: undefined,
			query.programId
				? eq(affiliateLinks.programId, query.programId)
				: undefined,
			status,
		);
	}

	private attributionFilter(
		affiliateId: string,
		query: ListAffiliateAttributionsQuery,
	) {
		const pattern = query.q ? `%${escapeLikePattern(query.q)}%` : undefined;
		const unresolved = sql`exists (
			select 1 from jsonb_array_elements(coalesce(${affiliateAttributions.fraudFlags}, '[]'::jsonb)) as flag
			where nullif(flag->>'resolvedAt', '') is null
		)`;

		return and(
			eq(affiliateAttributions.affiliateId, affiliateId),
			query.status ? eq(affiliateAttributions.status, query.status) : undefined,
			query.fraud === "flagged"
				? unresolved
				: query.fraud === "clear"
					? sql`not (${unresolved})`
					: undefined,
			pattern
				? or(
						ilike(user.name, pattern),
						ilike(user.email, pattern),
						ilike(affiliateLinks.code, pattern),
					)
				: undefined,
		);
	}

	private commissionFilter(query: ListAffiliateCommissionsQuery) {
		const pattern = query.q ? `%${escapeLikePattern(query.q)}%` : undefined;

		return and(
			query.affiliateId
				? eq(affiliateCommissions.affiliateId, query.affiliateId)
				: undefined,
			query.entryType
				? eq(affiliateCommissions.entryType, query.entryType)
				: undefined,
			query.status ? eq(affiliateCommissions.status, query.status) : undefined,
			query.currency
				? eq(affiliateCommissions.currency, query.currency)
				: undefined,
			query.from
				? sql`${affiliateCommissions.createdAt} >= ${new Date(query.from)}`
				: undefined,
			query.to
				? sql`${affiliateCommissions.createdAt} <= ${new Date(query.to)}`
				: undefined,
			pattern
				? or(
						ilike(affiliates.name, pattern),
						ilike(affiliates.email, pattern),
						ilike(user.name, pattern),
						ilike(user.email, pattern),
						ilike(affiliateLinks.code, pattern),
						ilike(affiliateCommissions.stripeInvoiceId, pattern),
						ilike(affiliateCommissions.stripeChargeId, pattern),
					)
				: undefined,
		);
	}

	private payoutFilter(query: ListAffiliatePayoutsQuery) {
		const pattern = query.q ? `%${escapeLikePattern(query.q)}%` : undefined;

		return and(
			query.affiliateId
				? eq(affiliatePayouts.affiliateId, query.affiliateId)
				: undefined,
			query.status ? eq(affiliatePayouts.status, query.status) : undefined,
			query.currency
				? eq(affiliatePayouts.currency, query.currency)
				: undefined,
			pattern
				? or(
						ilike(affiliates.name, pattern),
						ilike(affiliates.email, pattern),
						ilike(affiliatePayouts.externalRef, pattern),
					)
				: undefined,
		);
	}

	private affiliateOrder(sort: ListAffiliatesQuery["sort"]) {
		switch (sort) {
			case "oldest":
				return [asc(affiliates.createdAt), asc(affiliates.id)];
			case "name":
				return [asc(affiliates.name), asc(affiliates.id)];
			case "email":
				return [asc(affiliates.email), asc(affiliates.id)];
			default:
				return [desc(affiliates.createdAt), desc(affiliates.id)];
		}
	}

	private affiliateAggregateColumns() {
		return {
			linkCount: sql<number>`(
				select count(*)::int from "affiliate_links"
				where "affiliate_links"."affiliate_id" = "affiliates"."id"
			)`,
			activeLinkCount: sql<number>`(
				select count(*)::int from "affiliate_links"
				where "affiliate_links"."affiliate_id" = "affiliates"."id"
					and "affiliate_links"."active" = true
					and ("affiliate_links"."expires_at" is null or "affiliate_links"."expires_at" > now())
			)`,
			clickCount: sql<number>`(
				select count(*)::int from "affiliate_clicks"
				inner join "affiliate_links" on "affiliate_links"."id" = "affiliate_clicks"."link_id"
				where "affiliate_links"."affiliate_id" = "affiliates"."id"
			)`,
			uniqueVisitorCount: sql<number>`(
				select count(distinct "affiliate_clicks"."ip_hash")::int from "affiliate_clicks"
				inner join "affiliate_links" on "affiliate_links"."id" = "affiliate_clicks"."link_id"
				where "affiliate_links"."affiliate_id" = "affiliates"."id"
			)`,
			attributedUserCount: sql<number>`(
				select count(*)::int from "affiliate_attributions"
				where "affiliate_attributions"."affiliate_id" = "affiliates"."id"
			)`,
			paidCustomerCount: sql<number>`(
				select count(distinct "affiliate_attributions"."user_id")::int
				from "affiliate_attributions"
				inner join "affiliate_commissions"
					on "affiliate_commissions"."attribution_id" = "affiliate_attributions"."id"
					and "affiliate_commissions"."entry_type" = 'earning'
				where "affiliate_attributions"."affiliate_id" = "affiliates"."id"
			)`,
			paidInvoiceCount: sql<number>`(
				select count(*)::int from "affiliate_commissions"
				where "affiliate_commissions"."affiliate_id" = "affiliates"."id"
					and "affiliate_commissions"."entry_type" = 'earning'
			)`,
			lastConversionAt: sql<Date | null>`(
				select max("affiliate_commissions"."created_at") from "affiliate_commissions"
				where "affiliate_commissions"."affiliate_id" = "affiliates"."id"
					and "affiliate_commissions"."entry_type" = 'earning'
			)`.mapWith(affiliateCommissions.createdAt),
		};
	}

	private linkAggregateColumns() {
		return {
			clickCount: sql<number>`(
				select count(*)::int from "affiliate_clicks"
				where "affiliate_clicks"."link_id" = "affiliate_links"."id"
			)`,
			uniqueVisitorCount: sql<number>`(
				select count(distinct "affiliate_clicks"."ip_hash")::int
				from "affiliate_clicks"
				where "affiliate_clicks"."link_id" = "affiliate_links"."id"
			)`,
			attributedUserCount: sql<number>`(
				select count(*)::int from "affiliate_attributions"
				where "affiliate_attributions"."link_id" = "affiliate_links"."id"
			)`,
			paidCustomerCount: sql<number>`(
				select count(distinct "affiliate_attributions"."user_id")::int
				from "affiliate_attributions"
				inner join "affiliate_commissions"
					on "affiliate_commissions"."attribution_id" = "affiliate_attributions"."id"
					and "affiliate_commissions"."entry_type" = 'earning'
				where "affiliate_attributions"."link_id" = "affiliate_links"."id"
			)`,
			paidInvoiceCount: sql<number>`(
				select count(*)::int from "affiliate_commissions"
				inner join "affiliate_attributions"
					on "affiliate_attributions"."id" = "affiliate_commissions"."attribution_id"
				where "affiliate_attributions"."link_id" = "affiliate_links"."id"
					and "affiliate_commissions"."entry_type" = 'earning'
			)`,
			lastConversionAt: sql<Date | null>`(
				select max("affiliate_commissions"."created_at")
				from "affiliate_commissions"
				inner join "affiliate_attributions"
					on "affiliate_attributions"."id" = "affiliate_commissions"."attribution_id"
				where "affiliate_attributions"."link_id" = "affiliate_links"."id"
					and "affiliate_commissions"."entry_type" = 'earning'
			)`.mapWith(affiliateCommissions.createdAt),
		};
	}

	private pickAffiliateAggregate(
		row: AffiliateAggregateColumns,
		quality: AffiliateQualityAggregate = EMPTY_AFFILIATE_QUALITY,
	): Omit<AffiliateAdminAggregate, "currencies"> {
		return {
			linkCount: row.linkCount,
			activeLinkCount: row.activeLinkCount,
			clickCount: row.clickCount,
			uniqueVisitorCount: row.uniqueVisitorCount,
			attributedUserCount: row.attributedUserCount,
			paidCustomerCount: row.paidCustomerCount,
			healthyTrials: quality.healthyTrials,
			churnedCustomers: quality.churnedCustomers,
			referredMrrCents: quality.referredMrrCents,
			referredLtvCents: quality.referredLtvCents,
			paidInvoiceCount: row.paidInvoiceCount,
			lastConversionAt: row.lastConversionAt,
		};
	}

	private pickLinkAggregate(row: LinkAggregateColumns): LinkAggregateColumns {
		return {
			clickCount: row.clickCount,
			uniqueVisitorCount: row.uniqueVisitorCount,
			attributedUserCount: row.attributedUserCount,
			paidCustomerCount: row.paidCustomerCount,
			paidInvoiceCount: row.paidInvoiceCount,
			lastConversionAt: row.lastConversionAt,
		};
	}

	private async qualityByAffiliateIds(
		ids: string[],
	): Promise<Map<string, AffiliateQualityAggregate>> {
		const aggregates = new Map<string, AffiliateQualityAggregate>();
		if (ids.length === 0) {
			return aggregates;
		}

		const result = await this.db.execute<AffiliateQualityRow>(sql`
			with bounds as (
				select
					now() as snapshot_end,
					now() - interval '90 days' as churn_window_start
			),
			selected_affiliates(affiliate_id) as (
				values ${sql.join(
					ids.map((id) => sql`(${id}::uuid)`),
					sql`, `,
				)}
			),
			attributed_users as (
				select aa.affiliate_id, aa.user_id, u.created_at
				from affiliate_attributions aa
				inner join selected_affiliates selected
					on selected.affiliate_id = aa.affiliate_id
				inner join "user" u on u.id = aa.user_id
			),
			mature_users as (
				select au.affiliate_id, au.user_id, au.created_at
				from attributed_users au
				cross join bounds b
				where au.created_at <= b.snapshot_end - interval '7 days'
			),
			first_subscriptions as (
				select m.affiliate_id, m.user_id, min(s.created_at) as first_subscription_at
				from mature_users m
				inner join subscriptions s on s.user_id = m.user_id
				cross join bounds b
				where s.created_at < b.snapshot_end
				group by m.affiliate_id, m.user_id
			),
			credit_consumption as (
				select
					m.affiliate_id,
					m.user_id,
					sum(-c.delta)::bigint as credits_consumed
				from mature_users m
				inner join credit_ledger c on c.user_id = m.user_id
				cross join bounds b
				where c.kind = 'consume'
					and c.created_at >= m.created_at
					and c.created_at < m.created_at + interval '7 days'
					and c.created_at < b.snapshot_end
				group by m.affiliate_id, m.user_id
			),
			completed_generations as (
				select
					generation.affiliate_id,
					generation.user_id,
					count(*)::bigint as completed_generations
				from (
					-- Metering preserves the actor for org work. Legacy personal
					-- attempts may fall back to the project creator; unattributed org
					-- attempts are conservatively excluded. This mirrors the admin
					-- analytics healthy-trial cohort.
					select m.affiliate_id, m.user_id
					from page_generation_attempts a
					inner join projects p on p.id = a.project_id
					cross join bounds b
					left join lateral (
						select e.user_id
						from ai_usage_events e
						where e.operation = 'page_build'
							and e.attempt_ref = a.id::text
							and e.created_at >= a.created_at
							and e.created_at < b.snapshot_end
						order by e.created_at desc
						limit 1
					) usage_actor on true
					inner join mature_users m on m.user_id = coalesce(
						usage_actor.user_id,
						case when p.organization_id is null then p.user_id end
					)
					where p.deleted_at is null
						and a.status = 'succeeded'
						and a.completed_at >= m.created_at
						and a.completed_at < m.created_at + interval '7 days'
						and a.completed_at < b.snapshot_end
					union all
					select m.affiliate_id, m.user_id
					from image_generation_attempts a
					inner join projects p on p.id = a.project_id
					cross join bounds b
					left join lateral (
						select e.user_id
						from ai_usage_events e
						where e.operation = 'image'
							and e.attempt_ref = a.id::text
							and e.created_at >= a.created_at
							and e.created_at < b.snapshot_end
						order by e.created_at desc
						limit 1
					) usage_actor on true
					inner join mature_users m on m.user_id = coalesce(
						usage_actor.user_id,
						case when p.organization_id is null then p.user_id end
					)
					where p.deleted_at is null
						and a.status = 'succeeded'
						and a.created_at >= m.created_at
						and a.created_at < m.created_at + interval '7 days'
						and a.completed_at >= m.created_at
						and a.completed_at < m.created_at + interval '7 days'
						and a.created_at < b.snapshot_end
					union all
					select m.affiliate_id, m.user_id
					from media_generation_attempts a
					inner join projects p on p.id = a.project_id
					cross join bounds b
					left join lateral (
						select e.user_id
						from ai_usage_events e
						where e.operation = 'video'
							and e.attempt_ref = a.id::text
							and e.created_at >= a.created_at
							and e.created_at < b.snapshot_end
						order by e.created_at desc
						limit 1
					) usage_actor on true
					inner join mature_users m on m.user_id = coalesce(
						usage_actor.user_id,
						case when p.organization_id is null then p.user_id end
					)
					where p.deleted_at is null
						and a.status = 'succeeded'
						and a.created_at >= m.created_at
						and a.created_at < m.created_at + interval '7 days'
						and a.completed_at >= m.created_at
						and a.completed_at < m.created_at + interval '7 days'
						and a.created_at < b.snapshot_end
					union all
					select m.affiliate_id, m.user_id
					from marketing_assets a
					inner join projects p on p.id = a.project_id
					cross join bounds b
					left join lateral (
						select e.user_id
						from ai_usage_events e
						where e.operation = 'marketing'
							and e.attempt_ref = a.id::text
							and e.created_at >= a.created_at
							and e.created_at < b.snapshot_end
						order by e.created_at desc
						limit 1
					) usage_actor on true
					inner join mature_users m on m.user_id = coalesce(
						usage_actor.user_id,
						case when p.organization_id is null then p.user_id end
					)
					where p.deleted_at is null
						and a.status = 'succeeded'
						and a.created_at >= m.created_at
						and a.created_at < m.created_at + interval '7 days'
						and a.completed_at >= m.created_at
						and a.completed_at < m.created_at + interval '7 days'
						and a.created_at < b.snapshot_end
					union all
					select m.affiliate_id, m.user_id
					from connector_generation_attempts a
					inner join mature_users m on m.user_id = a.user_id
					cross join bounds b
					where a.status = 'succeeded'
						and a.created_at >= m.created_at
						and a.created_at < m.created_at + interval '7 days'
						and a.completed_at >= m.created_at
						and a.completed_at < m.created_at + interval '7 days'
						and a.created_at < b.snapshot_end
					union all
					select m.affiliate_id, m.user_id
					from lead_scrape_attempts a
					inner join projects p on p.id = a.project_id
					cross join bounds b
					left join lateral (
						select e.user_id
						from ai_usage_events e
						where e.operation = 'lead_scrape'
							and e.attempt_ref = a.id::text
							and e.created_at >= a.created_at
							and e.created_at < b.snapshot_end
						order by e.created_at desc
						limit 1
					) usage_actor on true
					inner join mature_users m on m.user_id = coalesce(
						usage_actor.user_id,
						case when p.organization_id is null then p.user_id end
					)
					where p.deleted_at is null
						and a.status = 'succeeded'
						and a.created_at >= m.created_at
						and a.created_at < m.created_at + interval '7 days'
						and a.completed_at >= m.created_at
						and a.completed_at < m.created_at + interval '7 days'
						and a.created_at < b.snapshot_end
				) generation
				group by generation.affiliate_id, generation.user_id
			),
			healthy_trial_totals as (
				select
					m.affiliate_id,
					count(*) filter (
						where f.first_subscription_at is null
							and coalesce(c.credits_consumed, 0) >= ${HEALTHY_TRIAL_MIN_CENTI_CREDITS}
							and coalesce(g.completed_generations, 0) >= ${HEALTHY_TRIAL_MIN_COMPLETED_GENERATIONS}
					)::int as healthy_trials
				from mature_users m
				left join first_subscriptions f
					on f.affiliate_id = m.affiliate_id and f.user_id = m.user_id
				left join credit_consumption c
					on c.affiliate_id = m.affiliate_id and c.user_id = m.user_id
				left join completed_generations g
					on g.affiliate_id = m.affiliate_id and g.user_id = m.user_id
				group by m.affiliate_id
			),
			referred_subscriptions as (
				select
					au.affiliate_id,
					au.user_id as attribution_user_id,
					'user'::text as owner_kind,
					s.user_id as owner_id,
					s.provider_subscription_id,
					s.price_lookup_key,
					s.status,
					s.created_at
				from attributed_users au
				inner join subscriptions s
					on s.organization_id is null and s.user_id = au.user_id
				cross join bounds b
				where s.created_at < b.snapshot_end
				union all
				select
					au.affiliate_id,
					au.user_id as attribution_user_id,
					'organization'::text as owner_kind,
					s.organization_id as owner_id,
					s.provider_subscription_id,
					s.price_lookup_key,
					s.status,
					s.created_at
				from attributed_users au
				inner join organization_billing_customers obc
					on obc.attribution_user_id = au.user_id
				inner join subscriptions s
					on s.organization_id = obc.organization_id
				cross join bounds b
				where s.created_at < b.snapshot_end
			),
			ended_subscription_events as (
				select
					e.stripe_subscription_id,
					bool_or(e.occurred_at >= b.churn_window_start) as ended_in_churn_window
				from subscription_state_events e
				inner join (
					select distinct rs.provider_subscription_id
					from referred_subscriptions rs
				) referred on referred.provider_subscription_id = e.stripe_subscription_id
				cross join bounds b
				where e.kind = 'ended' and e.occurred_at < b.snapshot_end
				group by e.stripe_subscription_id
			),
			referred_owner_states as (
				select
					rs.affiliate_id,
					rs.attribution_user_id,
					rs.owner_kind,
					rs.owner_id,
					bool_or(rs.status in (${liveSubscriptionStatusList()})) as live_at_snapshot,
					bool_or(ended.stripe_subscription_id is not null) as has_ended,
					bool_or(coalesce(ended.ended_in_churn_window, false)) as ended_in_churn_window
				from referred_subscriptions rs
				left join ended_subscription_events ended
					on ended.stripe_subscription_id = rs.provider_subscription_id
				group by
					rs.affiliate_id,
					rs.attribution_user_id,
					rs.owner_kind,
					rs.owner_id
			),
			churn_totals as (
				select
					states.affiliate_id,
					count(distinct states.attribution_user_id) filter (
						where states.has_ended and not states.live_at_snapshot
					)::int as churned_customers,
					count(*) filter (
						where states.ended_in_churn_window and not states.live_at_snapshot
					)::int as trailing_churned_owners
				from referred_owner_states states
				group by states.affiliate_id
			),
			live_subscription_totals as (
				select
					rs.affiliate_id,
					count(distinct (rs.owner_kind, rs.owner_id))::int as live_paid_owners,
					round(coalesce(sum(${catalogMonthlyMrrCase(sql.raw("rs.price_lookup_key"))}), 0))::bigint as referred_mrr_cents
				from referred_subscriptions rs
				where rs.status in (${liveSubscriptionStatusList()})
				group by rs.affiliate_id
			),
			baseline_live_owner_totals as (
				select
					rs.affiliate_id,
					count(distinct (rs.owner_kind, rs.owner_id))::int as baseline_live_paid_owners
				from referred_subscriptions rs
				left join ended_subscription_events ended
					on ended.stripe_subscription_id = rs.provider_subscription_id
				cross join bounds b
				where rs.created_at < b.churn_window_start
					and (
						rs.status in (${liveSubscriptionStatusList()})
						or coalesce(ended.ended_in_churn_window, false)
					)
				group by rs.affiliate_id
			)
			select
				selected.affiliate_id,
				coalesce(healthy.healthy_trials, 0)::int as healthy_trials,
				coalesce(churn.churned_customers, 0)::int as churned_customers,
				coalesce(live.referred_mrr_cents, 0)::bigint as referred_mrr_cents,
				coalesce(live.live_paid_owners, 0)::int as live_paid_owners,
				coalesce(baseline.baseline_live_paid_owners, 0)::int as baseline_live_paid_owners,
				coalesce(churn.trailing_churned_owners, 0)::int as trailing_churned_owners
			from selected_affiliates selected
			left join healthy_trial_totals healthy
				on healthy.affiliate_id = selected.affiliate_id
			left join churn_totals churn
				on churn.affiliate_id = selected.affiliate_id
			left join live_subscription_totals live
				on live.affiliate_id = selected.affiliate_id
			left join baseline_live_owner_totals baseline
				on baseline.affiliate_id = selected.affiliate_id
		`);

		for (const row of result.rows) {
			const referredMrrCents = Number(row.referred_mrr_cents);
			aggregates.set(row.affiliate_id, {
				churnedCustomers: Number(row.churned_customers),
				healthyTrials: Number(row.healthy_trials),
				referredMrrCents,
				referredLtvCents: calculateAffiliateReferredLtvCents({
					baselineLivePaidOwners: Number(row.baseline_live_paid_owners),
					livePaidOwners: Number(row.live_paid_owners),
					referredMrrCents,
					trailingChurnedOwners: Number(row.trailing_churned_owners),
				}),
			});
		}

		return aggregates;
	}

	private async currenciesByAffiliateIds(ids: string[]) {
		return this.currencyMap("affiliateId", ids);
	}

	private async currenciesByProgramIds(ids: string[]) {
		return this.currencyMap("programId", ids);
	}

	private async currenciesByLinkIds(ids: string[]) {
		return this.currencyMap("linkId", ids);
	}

	private async currenciesByAttributionIds(ids: string[]) {
		return this.currencyMap("attributionId", ids);
	}

	private async currencyMap(
		group: "affiliateId" | "attributionId" | "linkId" | "programId",
		ids: string[],
	): Promise<Map<string, AffiliateCurrencyAggregate[]>> {
		const result = new Map<string, AffiliateCurrencyAggregate[]>();
		if (ids.length === 0) {
			return result;
		}

		const groupColumn =
			group === "affiliateId"
				? affiliateCommissions.affiliateId
				: group === "attributionId"
					? affiliateCommissions.attributionId
					: group === "linkId"
						? affiliateAttributions.linkId
						: affiliateAttributions.programId;
		const base = this.db
			.select({
				groupId: groupColumn,
				currency: affiliateCommissions.currency,
				attributedRevenueCents: sql<number>`coalesce(sum(
					case when ${affiliateCommissions.entryType} = 'earning'
					then ${affiliateCommissions.baseAmountCents} else 0 end
				), 0)::float8`,
				pendingCommissionCents: sql<number>`coalesce(sum(
					case when ${affiliateCommissions.status} = 'pending'
					then ${affiliateCommissions.amountCents} else 0 end
				), 0)::float8`,
				approvedCommissionCents: sql<number>`coalesce(sum(
					case when ${affiliateCommissions.status} = 'approved'
					then ${affiliateCommissions.amountCents} else 0 end
				), 0)::float8`,
				paidCommissionCents: sql<number>`coalesce(sum(
					case when ${affiliateCommissions.status} = 'paid'
					then ${affiliateCommissions.amountCents} else 0 end
				), 0)::float8`,
				balanceCents: sql<number>`coalesce(sum(
					case when ${affiliateCommissions.payoutId} is null
						and ${affiliateCommissions.status} in ('pending', 'approved')
					then ${affiliateCommissions.amountCents} else 0 end
				), 0)::float8`,
			})
			.from(affiliateCommissions);

		const rows =
			group === "affiliateId" || group === "attributionId"
				? await base
						.where(inArray(groupColumn, ids))
						.groupBy(groupColumn, affiliateCommissions.currency)
				: await base
						.innerJoin(
							affiliateAttributions,
							eq(affiliateAttributions.id, affiliateCommissions.attributionId),
						)
						.where(inArray(groupColumn, ids))
						.groupBy(groupColumn, affiliateCommissions.currency);

		for (const row of rows) {
			const aggregate: AffiliateCurrencyAggregate = {
				currency: row.currency,
				attributedRevenueCents: row.attributedRevenueCents,
				pendingCommissionCents: row.pendingCommissionCents,
				approvedCommissionCents: row.approvedCommissionCents,
				paidCommissionCents: row.paidCommissionCents,
				balanceCents: row.balanceCents,
			};
			result.set(row.groupId, [...(result.get(row.groupId) ?? []), aggregate]);
		}

		return result;
	}

	private async buildSummary(
		rows: Array<{ id: string; status: "active" | "paused" }>,
	): Promise<AffiliateAdminSummary> {
		const ids = rows.map((row) => row.id);
		if (ids.length === 0) {
			return {
				affiliateCount: 0,
				activeAffiliateCount: 0,
				linkCount: 0,
				activeLinkCount: 0,
				clickCount: 0,
				uniqueVisitorCount: 0,
				attributedUserCount: 0,
				paidCustomerCount: 0,
				paidInvoiceCount: 0,
				currencies: [],
			};
		}

		const [counts, currencyMap] = await Promise.all([
			this.db.execute<{
				link_count: number;
				active_link_count: number;
				click_count: number;
				unique_visitor_count: number;
				attributed_user_count: number;
				paid_customer_count: number;
				paid_invoice_count: number;
			}>(sql`
				select
					(select count(*)::int from "affiliate_links" where "affiliate_id" in (${sql.join(
						ids.map((id) => sql`${id}`),
						sql`, `,
					)})) as link_count,
					(select count(*)::int from "affiliate_links" where "affiliate_id" in (${sql.join(
						ids.map((id) => sql`${id}`),
						sql`, `,
					)}) and "active" = true and ("expires_at" is null or "expires_at" > now())) as active_link_count,
					(select count(*)::int from "affiliate_clicks" inner join "affiliate_links" on "affiliate_links"."id" = "affiliate_clicks"."link_id" where "affiliate_links"."affiliate_id" in (${sql.join(
						ids.map((id) => sql`${id}`),
						sql`, `,
					)})) as click_count,
					(select count(distinct "affiliate_clicks"."ip_hash")::int from "affiliate_clicks" inner join "affiliate_links" on "affiliate_links"."id" = "affiliate_clicks"."link_id" where "affiliate_links"."affiliate_id" in (${sql.join(
						ids.map((id) => sql`${id}`),
						sql`, `,
					)})) as unique_visitor_count,
					(select count(*)::int from "affiliate_attributions" where "affiliate_id" in (${sql.join(
						ids.map((id) => sql`${id}`),
						sql`, `,
					)})) as attributed_user_count,
					(select count(distinct "affiliate_attributions"."user_id")::int from "affiliate_attributions" inner join "affiliate_commissions" on "affiliate_commissions"."attribution_id" = "affiliate_attributions"."id" and "affiliate_commissions"."entry_type" = 'earning' where "affiliate_attributions"."affiliate_id" in (${sql.join(
						ids.map((id) => sql`${id}`),
						sql`, `,
					)})) as paid_customer_count,
					(select count(*)::int from "affiliate_commissions" where "affiliate_id" in (${sql.join(
						ids.map((id) => sql`${id}`),
						sql`, `,
					)}) and "entry_type" = 'earning') as paid_invoice_count
			`),
			this.currenciesByAffiliateIds(ids),
		]);
		const count = counts.rows[0];
		const mergedCurrencies = mergeCurrencyAggregates(
			[...currencyMap.values()].flat(),
		);

		return {
			affiliateCount: ids.length,
			activeAffiliateCount: rows.filter((row) => row.status === "active")
				.length,
			linkCount: Number(count?.link_count ?? 0),
			activeLinkCount: Number(count?.active_link_count ?? 0),
			clickCount: Number(count?.click_count ?? 0),
			uniqueVisitorCount: Number(count?.unique_visitor_count ?? 0),
			attributedUserCount: Number(count?.attributed_user_count ?? 0),
			paidCustomerCount: Number(count?.paid_customer_count ?? 0),
			paidInvoiceCount: Number(count?.paid_invoice_count ?? 0),
			currencies: mergedCurrencies,
		};
	}

	private programInsertValues(input: CreateAffiliateProgramInput) {
		if (input.kind === "percentage_recurring") {
			return {
				...input,
				fixedAmountCents: null,
				fixedCurrency: null,
			};
		}

		return {
			...input,
			commissionRateBps: null,
		};
	}
}

export function calculateAffiliateReferredLtvCents(input: {
	baselineLivePaidOwners: number;
	livePaidOwners: number;
	referredMrrCents: number;
	trailingChurnedOwners: number;
}): number | null {
	if (
		input.livePaidOwners <= 0 ||
		input.baselineLivePaidOwners <= 0 ||
		input.trailingChurnedOwners <= 0
	) {
		return null;
	}

	const arpuCents = input.referredMrrCents / input.livePaidOwners;
	const monthlyChurn =
		(input.trailingChurnedOwners / input.baselineLivePaidOwners) * (30.44 / 90);
	const ltvCents = Math.round(arpuCents / monthlyChurn);

	return Number.isFinite(ltvCents) ? Math.max(0, ltvCents) : null;
}

function liveSubscriptionStatusList(): SQL {
	return sql.join(
		LIVE_SUBSCRIPTION_STATUSES.map((status) => sql`${status}`),
		sql`, `,
	);
}

function catalogMonthlyMrrCase(priceLookupKeyColumn: SQL): SQL {
	return sql`case ${priceLookupKeyColumn}
		${sql.join(
			AFFILIATE_MRR_CATALOG.map(
				(price) =>
					sql`when ${price.lookupKey} then ${price.monthlyMrrCents}::numeric`,
			),
			sql` `,
		)}
		else 0::numeric
	end`;
}

function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function mergeCurrencyAggregates(
	rows: AffiliateCurrencyAggregate[],
): AffiliateCurrencyAggregate[] {
	const merged = new Map<string, AffiliateCurrencyAggregate>();

	for (const row of rows) {
		const current = merged.get(row.currency) ?? {
			currency: row.currency,
			attributedRevenueCents: 0,
			pendingCommissionCents: 0,
			approvedCommissionCents: 0,
			paidCommissionCents: 0,
			balanceCents: 0,
		};
		merged.set(row.currency, {
			currency: row.currency,
			attributedRevenueCents:
				current.attributedRevenueCents + row.attributedRevenueCents,
			pendingCommissionCents:
				current.pendingCommissionCents + row.pendingCommissionCents,
			approvedCommissionCents:
				current.approvedCommissionCents + row.approvedCommissionCents,
			paidCommissionCents:
				current.paidCommissionCents + row.paidCommissionCents,
			balanceCents: current.balanceCents + row.balanceCents,
		});
	}

	return [...merged.values()].sort((left, right) =>
		left.currency.localeCompare(right.currency),
	);
}

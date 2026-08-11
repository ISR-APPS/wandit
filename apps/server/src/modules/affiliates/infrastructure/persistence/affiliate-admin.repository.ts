import { Inject, Injectable } from "@nestjs/common";
import type {
	AffiliateCsvExportQuery,
	AffiliateCurrencyAggregate,
	CreateAffiliateInput,
	CreateAffiliateLinkInput,
	CreateAffiliateProgramInput,
	ListAffiliateAttributionsQuery,
	ListAffiliateCommissionsQuery,
	ListAffiliateLinksQuery,
	ListAffiliatePayoutsQuery,
	ListAffiliateProgramsQuery,
	ListAffiliatesQuery,
	UpdateAffiliateInput,
	UpdateAffiliateLinkInput,
	UpdateAffiliateProgramInput,
} from "@wandit/contracts";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "@wandit/db";
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
	paidInvoiceCount: number;
	lastConversionAt: Date | null;
	currencies: AffiliateCurrencyAggregate[];
};

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

type AffiliateAggregateColumns = Omit<AffiliateAdminAggregate, "currencies">;
type LinkAggregateColumns = Omit<AffiliateAdminLinkAggregate, "currencies">;
type AffiliateAdminWriteClient = Pick<Database, "update">;

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

		const [currencies, summary] = await Promise.all([
			this.currenciesByAffiliateIds(rows.map((row) => row.affiliate.id)),
			this.buildSummary(allAffiliates),
		]);

		return {
			page: {
				items: rows.map((row) => ({
					affiliate: row.affiliate,
					aggregates: {
						...this.pickAffiliateAggregate(row),
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

		const currencies = await this.currenciesByAffiliateIds([id]);

		return {
			affiliate: row.affiliate,
			aggregates: {
				...this.pickAffiliateAggregate(row),
				currencies: currencies.get(id) ?? [],
			},
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
		const currencies = await this.currenciesByAffiliateIds(
			rows.map((row) => row.affiliate.id),
		);

		return rows.map((row) => ({
			affiliate: row.affiliate,
			aggregates: {
				...this.pickAffiliateAggregate(row),
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
	): AffiliateAggregateColumns {
		return {
			linkCount: row.linkCount,
			activeLinkCount: row.activeLinkCount,
			clickCount: row.clickCount,
			uniqueVisitorCount: row.uniqueVisitorCount,
			attributedUserCount: row.attributedUserCount,
			paidCustomerCount: row.paidCustomerCount,
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

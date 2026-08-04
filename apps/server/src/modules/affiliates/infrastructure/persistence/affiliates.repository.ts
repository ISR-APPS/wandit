import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "@wandit/db";
import {
	affiliateAttributions,
	affiliateClicks,
	affiliateCommissions,
	affiliateInvoiceCandidates,
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
import { payoutEntryRemainsEligible } from "../../domain/affiliate-commission-policy";
import {
	type AffiliateFraudCode,
	appendAffiliateFraudFlag,
} from "../../domain/affiliate-fraud";

export type AffiliateTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type AffiliateClient = Pick<
	Database,
	"delete" | "execute" | "insert" | "select" | "update"
>;

export type AffiliateLinkTerms = {
	active: boolean;
	affiliateEmail: string;
	affiliateId: string;
	affiliateStatus: "active" | "paused";
	code: string;
	cookieWindowDays: number;
	expiresAt: Date | null;
	fixedAmountCents: number | null;
	fixedCurrency: string | null;
	holdDays: number;
	id: string;
	programId: string;
	programKind: "fixed_one_time" | "percentage_recurring";
	programStatus: "active" | "archived";
	rateBps: number | null;
	durationMonths: number | null;
	affiliateUserId: string | null;
};

export type AffiliateAttributionRow = typeof affiliateAttributions.$inferSelect;
export type AffiliateCandidateRow =
	typeof affiliateInvoiceCandidates.$inferSelect;
export type AffiliateCommissionRow = typeof affiliateCommissions.$inferSelect;
export type AffiliatePayoutRow = typeof affiliatePayouts.$inferSelect;

export class AffiliatePayoutIneligibleError extends Error {
	constructor(payoutId: string) {
		super(`Affiliate payout ${payoutId} has ineligible claimed entries`);
		this.name = "AffiliatePayoutIneligibleError";
	}
}

export class AffiliatePayoutConflictError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AffiliatePayoutConflictError";
	}
}

export type InsertAttributionInput = {
	affiliateId: string;
	clickedAt: Date;
	commissionDurationMonths: number | null;
	commissionRateBps: number | null;
	fixedAmountCents: number | null;
	fixedCurrency: string | null;
	fraudFlags: unknown[];
	linkId: string;
	lockedAt: Date;
	programId: string;
	programKind: "fixed_one_time" | "percentage_recurring";
	source: "manual" | "signup_body" | "signup_cookie";
	userId: string;
};

export type InsertEarningInput = {
	attributionId: string;
	affiliateId: string;
	amountCents: number;
	baseAmountCents: number;
	currency: string;
	holdUntil: Date;
	rateBps: number | null;
	stripeChargeId: string;
	stripeInvoiceId: string;
};

export type InsertAdjustmentInput = {
	attributionId: string;
	affiliateId: string;
	amountCents: number;
	baseAmountCents: number;
	currency: string;
	holdUntil: Date;
	originalCommissionId: string;
	rateBps: number | null;
	reversalReason: string;
	status: "approved" | "pending";
	stripeChargeId: string;
	stripeDisputeId?: string | null;
	stripeInvoiceId: string;
	stripeRefundId?: string | null;
};

@Injectable()
export class AffiliatesRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async withAttributionLock<T>(
		userId: string,
		operation: (tx: AffiliateTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext('affiliate-attribution:' || ${userId}::text))`,
			);

			return operation(tx);
		});
	}

	async withInvoiceLock<T>(
		invoiceId: string,
		operation: (tx: AffiliateTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext('affiliate-invoice:' || ${invoiceId}::text))`,
			);

			return operation(tx);
		});
	}

	async withChargeLock<T>(
		chargeId: string,
		operation: (tx: AffiliateTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await this.lockCharge(chargeId, tx);

			return operation(tx);
		});
	}

	async lockCharge(
		chargeId: string,
		client: AffiliateTransaction,
	): Promise<void> {
		// This is intentionally the same lock key used by PaymentRefundsService.
		await client.execute(
			sql`select pg_advisory_xact_lock(hashtext('stripe-credit-clawback:' || ${chargeId}::text))`,
		);
	}

	async withPayoutLock<T>(
		affiliateId: string,
		currency: string,
		operation: (tx: AffiliateTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			// Serialize payout claiming with affiliate identity changes and their
			// self-referral recheck before taking the currency-specific lock.
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext('affiliate:' || ${affiliateId}::text))`,
			);
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext('affiliate-payout:' || ${affiliateId}::text || ':' || ${currency}::text))`,
			);

			return operation(tx);
		});
	}

	async withAffiliateLock<T>(
		affiliateId: string,
		operation: (tx: AffiliateTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await this.lockAffiliate(affiliateId, tx);

			return operation(tx);
		});
	}

	async lockAffiliate(
		affiliateId: string,
		client: AffiliateTransaction,
	): Promise<void> {
		await client.execute(
			sql`select pg_advisory_xact_lock(hashtext('affiliate:' || ${affiliateId}::text))`,
		);
	}

	async findUserIdentity(
		userId: string,
		client: AffiliateClient = this.db,
	): Promise<{ email: string; id: string } | null> {
		const [row] = await client
			.select({ email: user.email, id: user.id })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		return row ?? null;
	}

	async findLinkTerms(
		code: string,
		client: AffiliateClient = this.db,
		lockForUpdate = false,
	): Promise<AffiliateLinkTerms | null> {
		const query = client
			.select({
				active: affiliateLinks.active,
				affiliateEmail: affiliates.email,
				affiliateId: affiliates.id,
				affiliateStatus: affiliates.status,
				affiliateUserId: affiliates.userId,
				code: affiliateLinks.code,
				cookieWindowDays: affiliatePrograms.cookieWindowDays,
				durationMonths: affiliatePrograms.commissionDurationMonths,
				expiresAt: affiliateLinks.expiresAt,
				fixedAmountCents: affiliatePrograms.fixedAmountCents,
				fixedCurrency: affiliatePrograms.fixedCurrency,
				holdDays: affiliatePrograms.holdDays,
				id: affiliateLinks.id,
				programId: affiliatePrograms.id,
				programKind: affiliatePrograms.kind,
				programStatus: affiliatePrograms.status,
				rateBps: affiliatePrograms.commissionRateBps,
			})
			.from(affiliateLinks)
			.innerJoin(
				affiliatePrograms,
				eq(affiliateLinks.programId, affiliatePrograms.id),
			)
			.innerJoin(affiliates, eq(affiliateLinks.affiliateId, affiliates.id))
			.where(eq(affiliateLinks.code, code))
			.limit(1);
		const [row] = lockForUpdate ? await query.for("update") : await query;

		return row ?? null;
	}

	async insertClick(input: {
		ipHash: string;
		landingUrl: string;
		linkId: string;
		userAgent: string | null;
	}): Promise<void> {
		await this.db.insert(affiliateClicks).values(input);
	}

	async findAttributionByUserId(
		userId: string,
		client: AffiliateClient = this.db,
	): Promise<AffiliateAttributionRow | null> {
		const [row] = await client
			.select()
			.from(affiliateAttributions)
			.where(eq(affiliateAttributions.userId, userId))
			.limit(1);

		return row ?? null;
	}

	async lockAttributionByUserId(
		userId: string,
		client: AffiliateTransaction,
	): Promise<AffiliateAttributionRow | null> {
		const [row] = await client
			.select()
			.from(affiliateAttributions)
			.where(eq(affiliateAttributions.userId, userId))
			.limit(1)
			.for("update");

		return row ?? null;
	}

	async insertAttributionFirstWins(
		input: InsertAttributionInput,
		client: AffiliateClient,
	): Promise<AffiliateAttributionRow | null> {
		const [row] = await client
			.insert(affiliateAttributions)
			.values(input)
			.onConflictDoNothing({ target: affiliateAttributions.userId })
			.returning();

		return row ?? null;
	}

	async appendFraudFlag(
		attributionId: string,
		code: AffiliateFraudCode,
		client: AffiliateTransaction,
	): Promise<void> {
		const [row] = await client
			.select({ fraudFlags: affiliateAttributions.fraudFlags })
			.from(affiliateAttributions)
			.where(eq(affiliateAttributions.id, attributionId))
			.limit(1)
			.for("update");

		if (!row) {
			return;
		}

		await client
			.update(affiliateAttributions)
			.set({
				fraudFlags: appendAffiliateFraudFlag(row.fraudFlags, code),
				updatedAt: new Date(),
			})
			.where(eq(affiliateAttributions.id, attributionId));
	}

	async affiliateIdentityForSelfCheck(
		affiliateId: string,
		client: AffiliateClient,
	): Promise<{ email: string; userId: string | null } | null> {
		const [row] = await client
			.select({ email: affiliates.email, userId: affiliates.userId })
			.from(affiliates)
			.where(eq(affiliates.id, affiliateId))
			.limit(1);

		return row ?? null;
	}

	async attributedUsersForSelfCheck(
		affiliateId: string,
		client: AffiliateClient,
	): Promise<Array<{ attributionId: string; email: string; userId: string }>> {
		return client
			.select({
				attributionId: affiliateAttributions.id,
				email: user.email,
				userId: affiliateAttributions.userId,
			})
			.from(affiliateAttributions)
			.innerJoin(user, eq(affiliateAttributions.userId, user.id))
			.where(eq(affiliateAttributions.affiliateId, affiliateId));
	}

	async affiliateCodeForUser(userId: string): Promise<string | null> {
		const [row] = await this.db
			.select({ code: affiliateLinks.code })
			.from(affiliateAttributions)
			.innerJoin(
				affiliateLinks,
				eq(affiliateAttributions.linkId, affiliateLinks.id),
			)
			.where(
				and(
					eq(affiliateAttributions.userId, userId),
					eq(affiliateAttributions.status, "active"),
				),
			)
			.limit(1);

		return row?.code ?? null;
	}

	async upsertCandidate(
		input: {
			baseAmountCents: number;
			billingReason: string;
			currency: string;
			paidAt: Date;
			stripeInvoiceId: string;
			userId: string;
		},
		client: AffiliateTransaction,
	): Promise<AffiliateCandidateRow> {
		const [inserted] = await client
			.insert(affiliateInvoiceCandidates)
			.values(input)
			.onConflictDoNothing({
				target: affiliateInvoiceCandidates.stripeInvoiceId,
			})
			.returning();

		if (inserted) {
			return inserted;
		}

		const [existing] = await client
			.select()
			.from(affiliateInvoiceCandidates)
			.where(
				eq(affiliateInvoiceCandidates.stripeInvoiceId, input.stripeInvoiceId),
			)
			.limit(1)
			.for("update");

		if (!existing) {
			throw new Error(
				`Affiliate candidate ${input.stripeInvoiceId} disappeared`,
			);
		}

		if (
			existing.userId !== input.userId ||
			existing.billingReason !== input.billingReason ||
			existing.baseAmountCents !== input.baseAmountCents ||
			existing.currency !== input.currency ||
			existing.paidAt.getTime() !== input.paidAt.getTime()
		) {
			throw new Error(
				`Affiliate candidate ${input.stripeInvoiceId} replay payload mismatch`,
			);
		}

		return existing;
	}

	async setCandidateStatus(
		id: string,
		status: "ineligible" | "pending_attribution" | "processed",
		client: AffiliateClient,
	): Promise<void> {
		await client
			.update(affiliateInvoiceCandidates)
			.set({ status, updatedAt: new Date() })
			.where(eq(affiliateInvoiceCandidates.id, id));
	}

	async listPendingCandidatesForUser(
		userId: string,
	): Promise<AffiliateCandidateRow[]> {
		return this.db
			.select()
			.from(affiliateInvoiceCandidates)
			.where(
				and(
					eq(affiliateInvoiceCandidates.userId, userId),
					eq(affiliateInvoiceCandidates.status, "pending_attribution"),
				),
			)
			.orderBy(asc(affiliateInvoiceCandidates.paidAt));
	}

	async listPendingAttributedCandidateUserIds(
		limit = 1_000,
	): Promise<string[]> {
		const rows = await this.db
			.select({
				oldestPaidAt: sql<Date>`min(${affiliateInvoiceCandidates.paidAt})`,
				userId: affiliateInvoiceCandidates.userId,
			})
			.from(affiliateInvoiceCandidates)
			.innerJoin(
				affiliateAttributions,
				eq(affiliateAttributions.userId, affiliateInvoiceCandidates.userId),
			)
			.where(eq(affiliateInvoiceCandidates.status, "pending_attribution"))
			.groupBy(affiliateInvoiceCandidates.userId)
			.orderBy(
				asc(sql`min(${affiliateInvoiceCandidates.paidAt})`),
				asc(affiliateInvoiceCandidates.userId),
			)
			.limit(limit);

		return rows.map((row) => row.userId);
	}

	async lockCandidateByInvoiceId(
		stripeInvoiceId: string,
		client: AffiliateTransaction,
	): Promise<AffiliateCandidateRow | null> {
		const [row] = await client
			.select()
			.from(affiliateInvoiceCandidates)
			.where(eq(affiliateInvoiceCandidates.stripeInvoiceId, stripeInvoiceId))
			.limit(1)
			.for("update");

		return row ?? null;
	}

	async hasEarningForAttribution(
		attributionId: string,
		client: AffiliateClient,
	): Promise<boolean> {
		const [row] = await client
			.select({ id: affiliateCommissions.id })
			.from(affiliateCommissions)
			.where(
				and(
					eq(affiliateCommissions.attributionId, attributionId),
					eq(affiliateCommissions.entryType, "earning"),
				),
			)
			.limit(1);

		return row !== undefined;
	}

	async holdDaysForAttribution(
		attributionId: string,
		client: AffiliateClient,
	): Promise<number> {
		const [row] = await client
			.select({ holdDays: affiliatePrograms.holdDays })
			.from(affiliateAttributions)
			.innerJoin(
				affiliatePrograms,
				eq(affiliateAttributions.programId, affiliatePrograms.id),
			)
			.where(eq(affiliateAttributions.id, attributionId))
			.limit(1);

		if (!row) {
			throw new Error(`Affiliate attribution ${attributionId} has no program`);
		}

		return row.holdDays;
	}

	async insertEarning(
		input: InsertEarningInput,
		client: AffiliateClient,
	): Promise<AffiliateCommissionRow | null> {
		const [row] = await client
			.insert(affiliateCommissions)
			.values({ ...input, entryType: "earning", status: "pending" })
			.onConflictDoNothing()
			.returning();

		return row ?? null;
	}

	async findEarningByChargeId(
		chargeId: string,
		client: AffiliateClient,
	): Promise<AffiliateCommissionRow | null> {
		const [row] = await client
			.select()
			.from(affiliateCommissions)
			.where(
				and(
					eq(affiliateCommissions.stripeChargeId, chargeId),
					eq(affiliateCommissions.entryType, "earning"),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async findEarningByInvoiceId(
		invoiceId: string,
		client: AffiliateClient = this.db,
	): Promise<AffiliateCommissionRow | null> {
		const [row] = await client
			.select()
			.from(affiliateCommissions)
			.where(
				and(
					eq(affiliateCommissions.stripeInvoiceId, invoiceId),
					eq(affiliateCommissions.entryType, "earning"),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async listAdjustments(
		originalCommissionId: string,
		client: AffiliateClient,
	): Promise<AffiliateCommissionRow[]> {
		return client
			.select()
			.from(affiliateCommissions)
			.where(
				and(
					eq(affiliateCommissions.originalCommissionId, originalCommissionId),
					eq(affiliateCommissions.entryType, "adjustment"),
				),
			)
			.orderBy(asc(affiliateCommissions.createdAt));
	}

	async insertAdjustment(
		input: InsertAdjustmentInput,
		client: AffiliateClient,
	): Promise<AffiliateCommissionRow | null> {
		const [row] = await client
			.insert(affiliateCommissions)
			.values({ ...input, entryType: "adjustment" })
			.onConflictDoNothing()
			.returning();

		return row ?? null;
	}

	async approveEligible(now = new Date()): Promise<number> {
		const rows = await this.db
			.update(affiliateCommissions)
			.set({ status: "approved", updatedAt: now })
			.where(
				and(
					eq(affiliateCommissions.status, "pending"),
					sql`${affiliateCommissions.holdUntil} <= ${now}`,
					// Candidate processed means post-earning refund/dispute reconciliation
					// completed. A reset pending candidate is a durable approval barrier.
					sql`exists (
						select 1 from ${affiliateInvoiceCandidates}
						where ${affiliateInvoiceCandidates.stripeInvoiceId} = ${affiliateCommissions.stripeInvoiceId}
						and ${affiliateInvoiceCandidates.status} = 'processed'
					)`,
					sql`exists (
						select 1 from ${affiliateAttributions}
						where ${affiliateAttributions.id} = ${affiliateCommissions.attributionId}
						and ${affiliateAttributions.status} = 'active'
						and not exists (
							select 1
							from jsonb_array_elements(coalesce(${affiliateAttributions.fraudFlags}, '[]'::jsonb)) as flag
							where nullif(flag->>'resolvedAt', '') is null
						)
					)`,
				),
			)
			.returning({ id: affiliateCommissions.id });

		return rows.length;
	}

	async findPayoutByRequestId(
		requestId: string,
		client: AffiliateClient = this.db,
	): Promise<AffiliatePayoutRow | null> {
		const [row] = await client
			.select()
			.from(affiliatePayouts)
			.where(eq(affiliatePayouts.requestId, requestId))
			.limit(1);

		return row ?? null;
	}

	async lockEligiblePayoutEntries(
		affiliateId: string,
		currency: string,
		client: AffiliateTransaction,
	): Promise<AffiliateCommissionRow[]> {
		const attributionEligible = and(
			eq(affiliateAttributions.status, "active"),
			sql`not exists (
				select 1
				from jsonb_array_elements(coalesce(${affiliateAttributions.fraudFlags}, '[]'::jsonb)) as flag
				where nullif(flag->>'resolvedAt', '') is null
			)`,
		);
		const candidateProcessed = eq(
			affiliateInvoiceCandidates.status,
			"processed",
		);

		return client
			.select({
				amountCents: affiliateCommissions.amountCents,
				affiliateId: affiliateCommissions.affiliateId,
				attributionId: affiliateCommissions.attributionId,
				baseAmountCents: affiliateCommissions.baseAmountCents,
				createdAt: affiliateCommissions.createdAt,
				entryType: affiliateCommissions.entryType,
				holdUntil: affiliateCommissions.holdUntil,
				id: affiliateCommissions.id,
				originalCommissionId: affiliateCommissions.originalCommissionId,
				payoutId: affiliateCommissions.payoutId,
				rateBps: affiliateCommissions.rateBps,
				reversalReason: affiliateCommissions.reversalReason,
				status: affiliateCommissions.status,
				stripeChargeId: affiliateCommissions.stripeChargeId,
				stripeDisputeId: affiliateCommissions.stripeDisputeId,
				stripeInvoiceId: affiliateCommissions.stripeInvoiceId,
				stripeRefundId: affiliateCommissions.stripeRefundId,
				updatedAt: affiliateCommissions.updatedAt,
				currency: affiliateCommissions.currency,
			})
			.from(affiliateCommissions)
			.innerJoin(
				affiliateAttributions,
				eq(affiliateCommissions.attributionId, affiliateAttributions.id),
			)
			.innerJoin(
				affiliateInvoiceCandidates,
				eq(
					affiliateInvoiceCandidates.stripeInvoiceId,
					affiliateCommissions.stripeInvoiceId,
				),
			)
			.where(
				and(
					eq(affiliateCommissions.affiliateId, affiliateId),
					eq(affiliateCommissions.currency, currency),
					eq(affiliateCommissions.status, "approved"),
					isNull(affiliateCommissions.payoutId),
					// A negative adjustment is payable debt only after its original earning
					// was paid, or while that eligible original can be claimed in this same
					// payout. This prevents charging an affiliate for a pending earning that
					// is later voided/flagged and never paid.
					or(
						and(
							sql`${affiliateCommissions.amountCents} >= 0`,
							candidateProcessed,
							attributionEligible,
						),
						and(
							sql`${affiliateCommissions.amountCents} < 0`,
							or(
								sql`exists (
									select 1
									from affiliate_commissions as original
									where original.id = ${affiliateCommissions.originalCommissionId}
									and original.status = 'paid'
								)`,
								and(
									candidateProcessed,
									attributionEligible,
									sql`exists (
										select 1
										from affiliate_commissions as original
										where original.id = ${affiliateCommissions.originalCommissionId}
										and original.status = 'approved'
										and original.payout_id is null
									)`,
								),
							),
						),
					),
				),
			)
			.orderBy(
				asc(affiliateCommissions.createdAt),
				asc(affiliateCommissions.id),
			)
			.for("update");
	}

	async affiliatePayoutMethod(
		affiliateId: string,
		client: AffiliateClient,
	): Promise<"manual" | "paypal" | "wise" | null> {
		const [row] = await client
			.select({ method: affiliates.payoutMethod })
			.from(affiliates)
			.where(eq(affiliates.id, affiliateId))
			.limit(1);

		return row?.method ?? null;
	}

	async createPayout(
		input: {
			affiliateId: string;
			createdByUserId: string;
			currency: string;
			method: "manual" | "paypal" | "wise";
			periodEnd: Date;
			periodStart: Date;
			requestId: string;
			totalCents: number;
		},
		client: AffiliateClient,
	): Promise<AffiliatePayoutRow> {
		const [row] = await client
			.insert(affiliatePayouts)
			.values({ ...input, status: "processing" })
			.returning();

		if (!row) {
			throw new Error("Affiliate payout insert did not return a row");
		}

		return row;
	}

	async claimPayoutEntries(
		entryIds: string[],
		affiliateId: string,
		currency: string,
		payoutId: string,
		client: AffiliateClient,
	): Promise<AffiliateCommissionRow[]> {
		if (entryIds.length === 0) {
			return [];
		}

		return client
			.update(affiliateCommissions)
			.set({ payoutId, updatedAt: new Date() })
			.where(
				and(
					inArray(affiliateCommissions.id, entryIds),
					eq(affiliateCommissions.affiliateId, affiliateId),
					eq(affiliateCommissions.currency, currency),
					eq(affiliateCommissions.status, "approved"),
					isNull(affiliateCommissions.payoutId),
				),
			)
			.returning();
	}

	async markPayoutPaid(input: {
		externalRef: string;
		method: "manual" | "paypal" | "wise";
		paidAt: Date;
		payoutId: string;
	}): Promise<AffiliatePayoutRow | null> {
		return this.db.transaction(async (tx) => {
			const [payout] = await tx
				.select()
				.from(affiliatePayouts)
				.where(eq(affiliatePayouts.id, input.payoutId))
				.limit(1)
				.for("update");

			if (!payout) {
				return null;
			}

			if (payout.status === "paid") {
				if (
					payout.method !== input.method ||
					payout.externalRef !== input.externalRef
				) {
					throw new AffiliatePayoutConflictError(
						"Paid affiliate payout replay payload mismatch",
					);
				}

				return payout;
			}

			if (payout.status !== "processing") {
				throw new AffiliatePayoutConflictError(
					`Affiliate payout ${payout.id} is not processing`,
				);
			}

			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext('affiliate:' || ${payout.affiliateId}::text))`,
			);
			const entries = await tx
				.select({
					amountCents: affiliateCommissions.amountCents,
					attributionStatus: affiliateAttributions.status,
					candidateStatus: affiliateInvoiceCandidates.status,
					commissionStatus: affiliateCommissions.status,
					originalPayoutId: sql<string | null>`(
						select original.payout_id
						from affiliate_commissions as original
						where original.id = ${affiliateCommissions.originalCommissionId}
					)`,
					originalStatus: sql<AffiliateCommissionRow["status"] | null>`(
						select original.status
						from affiliate_commissions as original
						where original.id = ${affiliateCommissions.originalCommissionId}
					)`,
					unresolvedFraud: sql<boolean>`exists (
						select 1
						from jsonb_array_elements(coalesce(${affiliateAttributions.fraudFlags}, '[]'::jsonb)) as flag
						where nullif(flag->>'resolvedAt', '') is null
					)`,
				})
				.from(affiliateCommissions)
				.innerJoin(
					affiliateAttributions,
					eq(affiliateAttributions.id, affiliateCommissions.attributionId),
				)
				.innerJoin(
					affiliateInvoiceCandidates,
					eq(
						affiliateInvoiceCandidates.stripeInvoiceId,
						affiliateCommissions.stripeInvoiceId,
					),
				)
				.where(eq(affiliateCommissions.payoutId, payout.id));
			const claimedTotalCents = entries.reduce(
				(sum, entry) => sum + entry.amountCents,
				0,
			);
			const hasIneligibleEntry = entries.some(
				(entry) =>
					!payoutEntryRemainsEligible({
						amountCents: entry.amountCents,
						attributionActive: entry.attributionStatus === "active",
						candidateProcessed: entry.candidateStatus === "processed",
						commissionStatus: entry.commissionStatus,
						originalPayoutId: entry.originalPayoutId,
						originalStatus: entry.originalStatus,
						payoutId: payout.id,
						unresolvedFraud: entry.unresolvedFraud,
					}),
			);

			if (
				entries.length === 0 ||
				claimedTotalCents !== payout.totalCents ||
				hasIneligibleEntry
			) {
				throw new AffiliatePayoutIneligibleError(payout.id);
			}

			await tx
				.update(affiliateCommissions)
				.set({ status: "paid", updatedAt: input.paidAt })
				.where(eq(affiliateCommissions.payoutId, payout.id));

			const [updated] = await tx
				.update(affiliatePayouts)
				.set({
					externalRef: input.externalRef,
					method: input.method,
					paidAt: input.paidAt,
					status: "paid",
					updatedAt: input.paidAt,
				})
				.where(eq(affiliatePayouts.id, payout.id))
				.returning();

			return updated ?? null;
		});
	}

	async failAndReleasePayout(
		payoutId: string,
	): Promise<AffiliatePayoutRow | null> {
		return this.db.transaction(async (tx) => {
			const [payout] = await tx
				.select()
				.from(affiliatePayouts)
				.where(eq(affiliatePayouts.id, payoutId))
				.limit(1)
				.for("update");

			if (!payout) {
				return null;
			}

			if (payout.status === "failed") {
				return payout;
			}

			if (payout.status !== "processing") {
				throw new AffiliatePayoutConflictError(
					`Affiliate payout ${payout.id} is not processing`,
				);
			}

			await tx
				.update(affiliateCommissions)
				.set({ payoutId: null, updatedAt: new Date() })
				.where(eq(affiliateCommissions.payoutId, payout.id));

			const [updated] = await tx
				.update(affiliatePayouts)
				.set({ status: "failed", updatedAt: new Date() })
				.where(eq(affiliatePayouts.id, payout.id))
				.returning();

			return updated ?? null;
		});
	}

	async getPayout(id: string): Promise<AffiliatePayoutRow | null> {
		const [row] = await this.db
			.select()
			.from(affiliatePayouts)
			.where(eq(affiliatePayouts.id, id))
			.limit(1);

		return row ?? null;
	}

	async listPayouts(): Promise<AffiliatePayoutRow[]> {
		return this.db
			.select()
			.from(affiliatePayouts)
			.orderBy(desc(affiliatePayouts.createdAt));
	}

	async userEmail(
		userId: string,
		client: AffiliateClient,
	): Promise<string | null> {
		const [row] = await client
			.select({ email: user.email })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		return row?.email ?? null;
	}
}

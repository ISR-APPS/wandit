import { Inject, Injectable } from "@nestjs/common";
import {
	type AdminListManualSubscriptionsQuery,
	type BillingInterval,
	type BillingPlanId,
	type CreditTier,
	ENTITLED_SUBSCRIPTION_STATUSES,
	type PaginatedResult,
} from "@wandit/contracts";
import {
	and,
	desc,
	eq,
	ilike,
	inArray,
	isNull,
	notInArray,
	or,
	type SQL,
	sql,
} from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import {
	manualSubscriptionPayments,
	subscriptions,
} from "@wandit/db/schema/billing";
import { organization } from "@wandit/db/schema/organizations";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type { CreditOwner } from "../../../credits/domain/credit-owner";

export type SubscriptionRow = typeof subscriptions.$inferSelect;

export type SubscriptionsTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type SubscriptionsClient = Pick<Database, "insert" | "select" | "update">;

export type AdminManualSubscriptionRow = {
	// Raw string from the pg driver (subquery max()), or Date, or null.
	lastPaymentAt: Date | string | null;
	organization: {
		id: string;
		name: string;
		slug: string;
	} | null;
	paymentsCount: number;
	subscription: SubscriptionRow;
	user: {
		email: string;
		id: string;
		image: string | null;
		name: string;
	};
};

export type ManualBillingOwnerRow = {
	organization: {
		id: string;
		name: string;
		slug: string;
	} | null;
	user: {
		email: string;
		id: string;
		image: string | null;
		name: string;
	};
};

export type InsertManualSubscriptionInput = {
	cancelAtPeriodEnd: boolean;
	currentPeriodEnd: Date;
	currentPeriodStart: Date;
	interval: BillingInterval;
	organizationId: string | null;
	plan: BillingPlanId;
	priceLookupKey: string;
	providerSubscriptionId: string;
	status: string;
	tierCredits: CreditTier;
	userId: string;
};

export type UpdateSubscriptionPeriodInput = {
	cancelAtPeriodEnd?: boolean;
	currentPeriodEnd: Date;
	currentPeriodStart: Date;
	pendingAppliedBy?: string | null;
	pendingTierCredits?: CreditTier | null;
	priceLookupKey?: string;
	status: string;
	tierCredits?: CreditTier;
};

export type UpsertSubscriptionInput = {
	cancelAtPeriodEnd: boolean;
	currentPeriodEnd: Date;
	currentPeriodStart: Date;
	interval: BillingInterval;
	organizationId?: string | null;
	plan: BillingPlanId;
	priceLookupKey: string;
	provider: string;
	providerSubscriptionId: string;
	status: string;
	tierCredits: CreditTier;
	userId: string;
};

export type UpdateSubscriptionProviderStateInput = {
	cancelAtPeriodEnd: boolean;
	currentPeriodEnd: Date;
	currentPeriodStart: Date;
	providerSubscriptionId: string;
	status: string;
};

const entitledSubscriptionStatuses = [...ENTITLED_SUBSCRIPTION_STATUSES];

@Injectable()
export class SubscriptionsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async withStripeCustomerSyncLock<T>(
		providerCustomerId: string,
		fn: (tx: SubscriptionsTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext('stripe-sub-sync:' || ${providerCustomerId}::text))`,
			);

			return fn(tx);
		});
	}

	async upsertByProviderSubscriptionId(
		input: UpsertSubscriptionInput,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow> {
		const values = {
			cancelAtPeriodEnd: input.cancelAtPeriodEnd,
			currentPeriodEnd: input.currentPeriodEnd,
			currentPeriodStart: input.currentPeriodStart,
			interval: input.interval,
			organizationId: input.organizationId ?? null,
			plan: input.plan,
			priceLookupKey: input.priceLookupKey,
			provider: input.provider,
			providerSubscriptionId: input.providerSubscriptionId,
			status: input.status,
			tierCredits: input.tierCredits,
			userId: input.userId,
		};
		const [row] = await client
			.insert(subscriptions)
			.values(values)
			.onConflictDoUpdate({
				set: {
					...values,
					updatedAt: new Date(),
				},
				target: subscriptions.providerSubscriptionId,
			})
			.returning();

		return this.expectRow(row);
	}

	async insertManual(
		input: InsertManualSubscriptionInput,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow> {
		const [row] = await client
			.insert(subscriptions)
			.values({ ...input, provider: "manual" })
			.returning();

		return this.expectRow(row);
	}

	async findActiveByOwner(
		owner: CreditOwner,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		// Owner-keyed on purpose: an org creator's userId appears on BOTH their
		// personal subscription and (as provenance) the org's — a bare user
		// predicate would cross-talk between the two pools.
		const ownerPredicate =
			owner.type === "user"
				? and(
						eq(subscriptions.userId, owner.userId),
						isNull(subscriptions.organizationId),
					)
				: eq(subscriptions.organizationId, owner.organizationId);
		const [row] = await client
			.select()
			.from(subscriptions)
			.where(
				and(
					ownerPredicate,
					sql`${subscriptions.status} NOT IN ('canceled', 'incomplete_expired')`,
				),
			)
			.orderBy(desc(subscriptions.updatedAt), desc(subscriptions.createdAt))
			.limit(1);

		return row ?? null;
	}

	async findActiveByOwnerAndProvider(
		owner: CreditOwner,
		provider: string,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const ownerPredicate =
			owner.type === "user"
				? and(
						eq(subscriptions.userId, owner.userId),
						isNull(subscriptions.organizationId),
					)
				: eq(subscriptions.organizationId, owner.organizationId);
		const [row] = await client
			.select()
			.from(subscriptions)
			.where(
				and(
					ownerPredicate,
					eq(subscriptions.provider, provider),
					sql`${subscriptions.status} NOT IN ('canceled', 'incomplete_expired')`,
				),
			)
			.orderBy(desc(subscriptions.updatedAt), desc(subscriptions.createdAt))
			.limit(1);

		return row ?? null;
	}

	async findManualBillingOwner(
		userId: string,
		organizationId: string | null,
		client: SubscriptionsClient = this.db,
	): Promise<ManualBillingOwnerRow | null> {
		if (organizationId === null) {
			const [row] = await client
				.select({
					user: {
						email: user.email,
						id: user.id,
						image: user.image,
						name: user.name,
					},
				})
				.from(user)
				.where(eq(user.id, userId))
				.limit(1);

			return row ? { ...row, organization: null } : null;
		}

		const [row] = await client
			.select({
				organization: {
					id: organization.id,
					name: organization.name,
					slug: organization.slug,
				},
				user: {
					email: user.email,
					id: user.id,
					image: user.image,
					name: user.name,
				},
			})
			.from(user)
			.innerJoin(organization, eq(organization.id, organizationId))
			.where(eq(user.id, userId))
			.limit(1);

		return row ?? null;
	}

	async findByProviderSubscriptionId(
		providerSubscriptionId: string,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
			.limit(1);

		return row ?? null;
	}

	async findById(
		id: string,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.select()
			.from(subscriptions)
			.where(eq(subscriptions.id, id))
			.limit(1);

		return row ?? null;
	}

	async updatePeriod(
		id: string,
		input: UpdateSubscriptionPeriodInput,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.update(subscriptions)
			.set({
				...(input.cancelAtPeriodEnd === undefined
					? {}
					: { cancelAtPeriodEnd: input.cancelAtPeriodEnd }),
				currentPeriodEnd: input.currentPeriodEnd,
				currentPeriodStart: input.currentPeriodStart,
				...(input.pendingAppliedBy === undefined
					? {}
					: { pendingAppliedBy: input.pendingAppliedBy }),
				...(input.pendingTierCredits === undefined
					? {}
					: { pendingTierCredits: input.pendingTierCredits }),
				...(input.priceLookupKey === undefined
					? {}
					: { priceLookupKey: input.priceLookupKey }),
				status: input.status,
				...(input.tierCredits === undefined
					? {}
					: { tierCredits: input.tierCredits }),
				updatedAt: new Date(),
			})
			.where(eq(subscriptions.id, id))
			.returning();

		return row ?? null;
	}

	async listManualDueForExpiry(
		now: Date,
		limit: number,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow[]> {
		return client
			.select()
			.from(subscriptions)
			.where(
				and(
					eq(subscriptions.provider, "manual"),
					inArray(subscriptions.status, entitledSubscriptionStatuses),
					sql`${subscriptions.currentPeriodEnd} <= ${now}`,
				),
			)
			.orderBy(subscriptions.currentPeriodEnd, subscriptions.id)
			.limit(limit);
	}

	async countManualActive(
		now: Date,
		client: SubscriptionsClient = this.db,
	): Promise<number> {
		const [row] = await client
			.select({ total: sql<number>`count(*)::int` })
			.from(subscriptions)
			.where(
				and(
					eq(subscriptions.provider, "manual"),
					inArray(subscriptions.status, entitledSubscriptionStatuses),
					sql`${subscriptions.currentPeriodEnd} > ${now}`,
				),
			);

		return row?.total ?? 0;
	}

	async countManualExpiringBetween(
		from: Date,
		until: Date,
		client: SubscriptionsClient = this.db,
	): Promise<number> {
		const [row] = await client
			.select({ total: sql<number>`count(*)::int` })
			.from(subscriptions)
			.where(
				and(
					eq(subscriptions.provider, "manual"),
					inArray(subscriptions.status, entitledSubscriptionStatuses),
					sql`${subscriptions.currentPeriodEnd} > ${from}`,
					sql`${subscriptions.currentPeriodEnd} <= ${until}`,
				),
			);

		return row?.total ?? 0;
	}

	async listManualForAdmin(
		query: AdminListManualSubscriptionsQuery,
		entitlementCutoff = new Date(),
	): Promise<PaginatedResult<AdminManualSubscriptionRow>> {
		const where = this.manualAdminFilter(query, entitlementCutoff);
		const offset = (query.page - 1) * query.pageSize;
		const [totalRow] = await this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(subscriptions)
			.innerJoin(user, eq(user.id, subscriptions.userId))
			.leftJoin(organization, eq(organization.id, subscriptions.organizationId))
			.where(where);
		const items = await this.manualAdminSelect(this.db)
			.where(where)
			.orderBy(desc(subscriptions.createdAt), desc(subscriptions.id))
			.limit(query.pageSize)
			.offset(offset);

		return {
			items,
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	async findManualAdminById(
		id: string,
		client: SubscriptionsClient = this.db,
	): Promise<AdminManualSubscriptionRow | null> {
		const [row] = await this.manualAdminSelect(client)
			.where(
				and(eq(subscriptions.id, id), eq(subscriptions.provider, "manual")),
			)
			.limit(1);

		return row ?? null;
	}

	async setPendingTierCredits(
		providerSubscriptionId: string,
		pendingTierCredits: CreditTier | null,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.update(subscriptions)
			.set({
				pendingAppliedBy: null,
				pendingTierCredits,
				updatedAt: new Date(),
			})
			.where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
			.returning();

		return row ?? null;
	}

	async markPendingTierApplied(
		providerSubscriptionId: string,
		appliedBy: string,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.update(subscriptions)
			.set({ pendingAppliedBy: appliedBy, updatedAt: new Date() })
			.where(
				and(
					eq(subscriptions.providerSubscriptionId, providerSubscriptionId),
					sql`${subscriptions.pendingTierCredits} IS NOT NULL`,
					sql`${subscriptions.pendingAppliedBy} IS NULL`,
				),
			)
			.returning();

		return row ?? null;
	}

	async clearAppliedPendingTier(
		providerSubscriptionId: string,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.update(subscriptions)
			.set({
				pendingAppliedBy: null,
				pendingTierCredits: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(subscriptions.providerSubscriptionId, providerSubscriptionId),
					sql`${subscriptions.pendingAppliedBy} IS NOT NULL`,
				),
			)
			.returning();

		return row ?? null;
	}

	async clearMatchingPendingTier(
		providerSubscriptionId: string,
		tierCredits: number,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.update(subscriptions)
			.set({
				pendingAppliedBy: null,
				pendingTierCredits: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(subscriptions.providerSubscriptionId, providerSubscriptionId),
					eq(subscriptions.pendingTierCredits, tierCredits),
				),
			)
			.returning();

		return row ?? null;
	}

	async updateStatus(
		providerSubscriptionId: string,
		status: string,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.update(subscriptions)
			.set({
				status,
				updatedAt: new Date(),
			})
			.where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
			.returning();

		return row ?? null;
	}

	async updateProviderState(
		input: UpdateSubscriptionProviderStateInput,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.update(subscriptions)
			.set({
				cancelAtPeriodEnd: input.cancelAtPeriodEnd,
				currentPeriodEnd: input.currentPeriodEnd,
				currentPeriodStart: input.currentPeriodStart,
				status: input.status,
				updatedAt: new Date(),
			})
			.where(
				eq(subscriptions.providerSubscriptionId, input.providerSubscriptionId),
			)
			.returning();

		return row ?? null;
	}

	async updateCancelAtPeriodEnd(
		providerSubscriptionId: string,
		cancelAtPeriodEnd: boolean,
	): Promise<SubscriptionRow | null> {
		const [row] = await this.db
			.update(subscriptions)
			.set({
				cancelAtPeriodEnd,
				updatedAt: new Date(),
			})
			.where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
			.returning();

		return row ?? null;
	}

	async updateTierAndPrice(
		providerSubscriptionId: string,
		tierCredits: CreditTier,
		priceLookupKey: string,
		client: SubscriptionsClient = this.db,
	): Promise<SubscriptionRow | null> {
		const [row] = await client
			.update(subscriptions)
			.set({
				priceLookupKey,
				tierCredits,
				updatedAt: new Date(),
			})
			.where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
			.returning();

		return row ?? null;
	}

	private manualAdminSelect(client: SubscriptionsClient) {
		const paymentSummary = client
			.select({
				// Raw SQL fields in a subquery need explicit aliases; without them
				// drizzle throws when the outer select references the field.
				lastPaymentAt: sql<
					Date | string | null
				>`max(${manualSubscriptionPayments.createdAt})`.as("last_payment_at"),
				paymentsCount: sql<number>`count(*)::int`.as("payments_count"),
				subscriptionId: manualSubscriptionPayments.subscriptionId,
			})
			.from(manualSubscriptionPayments)
			.groupBy(manualSubscriptionPayments.subscriptionId)
			.as("manual_subscription_payment_summary");

		return client
			.select({
				lastPaymentAt: paymentSummary.lastPaymentAt,
				organization: {
					id: organization.id,
					name: organization.name,
					slug: organization.slug,
				},
				paymentsCount: sql<number>`coalesce(${paymentSummary.paymentsCount}, 0)::int`,
				subscription: subscriptions,
				user: {
					email: user.email,
					id: user.id,
					image: user.image,
					name: user.name,
				},
			})
			.from(subscriptions)
			.innerJoin(user, eq(user.id, subscriptions.userId))
			.leftJoin(organization, eq(organization.id, subscriptions.organizationId))
			.leftJoin(
				paymentSummary,
				eq(paymentSummary.subscriptionId, subscriptions.id),
			);
	}

	private manualAdminFilter(
		query: AdminListManualSubscriptionsQuery,
		entitlementCutoff: Date,
	): SQL | undefined {
		const filters: (SQL | undefined)[] = [eq(subscriptions.provider, "manual")];
		const entitledNow = and(
			inArray(subscriptions.status, entitledSubscriptionStatuses),
			sql`${subscriptions.currentPeriodEnd} > ${entitlementCutoff}`,
		);

		if (query.status === "active") {
			filters.push(entitledNow);
		} else if (query.status === "ended") {
			filters.push(
				or(
					notInArray(subscriptions.status, entitledSubscriptionStatuses),
					sql`${subscriptions.currentPeriodEnd} <= ${entitlementCutoff}`,
				),
			);
		}

		if (query.q) {
			const pattern = `%${this.escapeLikePattern(query.q)}%`;
			filters.push(
				or(
					ilike(user.name, pattern),
					ilike(user.email, pattern),
					ilike(organization.name, pattern),
					ilike(subscriptions.providerSubscriptionId, pattern),
				),
			);
		}

		return and(...filters);
	}

	private escapeLikePattern(value: string) {
		return value
			.replaceAll("\\", "\\\\")
			.replaceAll("%", "\\%")
			.replaceAll("_", "\\_");
	}

	private expectRow(row: SubscriptionRow | undefined) {
		if (!row) {
			throw new Error("Subscription write did not return a row");
		}

		return row;
	}
}

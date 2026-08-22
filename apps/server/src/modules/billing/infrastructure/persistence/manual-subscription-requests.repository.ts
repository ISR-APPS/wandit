import { Inject, Injectable } from "@nestjs/common";
import {
	type AdminListManualRequestsQuery,
	type BillingInterval,
	type BillingPlanId,
	type CreditTier,
	type ManualPaymentMethod,
	type ManualSubscriptionRequestStatus,
	OPEN_MANUAL_REQUEST_STATUSES,
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
	manualSubscriptionRequests,
	subscriptions,
} from "@wandit/db/schema/billing";
import { organization } from "@wandit/db/schema/organizations";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type { CreditOwner } from "../../../credits/domain/credit-owner";
export type ManualSubscriptionRequestRow =
	typeof manualSubscriptionRequests.$inferSelect;

export type ManualBillingUserRow = Pick<
	typeof user.$inferSelect,
	"email" | "id" | "image" | "name"
>;

export type ManualBillingOrganizationRow = Pick<
	typeof organization.$inferSelect,
	"id" | "name" | "slug"
>;

export type AdminManualCurrentSubscriptionRow = Pick<
	typeof subscriptions.$inferSelect,
	| "cancelAtPeriodEnd"
	| "currentPeriodEnd"
	| "id"
	| "interval"
	| "plan"
	| "provider"
	| "status"
	| "tierCredits"
>;

export type AdminManualRequestRow = {
	currentSubscription: AdminManualCurrentSubscriptionRow | null;
	handledBy: ManualBillingUserRow | null;
	organization: ManualBillingOrganizationRow | null;
	request: ManualSubscriptionRequestRow;
	user: ManualBillingUserRow;
};

export type InsertManualSubscriptionRequestInput = {
	city: string | null;
	company: string | null;
	country: string;
	fullName: string;
	interval: BillingInterval;
	notes: string | null;
	organizationId: string | null;
	phone: string;
	plan: BillingPlanId;
	preferredPaymentMethod: ManualPaymentMethod | null;
	status: ManualSubscriptionRequestStatus;
	tierCredits: CreditTier;
	userId: string;
};

export type UpdateManualSubscriptionRequestInput = {
	adminNotes?: string | null;
	handledAt?: Date | null;
	handledByUserId?: string | null;
	status?: ManualSubscriptionRequestStatus;
	subscriptionId?: string | null;
};

export type ManualSubscriptionRequestsTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type ManualSubscriptionRequestsClient = Pick<
	Database,
	"insert" | "select" | "update"
>;

const TERMINAL_SUBSCRIPTION_STATUSES = ["canceled", "incomplete_expired"];

@Injectable()
export class ManualSubscriptionRequestsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async insert(
		input: InsertManualSubscriptionRequestInput,
		client: ManualSubscriptionRequestsClient = this.db,
	): Promise<ManualSubscriptionRequestRow> {
		const [row] = await client
			.insert(manualSubscriptionRequests)
			.values(input)
			.returning();

		return this.expectRow(row);
	}

	async findOpenByOwner(
		owner: CreditOwner,
		client: ManualSubscriptionRequestsClient = this.db,
	): Promise<ManualSubscriptionRequestRow | null> {
		const [row] = await client
			.select()
			.from(manualSubscriptionRequests)
			.where(
				and(
					this.ownerPredicate(owner),
					inArray(manualSubscriptionRequests.status, [
						...OPEN_MANUAL_REQUEST_STATUSES,
					]),
				),
			)
			.orderBy(
				desc(manualSubscriptionRequests.updatedAt),
				desc(manualSubscriptionRequests.createdAt),
			)
			.limit(1);

		return row ?? null;
	}

	async findById(
		id: string,
		client: ManualSubscriptionRequestsClient = this.db,
	): Promise<ManualSubscriptionRequestRow | null> {
		const [row] = await client
			.select()
			.from(manualSubscriptionRequests)
			.where(eq(manualSubscriptionRequests.id, id))
			.limit(1);

		return row ?? null;
	}

	async findBySubscriptionId(
		subscriptionId: string,
		client: ManualSubscriptionRequestsClient = this.db,
	): Promise<ManualSubscriptionRequestRow | null> {
		const [row] = await client
			.select()
			.from(manualSubscriptionRequests)
			.where(eq(manualSubscriptionRequests.subscriptionId, subscriptionId))
			.orderBy(desc(manualSubscriptionRequests.updatedAt))
			.limit(1);

		return row ?? null;
	}

	async listForAdmin(
		query: AdminListManualRequestsQuery,
	): Promise<PaginatedResult<AdminManualRequestRow>> {
		const where = this.adminFilter(query);
		const offset = (query.page - 1) * query.pageSize;
		const [totalRow] = await this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(manualSubscriptionRequests)
			.innerJoin(user, eq(user.id, manualSubscriptionRequests.userId))
			.leftJoin(
				organization,
				eq(organization.id, manualSubscriptionRequests.organizationId),
			)
			.where(where);
		const items = await this.adminSelect(this.db)
			.where(where)
			.orderBy(
				desc(manualSubscriptionRequests.createdAt),
				desc(manualSubscriptionRequests.id),
			)
			.limit(query.pageSize)
			.offset(offset);

		return {
			items,
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
	}

	async findAdminById(
		id: string,
		client: ManualSubscriptionRequestsClient = this.db,
	): Promise<AdminManualRequestRow | null> {
		const [row] = await this.adminSelect(client)
			.where(eq(manualSubscriptionRequests.id, id))
			.limit(1);

		return row ?? null;
	}

	async update(
		id: string,
		input: UpdateManualSubscriptionRequestInput,
		client: ManualSubscriptionRequestsClient = this.db,
	): Promise<ManualSubscriptionRequestRow | null> {
		const [row] = await client
			.update(manualSubscriptionRequests)
			.set({ ...input, updatedAt: new Date() })
			.where(eq(manualSubscriptionRequests.id, id))
			.returning();

		return row ?? null;
	}

	async updateIfNotTerminal(
		id: string,
		input: UpdateManualSubscriptionRequestInput,
		client: ManualSubscriptionRequestsClient = this.db,
	): Promise<ManualSubscriptionRequestRow | null> {
		const [row] = await client
			.update(manualSubscriptionRequests)
			.set({ ...input, updatedAt: new Date() })
			.where(
				and(
					eq(manualSubscriptionRequests.id, id),
					notInArray(manualSubscriptionRequests.status, [
						"approved",
						"canceled",
					]),
				),
			)
			.returning();

		return row ?? null;
	}

	async cancelOpenByOwner(
		owner: CreditOwner,
		client: ManualSubscriptionRequestsClient = this.db,
	): Promise<ManualSubscriptionRequestRow | null> {
		const [row] = await client
			.update(manualSubscriptionRequests)
			.set({ status: "canceled", updatedAt: new Date() })
			.where(
				and(
					this.ownerPredicate(owner),
					inArray(manualSubscriptionRequests.status, [
						...OPEN_MANUAL_REQUEST_STATUSES,
					]),
				),
			)
			.returning();

		return row ?? null;
	}

	async countOpen(
		client: ManualSubscriptionRequestsClient = this.db,
	): Promise<number> {
		const [row] = await client
			.select({ total: sql<number>`count(*)::int` })
			.from(manualSubscriptionRequests)
			.where(
				inArray(manualSubscriptionRequests.status, [
					...OPEN_MANUAL_REQUEST_STATUSES,
				]),
			);

		return row?.total ?? 0;
	}

	private adminSelect(client: ManualSubscriptionRequestsClient) {
		const handledBy = client
			.select({
				email: user.email,
				id: user.id,
				image: user.image,
				name: user.name,
			})
			.from(user)
			.as("manual_request_handled_by");
		const currentSubscription = client
			.select()
			.from(subscriptions)
			.where(notInArray(subscriptions.status, TERMINAL_SUBSCRIPTION_STATUSES))
			.as("manual_request_current_subscription");

		return client
			.select({
				currentSubscription: {
					cancelAtPeriodEnd: currentSubscription.cancelAtPeriodEnd,
					currentPeriodEnd: currentSubscription.currentPeriodEnd,
					id: currentSubscription.id,
					interval: currentSubscription.interval,
					plan: currentSubscription.plan,
					provider: currentSubscription.provider,
					status: currentSubscription.status,
					tierCredits: currentSubscription.tierCredits,
				},
				handledBy: {
					email: handledBy.email,
					id: handledBy.id,
					image: handledBy.image,
					name: handledBy.name,
				},
				organization: {
					id: organization.id,
					name: organization.name,
					slug: organization.slug,
				},
				request: manualSubscriptionRequests,
				user: {
					email: user.email,
					id: user.id,
					image: user.image,
					name: user.name,
				},
			})
			.from(manualSubscriptionRequests)
			.innerJoin(user, eq(user.id, manualSubscriptionRequests.userId))
			.leftJoin(
				organization,
				eq(organization.id, manualSubscriptionRequests.organizationId),
			)
			.leftJoin(
				handledBy,
				eq(handledBy.id, manualSubscriptionRequests.handledByUserId),
			)
			.leftJoin(
				currentSubscription,
				or(
					and(
						isNull(manualSubscriptionRequests.organizationId),
						isNull(currentSubscription.organizationId),
						eq(currentSubscription.userId, manualSubscriptionRequests.userId),
					),
					sql`${manualSubscriptionRequests.organizationId} IS NOT NULL AND ${currentSubscription.organizationId} = ${manualSubscriptionRequests.organizationId}`,
				),
			);
	}

	private adminFilter(query: AdminListManualRequestsQuery): SQL | undefined {
		const filters: (SQL | undefined)[] = [];

		if (query.status === "open") {
			filters.push(
				inArray(manualSubscriptionRequests.status, [
					...OPEN_MANUAL_REQUEST_STATUSES,
				]),
			);
		} else if (query.status !== "all") {
			filters.push(eq(manualSubscriptionRequests.status, query.status));
		}

		if (query.q) {
			const pattern = `%${this.escapeLikePattern(query.q)}%`;
			filters.push(
				or(
					ilike(manualSubscriptionRequests.fullName, pattern),
					ilike(manualSubscriptionRequests.phone, pattern),
					ilike(manualSubscriptionRequests.company, pattern),
					ilike(user.name, pattern),
					ilike(user.email, pattern),
				),
			);
		}

		return and(...filters);
	}

	private ownerPredicate(owner: CreditOwner): SQL {
		return owner.type === "user"
			? (and(
					eq(manualSubscriptionRequests.userId, owner.userId),
					isNull(manualSubscriptionRequests.organizationId),
				) as SQL)
			: eq(manualSubscriptionRequests.organizationId, owner.organizationId);
	}

	private escapeLikePattern(value: string) {
		return value
			.replaceAll("\\", "\\\\")
			.replaceAll("%", "\\%")
			.replaceAll("_", "\\_");
	}

	private expectRow(row: ManualSubscriptionRequestRow | undefined) {
		if (!row) {
			throw new Error("Manual subscription request write did not return a row");
		}

		return row;
	}
}

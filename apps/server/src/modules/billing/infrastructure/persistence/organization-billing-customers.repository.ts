import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "@wandit/db";
import { organizationBillingCustomers } from "@wandit/db/schema/billing";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type OrganizationBillingCustomerRow =
	typeof organizationBillingCustomers.$inferSelect;

export type OrgBillingCustomersTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type OrgBillingCustomersDbClient = Pick<
	Database,
	"execute" | "insert" | "select" | "update"
>;

/**
 * Org Stripe customers live in their OWN table (design §5.1): the personal
 * billing_customers invariants (one row per user, ON CONFLICT (user_id)
 * upsert, findByUserId) stay byte-identical, and no personal money path can
 * ever resolve an org customer.
 */
@Injectable()
export class OrganizationBillingCustomersRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** Same serialization role as the personal `billing-customer:` lock. */
	async withOrganizationLock<T>(
		organizationId: string,
		fn: (tx: OrgBillingCustomersTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${`billing-customer:org:${organizationId}`}))`,
			);

			return fn(tx);
		});
	}

	async findByOrganizationId(
		organizationId: string,
		client: OrgBillingCustomersDbClient = this.db,
	): Promise<OrganizationBillingCustomerRow | null> {
		const [row] = await client
			.select()
			.from(organizationBillingCustomers)
			.where(eq(organizationBillingCustomers.organizationId, organizationId))
			.limit(1);

		return row ?? null;
	}

	async findByProviderCustomerId(
		providerCustomerId: string,
		client: OrgBillingCustomersDbClient = this.db,
	): Promise<OrganizationBillingCustomerRow | null> {
		const [row] = await client
			.select()
			.from(organizationBillingCustomers)
			.where(
				eq(organizationBillingCustomers.providerCustomerId, providerCustomerId),
			)
			.limit(1);

		return row ?? null;
	}

	async upsertByOrganizationId(
		input: {
			attributionUserId: string;
			createdByUserId: string;
			organizationId: string;
			provider: string;
			providerCustomerId: string;
		},
		client: OrgBillingCustomersDbClient = this.db,
	): Promise<OrganizationBillingCustomerRow> {
		const [row] = await client
			.insert(organizationBillingCustomers)
			.values(input)
			.onConflictDoUpdate({
				set: {
					provider: input.provider,
					providerCustomerId: input.providerCustomerId,
					updatedAt: new Date(),
				},
				target: organizationBillingCustomers.organizationId,
			})
			.returning();

		if (!row) {
			throw new Error(
				`Organization billing customer upsert returned no row for ${input.organizationId}`,
			);
		}

		return row;
	}

	async setOpenCheckoutSessionId(
		organizationId: string,
		openCheckoutSessionId: string | null,
		client: OrgBillingCustomersDbClient = this.db,
	): Promise<void> {
		await client
			.update(organizationBillingCustomers)
			.set({ openCheckoutSessionId, updatedAt: new Date() })
			.where(eq(organizationBillingCustomers.organizationId, organizationId));
	}
}

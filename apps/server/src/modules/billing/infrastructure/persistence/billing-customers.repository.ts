import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "@wandit/db";
import { billingCustomers } from "@wandit/db/schema/billing";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type BillingCustomerRow = typeof billingCustomers.$inferSelect;

export type BillingCustomersTransaction = Parameters<
	Parameters<Database["transaction"]>[0]
>[0];

type BillingCustomersClient = Pick<Database, "insert" | "select" | "update">;

export type UpsertBillingCustomerInput = {
	provider: string;
	providerCustomerId: string;
	userId: string;
};

@Injectable()
export class BillingCustomersRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async withUserLock<T>(
		userId: string,
		fn: (tx: BillingCustomersTransaction) => Promise<T>,
	): Promise<T> {
		return this.db.transaction(async (tx) => {
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext('billing-customer:' || ${userId}::text))`,
			);

			return fn(tx);
		});
	}

	async upsertByUserId(
		input: UpsertBillingCustomerInput,
		client: BillingCustomersClient = this.db,
	): Promise<BillingCustomerRow> {
		const [row] = await client
			.insert(billingCustomers)
			.values(input)
			.onConflictDoUpdate({
				set: {
					provider: input.provider,
					providerCustomerId: input.providerCustomerId,
					updatedAt: new Date(),
				},
				target: billingCustomers.userId,
			})
			.returning();

		return this.expectRow(row);
	}

	async findByUserId(
		userId: string,
		client: BillingCustomersClient = this.db,
	): Promise<BillingCustomerRow | null> {
		const [row] = await client
			.select()
			.from(billingCustomers)
			.where(eq(billingCustomers.userId, userId))
			.limit(1);

		return row ?? null;
	}

	async findByProviderCustomerId(
		providerCustomerId: string,
		provider = "stripe",
	): Promise<BillingCustomerRow | null> {
		const [row] = await this.db
			.select()
			.from(billingCustomers)
			.where(
				and(
					eq(billingCustomers.provider, provider),
					eq(billingCustomers.providerCustomerId, providerCustomerId),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async setOpenCheckoutSessionId(
		userId: string,
		openCheckoutSessionId: string,
		client: BillingCustomersClient = this.db,
	): Promise<BillingCustomerRow> {
		const [row] = await client
			.update(billingCustomers)
			.set({
				openCheckoutSessionId,
				updatedAt: new Date(),
			})
			.where(eq(billingCustomers.userId, userId))
			.returning();

		return this.expectRow(row);
	}

	async clearOpenCheckoutSessionId(
		openCheckoutSessionId: string,
		client: BillingCustomersClient = this.db,
	): Promise<boolean> {
		const [row] = await client
			.update(billingCustomers)
			.set({
				openCheckoutSessionId: null,
				updatedAt: new Date(),
			})
			.where(eq(billingCustomers.openCheckoutSessionId, openCheckoutSessionId))
			.returning({ id: billingCustomers.id });

		return row !== undefined;
	}

	private expectRow(row: BillingCustomerRow | undefined) {
		if (!row) {
			throw new Error("Billing customer write did not return a row");
		}

		return row;
	}
}

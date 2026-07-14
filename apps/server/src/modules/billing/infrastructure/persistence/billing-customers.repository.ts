import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "@wandit/db";
import { billingCustomers } from "@wandit/db/schema/billing";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type BillingCustomerRow = typeof billingCustomers.$inferSelect;

export type UpsertBillingCustomerInput = {
	provider: string;
	providerCustomerId: string;
	userId: string;
};

@Injectable()
export class BillingCustomersRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async upsertByUserId(
		input: UpsertBillingCustomerInput,
	): Promise<BillingCustomerRow> {
		const [row] = await this.db
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

	async findByUserId(userId: string): Promise<BillingCustomerRow | null> {
		const [row] = await this.db
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

	private expectRow(row: BillingCustomerRow | undefined) {
		if (!row) {
			throw new Error("Billing customer write did not return a row");
		}

		return row;
	}
}

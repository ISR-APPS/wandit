import { Inject, Injectable } from "@nestjs/common";
import { billingTopupReceipts } from "@wandit/db/schema/billing";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type BillingTopupReceiptRow = typeof billingTopupReceipts.$inferSelect;
export type InsertBillingTopupReceipt =
	typeof billingTopupReceipts.$inferInsert;

type BillingTopupReceiptsClient = Pick<Database, "insert">;

@Injectable()
export class BillingTopupReceiptsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** Idempotent on sessionId — the same spine as the `topup:{sessionId}` ledger key. */
	async insertIfAbsent(
		input: InsertBillingTopupReceipt,
		client: BillingTopupReceiptsClient = this.db,
	): Promise<BillingTopupReceiptRow | null> {
		const [row] = await client
			.insert(billingTopupReceipts)
			.values(input)
			.onConflictDoNothing({ target: billingTopupReceipts.sessionId })
			.returning();

		return row ?? null;
	}
}

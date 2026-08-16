import { Inject, Injectable } from "@nestjs/common";
import { eq } from "@wandit/db";
import { subscriptionStateEvents } from "@wandit/db/schema/billing";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type SubscriptionStateEventRow =
	typeof subscriptionStateEvents.$inferSelect;
export type InsertSubscriptionStateEvent =
	typeof subscriptionStateEvents.$inferInsert;

type SubscriptionStateEventsClient = Pick<Database, "insert" | "select">;

@Injectable()
export class SubscriptionStateEventsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async tryInsert(
		input: InsertSubscriptionStateEvent,
		client: SubscriptionStateEventsClient = this.db,
	): Promise<boolean> {
		const [inserted] = await client
			.insert(subscriptionStateEvents)
			.values(input)
			.onConflictDoNothing({
				target: subscriptionStateEvents.stripeEventId,
			})
			.returning({ id: subscriptionStateEvents.id });

		return inserted !== undefined;
	}

	async findByStripeEventId(
		stripeEventId: string,
		client: SubscriptionStateEventsClient = this.db,
	): Promise<SubscriptionStateEventRow | null> {
		const [row] = await client
			.select()
			.from(subscriptionStateEvents)
			.where(eq(subscriptionStateEvents.stripeEventId, stripeEventId))
			.limit(1);

		return row ?? null;
	}
}

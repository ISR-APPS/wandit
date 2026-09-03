import { Inject, Injectable } from "@nestjs/common";
import { productEvents } from "@wandit/db/schema/product-events";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type InsertProductEvent = Pick<
	typeof productEvents.$inferInsert,
	"idempotencyKey" | "kind" | "properties" | "surface" | "userId"
>;

@Injectable()
export class ProductEventsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async insert(input: InsertProductEvent): Promise<boolean> {
		const [inserted] = await this.db
			.insert(productEvents)
			.values(input)
			.onConflictDoNothing({ target: productEvents.idempotencyKey })
			.returning({ id: productEvents.id });

		return inserted !== undefined;
	}
}

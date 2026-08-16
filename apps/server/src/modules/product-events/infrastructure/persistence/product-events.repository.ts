import { Inject, Injectable } from "@nestjs/common";
import { productEvents } from "@wandit/db/schema/product-events";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type InsertProductEvent = Pick<
	typeof productEvents.$inferInsert,
	"idempotencyKey" | "kind" | "surface" | "userId"
>;

@Injectable()
export class ProductEventsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async insert(input: InsertProductEvent): Promise<void> {
		await this.db
			.insert(productEvents)
			.values(input)
			.onConflictDoNothing({ target: productEvents.idempotencyKey });
	}
}

import { Inject, Injectable } from "@nestjs/common";
import { userAttributions } from "@wandit/db/schema/user-attributions";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type UserAttributionRow = typeof userAttributions.$inferSelect;
type UserAttributionInsertRow = typeof userAttributions.$inferInsert;
export type InsertUserAttribution = Omit<UserAttributionInsertRow, "device"> & {
	device: UserAttributionRow["device"];
};

@Injectable()
export class UserAttributionRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async insertFirstWins(
		input: InsertUserAttribution,
	): Promise<UserAttributionRow | null> {
		const [row] = await this.db
			.insert(userAttributions)
			.values(input)
			.onConflictDoNothing({ target: userAttributions.userId })
			.returning();

		return row ?? null;
	}
}

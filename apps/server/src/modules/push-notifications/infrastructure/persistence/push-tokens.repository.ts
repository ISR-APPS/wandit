import { Inject, Injectable } from "@nestjs/common";
import type { PushTokenPlatform } from "@wandit/contracts";
import { and, eq } from "@wandit/db";
import { pushTokens } from "@wandit/db/schema/push-tokens";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

@Injectable()
export class PushTokensRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async register(
		userId: string,
		input: { platform: PushTokenPlatform; token: string },
	): Promise<void> {
		const updatedAt = new Date();

		await this.db
			.insert(pushTokens)
			.values({
				platform: input.platform,
				token: input.token,
				userId,
			})
			// A push token identifies an installation, not an account. Signing into
			// another account on the same installation transfers its existing row.
			.onConflictDoUpdate({
				set: {
					platform: input.platform,
					updatedAt,
					userId,
				},
				target: pushTokens.token,
			});
	}

	async unregister(userId: string, token: string): Promise<void> {
		await this.db
			.delete(pushTokens)
			.where(and(eq(pushTokens.token, token), eq(pushTokens.userId, userId)));
	}
}

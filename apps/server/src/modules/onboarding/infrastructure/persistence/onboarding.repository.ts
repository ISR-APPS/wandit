/**
 * Reads and writes the `user_onboarding` table through Drizzle.
 * Called by OnboardingService. `complete` upserts one row per user and stamps
 * `user.onboarding_completed_at`; `isPhoneUsedByOtherUser` backs the phone rule.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { CompleteOnboardingBody } from "@wandit/contracts";
import { and, eq, ne, sql } from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
import { userOnboarding } from "@wandit/db/schema/onboarding";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

type CompleteOnboardingInput = {
	answers: CompleteOnboardingBody["answers"];
	name: string;
	questionsVersion: string;
	userId: string;
};

@Injectable()
export class OnboardingRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	complete(input: CompleteOnboardingInput): Promise<Date> {
		const now = new Date();

		return this.db.transaction(async (tx) => {
			await tx
				.insert(userOnboarding)
				.values({
					answers: input.answers,
					completedAt: now,
					questionsVersion: input.questionsVersion,
					userId: input.userId,
				})
				.onConflictDoUpdate({
					set: {
						answers: input.answers,
						questionsVersion: input.questionsVersion,
						updatedAt: now,
					},
					target: userOnboarding.userId,
				});

			const [completedUser] = await tx
				.update(user)
				.set({
					name: input.name,
					onboardingCompletedAt: sql<Date>`coalesce(${user.onboardingCompletedAt}, ${now})`,
				})
				.where(eq(user.id, input.userId))
				.returning({ completedAt: user.onboardingCompletedAt });

			if (!completedUser?.completedAt) {
				throw new Error("Onboarding completion did not return a user row");
			}

			return completedUser.completedAt;
		});
	}

	/**
	 * True when the onboarding row of a different user holds this E.164 phone.
	 * The caller's own row never counts, so a re-onboarding keeps its number.
	 */
	async isPhoneUsedByOtherUser(
		phone: string,
		userId: string,
	): Promise<boolean> {
		const rows = await this.db
			.select({ userId: userOnboarding.userId })
			.from(userOnboarding)
			.where(
				and(
					eq(sql`${userOnboarding.answers} ->> 'phone'`, phone),
					ne(userOnboarding.userId, userId),
				),
			)
			.limit(1);

		return rows.length > 0;
	}
}

import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, sql } from "@wandit/db";
import { signupGrantOutbox } from "@wandit/db/schema/billing";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type SignupGrantOutboxRow = typeof signupGrantOutbox.$inferSelect;

@Injectable()
export class SignupGrantOutboxRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async create(input: {
		credits: number;
		settingsVersion: number;
		status: SignupGrantOutboxRow["status"];
		userId: string;
	}): Promise<SignupGrantOutboxRow> {
		const [inserted] = await this.db
			.insert(signupGrantOutbox)
			.values(input)
			.onConflictDoNothing({ target: signupGrantOutbox.userId })
			.returning();

		if (inserted) {
			return inserted;
		}

		const existing = await this.findByUserId(input.userId);

		if (!existing) {
			throw new Error(
				`Signup grant outbox row for ${input.userId} disappeared after conflict`,
			);
		}

		if (
			existing.credits !== input.credits ||
			existing.settingsVersion !== input.settingsVersion
		) {
			throw new Error(
				`Signup grant outbox replay conflict for user ${input.userId}`,
			);
		}

		return existing;
	}

	async findByUserId(userId: string): Promise<SignupGrantOutboxRow | null> {
		const [row] = await this.db
			.select()
			.from(signupGrantOutbox)
			.where(eq(signupGrantOutbox.userId, userId))
			.limit(1);

		return row ?? null;
	}

	listPending(input: {
		limit: number;
		userId?: string;
	}): Promise<SignupGrantOutboxRow[]> {
		return this.db
			.select()
			.from(signupGrantOutbox)
			.where(
				and(
					eq(signupGrantOutbox.status, "pending"),
					input.userId ? eq(signupGrantOutbox.userId, input.userId) : undefined,
				),
			)
			.orderBy(
				asc(signupGrantOutbox.attempts),
				asc(signupGrantOutbox.createdAt),
			)
			.limit(input.limit);
	}

	async markDone(userId: string): Promise<void> {
		await this.db
			.update(signupGrantOutbox)
			.set({
				attempts: sql`${signupGrantOutbox.attempts} + 1`,
				doneAt: new Date(),
				lastError: null,
				status: "done",
			})
			.where(
				and(
					eq(signupGrantOutbox.userId, userId),
					eq(signupGrantOutbox.status, "pending"),
				),
			);
	}

	async markFailed(userId: string, error: string): Promise<void> {
		await this.db
			.update(signupGrantOutbox)
			.set({
				attempts: sql`${signupGrantOutbox.attempts} + 1`,
				lastError: error,
			})
			.where(
				and(
					eq(signupGrantOutbox.userId, userId),
					eq(signupGrantOutbox.status, "pending"),
				),
			);
	}
}

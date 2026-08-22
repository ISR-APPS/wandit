import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, gt, isNull, sql } from "@wandit/db";
import { user } from "@wandit/db/schema/auth";
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

	async countSkipped(createdAfter?: Date): Promise<number> {
		const [row] = await this.db
			.select({ count: sql<number>`count(*)::int`.mapWith(Number) })
			.from(signupGrantOutbox)
			.where(
				and(
					eq(signupGrantOutbox.status, "skipped"),
					createdAfter
						? gt(signupGrantOutbox.createdAt, createdAfter)
						: undefined,
				),
			);

		return row?.count ?? 0;
	}

	/**
	 * Admin-driven backfill: `skipped` rows (signed up while the grant was
	 * off) become `pending` with the CURRENT grant size and settings version.
	 * Attempts are kept so a row's history stays readable.
	 */
	async requeueSkipped(input: {
		createdAfter?: Date;
		credits: number;
		limit: number;
		settingsVersion: number;
	}): Promise<number> {
		const candidates = this.db
			.select({ userId: signupGrantOutbox.userId })
			.from(signupGrantOutbox)
			.where(
				and(
					eq(signupGrantOutbox.status, "skipped"),
					input.createdAfter
						? gt(signupGrantOutbox.createdAt, input.createdAfter)
						: undefined,
				),
			)
			.orderBy(asc(signupGrantOutbox.createdAt))
			.limit(input.limit);
		const rows = await this.db
			.update(signupGrantOutbox)
			.set({
				credits: input.credits,
				lastError: null,
				settingsVersion: input.settingsVersion,
				status: "pending",
			})
			.where(
				and(
					eq(signupGrantOutbox.status, "skipped"),
					sql`${signupGrantOutbox.userId} in (${candidates})`,
				),
			)
			.returning({ userId: signupGrantOutbox.userId });

		return rows.length;
	}

	/**
	 * Self-healing: users created after the watermark whose signup callback
	 * never produced an outbox row (Better Auth runs it outside the insert
	 * transaction and the server swallows its errors).
	 */
	async findUsersWithoutOutboxRow(input: {
		createdAfter: Date;
		limit: number;
	}): Promise<string[]> {
		const rows = await this.db
			.select({ userId: user.id })
			.from(user)
			.leftJoin(signupGrantOutbox, eq(signupGrantOutbox.userId, user.id))
			.where(
				and(
					isNull(signupGrantOutbox.userId),
					gt(user.createdAt, input.createdAfter),
				),
			)
			.orderBy(asc(user.createdAt))
			.limit(input.limit);

		return rows.map((row) => row.userId);
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

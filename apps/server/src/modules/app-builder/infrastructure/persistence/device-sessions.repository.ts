/**
 * Repository for `device_sessions`, one Appetize device session of the V2
 * mobile preview (WANDIT-196). `DeviceSessionsService` inserts and ends
 * rows and sums the used minutes; the `device-minutes` runtime lists and
 * bills them. Every write guards on a null column, so a repeat is a no-op.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { DevicePlatform } from "@wandit/contracts";
import { and, asc, eq, gte, isNull, lt, or, type SQL, sql } from "@wandit/db";
import { deviceSessions } from "@wandit/db/schema/device-sessions";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type CreditOwner,
	creditOwnerLockValue,
} from "../../../credits/domain/credit-owner";
import { DEVICE_SESSION_TIME_LIMIT_SECONDS } from "../../domain/device-minutes";

/** One `device_sessions` row as Drizzle returns it. */
export type DeviceSessionRow = typeof deviceSessions.$inferSelect;

/** Fields of a new open row. All come from the start route. */
export type InsertDeviceSessionInput = {
	/** The id the service locked the user with before the insert. */
	id: string;
	/** The actor: end and the per-person lock read this column. */
	userId: string;
	/** Org workspace of the project, or null for a personal project. */
	organizationId: string | null;
	/** Owner of another user's personal pool that pays the minutes; else null. */
	payerUserId: string | null;
	projectId: string;
	platform: DevicePlatform;
};

/** The client of one minutes sum: the pool, or the transaction of a locked insert. */
type MinutesDbClient = Pick<Database, "select">;

/** Drizzle adapter around `device_sessions`. */
@Injectable()
export class DeviceSessionsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/**
	 * Inserts an open row when `payer` used fewer than `allowanceMinutes` since
	 * `since`. Answers null, with no insert, when no minute is left.
	 * `ended_at`, `minutes`, and `billed_at` stay null.
	 */
	async insertOpenWithinAllowance(
		input: InsertDeviceSessionInput,
		payer: CreditOwner,
		allowanceMinutes: number,
		since: Date,
	): Promise<DeviceSessionRow | null> {
		return this.db.transaction(async (tx) => {
			// The allowance is per payer: two members of one pool must not both
			// pass the count before either row exists.
			await tx.execute(
				sql`select pg_advisory_xact_lock(hashtext(${`device-minutes:${creditOwnerLockValue(payer)}`}))`,
			);
			// clock_timestamp(), not now(): a row committed just before this lock
			// then counts its first minute.
			const usedMinutes = await this.sumMinutes(
				tx,
				payer,
				since,
				sql`clock_timestamp()`,
			);
			if (usedMinutes >= allowanceMinutes) {
				return null;
			}
			const [row] = await tx.insert(deviceSessions).values(input).returning();
			if (!row) {
				throw new Error(
					`device_sessions insert returned no row for ${input.id}`,
				);
			}
			return row;
		});
	}

	/** The row of `id` when `userId` started it for `projectId`, else null. */
	async findStartedBy(
		id: string,
		userId: string,
		projectId: string,
	): Promise<DeviceSessionRow | null> {
		const rows = await this.db
			.select()
			.from(deviceSessions)
			.where(
				and(
					eq(deviceSessions.id, id),
					eq(deviceSessions.userId, userId),
					eq(deviceSessions.projectId, projectId),
				),
			)
			.limit(1);
		return rows.at(0) ?? null;
	}

	/**
	 * Ends a row and stores its Appetize token. A second end keeps the first
	 * end time, and a token only fills a null token. A token that another row
	 * holds fails the unique index.
	 */
	async end(
		id: string,
		appetizeSessionToken: string | null,
		endedAt: Date,
	): Promise<void> {
		await this.db
			.update(deviceSessions)
			.set({
				appetizeSessionToken: sql`coalesce(${deviceSessions.appetizeSessionToken}, ${appetizeSessionToken})`,
				endedAt: sql`coalesce(${deviceSessions.endedAt}, ${endedAt})`,
			})
			.where(eq(deviceSessions.id, id));
	}

	/**
	 * Minutes of one payer since `since`. A billed row counts its minutes. A
	 * row not billed yet counts its elapsed minutes, rounded up and capped at
	 * the time limit, so back-to-back sessions cannot pass the allowance.
	 */
	async usedMinutesSince(
		payer: CreditOwner,
		since: Date,
		now: Date,
	): Promise<number> {
		return this.sumMinutes(this.db, payer, since, now);
	}

	/** The sum of `usedMinutesSince`. `now` is a time, or a SQL clock inside a lock. */
	private async sumMinutes(
		client: MinutesDbClient,
		payer: CreditOwner,
		since: Date,
		now: Date | SQL,
	): Promise<number> {
		const [row] = await client
			.select({
				minutes: sql<number>`coalesce(sum(coalesce(
					${deviceSessions.minutes},
					ceil(extract(epoch from (least(
						coalesce(${deviceSessions.endedAt}, ${now}),
						${deviceSessions.startedAt} + make_interval(secs => ${DEVICE_SESSION_TIME_LIMIT_SECONDS})
					) - ${deviceSessions.startedAt})) / 60)
				)), 0)::int`,
			})
			.from(deviceSessions)
			.where(
				and(
					gte(deviceSessions.startedAt, since),
					// The org pays for org rows. A user pays for the own personal
					// rows and for the rows of members that name the user as payer.
					payer.type === "user"
						? and(
								isNull(deviceSessions.organizationId),
								or(
									and(
										eq(deviceSessions.userId, payer.userId),
										isNull(deviceSessions.payerUserId),
									),
									eq(deviceSessions.payerUserId, payer.userId),
								),
							)
						: eq(deviceSessions.organizationId, payer.organizationId),
				),
			);
		return row?.minutes ?? 0;
	}

	/**
	 * Rows the minutes task must bill, oldest first: not billed, and ended or
	 * started before `staleBefore` (the browser never ended them).
	 */
	async listUnbilled(
		staleBefore: Date,
		limit: number,
	): Promise<DeviceSessionRow[]> {
		return this.db
			.select()
			.from(deviceSessions)
			.where(
				and(
					isNull(deviceSessions.billedAt),
					or(
						sql`${deviceSessions.endedAt} IS NOT NULL`,
						lt(deviceSessions.startedAt, staleBefore),
					),
				),
			)
			.orderBy(asc(deviceSessions.startedAt))
			.limit(limit);
	}

	/**
	 * Writes the billed minutes once. Returns false when the row was billed
	 * already: a second run of the task changes nothing.
	 */
	async markBilled(
		id: string,
		minutes: number,
		endedAt: Date,
	): Promise<boolean> {
		const rows = await this.db
			.update(deviceSessions)
			.set({
				billedAt: sql`now()`,
				endedAt: sql`coalesce(${deviceSessions.endedAt}, ${endedAt})`,
				minutes,
			})
			.where(and(eq(deviceSessions.id, id), isNull(deviceSessions.billedAt)))
			.returning({ id: deviceSessions.id });
		return rows.length > 0;
	}
}

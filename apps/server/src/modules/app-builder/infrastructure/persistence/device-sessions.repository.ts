/**
 * Repository for `device_sessions`, one Appetize device session of the V2
 * mobile preview (WANDIT-196). `DeviceSessionsService` inserts and ends
 * rows and sums the used minutes; the `device-minutes` runtime lists and
 * bills them. Every write guards on a null column, so a repeat is a no-op.
 */
import { Inject, Injectable } from "@nestjs/common";
import type { DevicePlatform } from "@wandit/contracts";
import { and, asc, eq, gte, isNull, lt, or, sql } from "@wandit/db";
import { deviceSessions } from "@wandit/db/schema/device-sessions";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import { DEVICE_SESSION_TIME_LIMIT_SECONDS } from "../../domain/device-minutes";

/** One `device_sessions` row as Drizzle returns it. */
export type DeviceSessionRow = typeof deviceSessions.$inferSelect;

/** Fields of a new open row. All come from the start route. */
export type InsertDeviceSessionInput = {
	/** The id the service locked the user with before the insert. */
	id: string;
	userId: string;
	/** Org workspace of the project, or null for a personal project. */
	organizationId: string | null;
	projectId: string;
	platform: DevicePlatform;
};

/** Who pays the minutes: the org of an org workspace, else the user alone. */
export type DeviceMinutesPayer = {
	userId: string;
	organizationId: string | null;
};

/** Drizzle adapter around `device_sessions`. */
@Injectable()
export class DeviceSessionsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	/** Inserts an open row: `ended_at`, `minutes`, and `billed_at` stay null. */
	async insertOpen(input: InsertDeviceSessionInput): Promise<DeviceSessionRow> {
		const [row] = await this.db
			.insert(deviceSessions)
			.values(input)
			.returning();
		if (!row) {
			throw new Error(`device_sessions insert returned no row for ${input.id}`);
		}
		return row;
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
		payer: DeviceMinutesPayer,
		since: Date,
		now: Date,
	): Promise<number> {
		const [row] = await this.db
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
					// The org pays for org rows; a user pays only for personal rows.
					payer.organizationId === null
						? and(
								eq(deviceSessions.userId, payer.userId),
								isNull(deviceSessions.organizationId),
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

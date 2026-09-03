/**
 * Persistence for the per-project Google Sheet pointer and sync owner,
 * accessible-project and Google-account lookups, the auto-sync candidate
 * query, the database clock, and the per-project session advisory lock.
 */

import { Inject, Injectable } from "@nestjs/common";
import {
	and,
	createDedicatedClient,
	desc,
	eq,
	inArray,
	isNull,
	sql,
} from "@wandit/db";
import { account } from "@wandit/db/schema/auth";
import { leadSheetSyncs } from "@wandit/db/schema/lead-sheet-syncs";
import { leads } from "@wandit/db/schema/leads";
import { member } from "@wandit/db/schema/organizations";
import { projects } from "@wandit/db/schema/projects";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type ProjectScope,
	projectScopePredicate,
} from "../../../projects/domain/project-scope";

export type LeadSheetSyncRow = {
	lastSyncedAt: Date | null;
	spreadsheetId: string;
	spreadsheetUrl: string;
	syncedByUserId: string | null;
	syncedLeadCount: number;
};

export type LeadSheetAutoSyncCandidate = {
	lastSyncedAt: Date | null;
	organizationId: string | null;
	projectId: string;
	projectName: string;
	syncedByUserId: string;
	syncedLeadCount: number;
};

export type GoogleAccountRow = {
	accessTokenExpiresAt: Date | null;
	refreshToken: string | null;
	scope: string | null;
};

const SYNC_COLUMNS = {
	lastSyncedAt: leadSheetSyncs.lastSyncedAt,
	spreadsheetId: leadSheetSyncs.spreadsheetId,
	spreadsheetUrl: leadSheetSyncs.spreadsheetUrl,
	syncedByUserId: leadSheetSyncs.syncedByUserId,
	syncedLeadCount: leadSheetSyncs.syncedLeadCount,
} as const;

export class LeadSheetSyncBusyError extends Error {
	constructor() {
		super("A lead sheet sync is already running");
		this.name = "LeadSheetSyncBusyError";
	}
}

export class LeadSheetSyncLockLostError extends Error {
	constructor(cause: Error) {
		super("The lead sheet sync lock connection was lost", { cause });
		this.name = "LeadSheetSyncLockLostError";
	}
}

@Injectable()
export class LeadSheetSyncsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async findAccessibleProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<{ id: string; name: string } | null> {
		const [row] = await this.db
			.select({ id: projects.id, name: projects.name })
			.from(projects)
			.where(
				and(
					eq(projects.id, projectId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		return row ?? null;
	}

	/** The user's Google identity — newest first if they somehow linked two. */
	async findGoogleAccount(userId: string): Promise<GoogleAccountRow | null> {
		const [row] = await this.db
			.select({
				accessTokenExpiresAt: account.accessTokenExpiresAt,
				refreshToken: account.refreshToken,
				scope: account.scope,
			})
			.from(account)
			.where(and(eq(account.userId, userId), eq(account.providerId, "google")))
			.orderBy(desc(account.updatedAt))
			.limit(1);

		return row ?? null;
	}

	/** Newest linked Google identity per requested user, fetched in one query. */
	async findGoogleAccounts(
		userIds: string[],
	): Promise<Map<string, GoogleAccountRow>> {
		if (userIds.length === 0) {
			return new Map();
		}

		const rows = await this.db
			.select({
				accessTokenExpiresAt: account.accessTokenExpiresAt,
				refreshToken: account.refreshToken,
				scope: account.scope,
				userId: account.userId,
			})
			.from(account)
			.where(
				and(
					inArray(account.userId, [...new Set(userIds)]),
					eq(account.providerId, "google"),
				),
			)
			.orderBy(desc(account.updatedAt));
		const accounts = new Map<string, GoogleAccountRow>();

		for (const { userId, ...row } of rows) {
			if (!accounts.has(userId)) {
				accounts.set(userId, row);
			}
		}

		return accounts;
	}

	async findByProject(projectId: string): Promise<LeadSheetSyncRow | null> {
		const [row] = await this.db
			.select(SYNC_COLUMNS)
			.from(leadSheetSyncs)
			.where(eq(leadSheetSyncs.projectId, projectId))
			.limit(1);

		return row ?? null;
	}

	/**
	 * The database clock, so both lastSyncedAt and lead timestamps use the same
	 * clock. Epoch float8 rather than `now()` itself: the drizzle node-postgres
	 * driver hands timestamps back as raw strings.
	 */
	async now(): Promise<Date> {
		const result = await this.db.execute<{ epochMs: number | string }>(
			sql`select extract(epoch from now()) * 1000 as "epochMs"`,
		);
		const epochMs = Number(result.rows[0]?.epochMs);

		if (!Number.isFinite(epochMs)) {
			throw new Error("Database clock query did not return a timestamp");
		}

		return new Date(Math.round(epochMs));
	}

	/**
	 * Projects whose attached sheet may be stale. The count mismatch also
	 * catches hard deletes even though normal lead removal only archives rows.
	 */
	async listDueForAutoSync(): Promise<LeadSheetAutoSyncCandidate[]> {
		const rows = await this.db
			.select({
				lastSyncedAt: leadSheetSyncs.lastSyncedAt,
				organizationId: projects.organizationId,
				projectId: projects.id,
				projectName: projects.name,
				syncedByUserId: leadSheetSyncs.syncedByUserId,
				syncedLeadCount: leadSheetSyncs.syncedLeadCount,
			})
			.from(leadSheetSyncs)
			.innerJoin(projects, eq(projects.id, leadSheetSyncs.projectId))
			.where(
				and(
					isNull(projects.deletedAt),
					sql`${leadSheetSyncs.syncedByUserId} is not null`,
					// Membership is normally proven by the request guard; the sweep has
					// no request, so it proves membership here.
					syncActorAuthorizationPredicate(
						projects,
						leadSheetSyncs.syncedByUserId,
					),
					// Both lead updated_at and last_synced_at use the DB clock. The
					// margin covers a lead transaction that commits after the page read.
					sql`(
						${leadSheetSyncs.lastSyncedAt} is null
						or ${leadSheetSyncs.syncedLeadCount} <> (
							select count(*) from ${leads}
							where ${leads.projectId} = ${projects.id}
						)
						or exists (
							select 1 from ${leads}
							where ${leads.projectId} = ${projects.id}
								and ${leads.updatedAt} > ${leadSheetSyncs.lastSyncedAt} - interval '10 seconds'
						)
					)`,
				),
			)
			.orderBy(sql`${leadSheetSyncs.lastSyncedAt} asc nulls first`);

		return rows.flatMap((row) =>
			row.syncedByUserId === null
				? []
				: [{ ...row, syncedByUserId: row.syncedByUserId }],
		);
	}

	async isSyncActorAuthorized(
		projectId: string,
		userId: string,
	): Promise<boolean> {
		const [row] = await this.db
			.select({ id: projects.id })
			.from(projects)
			.where(
				and(
					eq(projects.id, projectId),
					isNull(projects.deletedAt),
					syncActorAuthorizationPredicate(projects, userId),
				),
			)
			.limit(1);

		return row !== undefined;
	}

	/**
	 * Point the project at a (new) spreadsheet. Upsert on the projectId unique
	 * index: replacing a Drive-deleted sheet overwrites the stale pointer.
	 */
	async upsertSpreadsheet(
		projectId: string,
		spreadsheet: { spreadsheetId: string; spreadsheetUrl: string },
		syncedByUserId: string,
	): Promise<LeadSheetSyncRow> {
		const [row] = await this.db
			.insert(leadSheetSyncs)
			.values({ projectId, ...spreadsheet, syncedByUserId })
			.onConflictDoUpdate({
				set: { ...spreadsheet, syncedByUserId, updatedAt: new Date() },
				target: leadSheetSyncs.projectId,
			})
			.returning(SYNC_COLUMNS);

		if (!row) {
			throw new Error("Lead sheet sync upsert did not return a row");
		}

		return row;
	}

	async recordSyncResult(
		projectId: string,
		result: {
			lastSyncedAt: Date;
			syncedByUserId: string;
			syncedLeadCount: number;
		},
	): Promise<LeadSheetSyncRow | null> {
		const [row] = await this.db
			.update(leadSheetSyncs)
			.set(result)
			.where(eq(leadSheetSyncs.projectId, projectId))
			.returning(SYNC_COLUMNS);

		return row ?? null;
	}

	/**
	 * The staged rewrite swaps sheet tabs, so overlapping rewrites for one
	 * spreadsheet could break each other's commit. No transaction or pooled
	 * client is held across Google I/O: each in-flight sync uses one short-lived
	 * dedicated connection for its session advisory lock. The lock disappears
	 * with the connection if the process dies.
	 */
	async withProjectSyncLock<T>(
		projectId: string,
		mode: "wait" | "try",
		fn: () => Promise<T>,
	): Promise<T> {
		const client = createDedicatedClient();
		let lockLost: Error | undefined;
		// pg emits `error` when an idle session drops; without a listener, the
		// unhandled Error event kills the process while Google I/O is in flight.
		client.on("error", (error) => {
			lockLost = error;
		});
		await client.connect();

		try {
			if (mode === "wait") {
				await client.query("set lock_timeout = '60s'");

				try {
					await client.query(
						"select pg_advisory_lock(hashtext('lead-sheet-sync'), hashtext($1))",
						[projectId],
					);
				} catch (error) {
					if (isPostgresLockTimeout(error)) {
						throw new LeadSheetSyncBusyError();
					}

					throw error;
				}
			} else {
				const lock = await client.query<{ acquired: boolean }>(
					"select pg_try_advisory_lock(hashtext('lead-sheet-sync'), hashtext($1)) as acquired",
					[projectId],
				);

				if (lock.rows[0]?.acquired !== true) {
					throw new LeadSheetSyncBusyError();
				}
			}

			const result = await fn();

			if (lockLost) {
				throw new LeadSheetSyncLockLostError(lockLost);
			}

			return result;
		} finally {
			// Closing the connection releases session locks even if explicit unlock fails.
			try {
				await client.query("select pg_advisory_unlock_all()");
			} catch {}
			await client.end().catch(() => {});
		}
	}
}

function syncActorAuthorizationPredicate(
	projectTable: typeof projects,
	syncActorUserId: typeof leadSheetSyncs.syncedByUserId | string,
) {
	return sql`(
		(${projectTable.organizationId} is null and ${syncActorUserId} = ${projectTable.userId})
		or exists (
			select 1 from ${member}
			where ${member.organizationId} = ${projectTable.organizationId}
				and ${member.userId} = ${syncActorUserId}
		)
	)`;
}

// Postgres lock_not_available; node-postgres exposes the SQLSTATE on `.code`.
function isPostgresLockTimeout(error: unknown): boolean {
	let current = error;

	for (let depth = 0; depth < 5 && current; depth += 1) {
		if (
			typeof current === "object" &&
			"code" in current &&
			(current as { code?: unknown }).code === "55P03"
		) {
			return true;
		}

		current =
			typeof current === "object" && "cause" in current
				? (current as { cause?: unknown }).cause
				: undefined;
	}

	return false;
}

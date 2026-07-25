/**
 * Persistence for the per-project Google Sheet pointer, plus the two lookups
 * the sync needs around it: the owned project (ownership proven in SQL, a
 * miss reads as 404 — docs/api-security.md) and the user's Google account
 * row (whose stored scope decides whether Sheets sync is connected).
 */
import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, isNull } from "@wandit/db";
import { account } from "@wandit/db/schema/auth";
import { leadSheetSyncs } from "@wandit/db/schema/lead-sheet-syncs";
import { projects } from "@wandit/db/schema/projects";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type LeadSheetSyncRow = {
	lastSyncedAt: Date | null;
	spreadsheetId: string;
	spreadsheetUrl: string;
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
	syncedLeadCount: leadSheetSyncs.syncedLeadCount,
} as const;

@Injectable()
export class LeadSheetSyncsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	async findOwnedProject(
		userId: string,
		projectId: string,
	): Promise<{ id: string; name: string } | null> {
		const [row] = await this.db
			.select({ id: projects.id, name: projects.name })
			.from(projects)
			.where(
				and(
					eq(projects.id, projectId),
					eq(projects.userId, userId),
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

	async findByProject(projectId: string): Promise<LeadSheetSyncRow | null> {
		const [row] = await this.db
			.select(SYNC_COLUMNS)
			.from(leadSheetSyncs)
			.where(eq(leadSheetSyncs.projectId, projectId))
			.limit(1);

		return row ?? null;
	}

	/**
	 * Point the project at a (new) spreadsheet. Upsert on the projectId unique
	 * index: replacing a Drive-deleted sheet overwrites the stale pointer.
	 */
	async upsertSpreadsheet(
		projectId: string,
		spreadsheet: { spreadsheetId: string; spreadsheetUrl: string },
	): Promise<LeadSheetSyncRow> {
		const [row] = await this.db
			.insert(leadSheetSyncs)
			.values({ projectId, ...spreadsheet })
			.onConflictDoUpdate({
				set: { ...spreadsheet, updatedAt: new Date() },
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
		syncedLeadCount: number,
	): Promise<LeadSheetSyncRow | null> {
		const [row] = await this.db
			.update(leadSheetSyncs)
			.set({ lastSyncedAt: new Date(), syncedLeadCount })
			.where(eq(leadSheetSyncs.projectId, projectId))
			.returning(SYNC_COLUMNS);

		return row ?? null;
	}
}

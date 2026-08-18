/**
 * Google Sheets sync for a project's leads.
 *
 * The merchant granted the narrow drive.file scope via linkSocial re-consent;
 * we CREATE the spreadsheet in their Drive (app-created files are writable
 * under drive.file, so no picker) and every sync is a full rewrite, so status
 * changes made in the Leads tab flow through. better-auth owns the tokens:
 * getAccessToken refreshes silently off the stored refresh token.
 */

import {
	BadGatewayException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type { Auth } from "@wandit/auth";
import {
	GOOGLE_SHEETS_SCOPE,
	type LeadSheetSyncState,
} from "@wandit/contracts";
import { AUTH_INSTANCE } from "../../../auth";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	LEAD_SHEET_HEADER,
	LEAD_SHEET_ORDER_HEADER,
	LeadSheetGrid,
} from "../../domain/lead-sheet-rows";
import {
	GoogleSheetsApiError,
	GoogleSheetsClient,
	type StagedSheetRewrite,
} from "../../infrastructure/google/google-sheets.client";
import { toLeadDto } from "../../infrastructure/mappers/lead.mapper";
import {
	type LeadSheetSyncRow,
	LeadSheetSyncsRepository,
} from "../../infrastructure/persistence/lead-sheet-syncs.repository";
import { LeadsRepository } from "../../infrastructure/persistence/leads.repository";

const SYNC_PAGE_SIZE = 1_000;
// Google recommends keeping Sheets API requests around 2 MB. Leave room for
// the batchUpdate wrapper while avoiding an arbitrary row cap that burns the
// per-user write quota on large exports.
const MAX_WRITE_PAYLOAD_BYTES = 1_500_000;

@Injectable()
export class LeadSheetSyncService {
	private readonly logger = new Logger(LeadSheetSyncService.name);

	constructor(
		@Inject(AUTH_INSTANCE) private readonly auth: Auth,
		@Inject(GoogleSheetsClient)
		private readonly sheetsClient: GoogleSheetsClient,
		@Inject(LeadSheetSyncsRepository)
		private readonly syncsRepository: LeadSheetSyncsRepository,
		@Inject(LeadsRepository)
		private readonly leadsRepository: LeadsRepository,
	) {}

	async getState(
		scope: ProjectScope,
		projectId: string,
	): Promise<LeadSheetSyncState> {
		await this.getAccessibleProject(scope, projectId);

		// The Google Sheets identity is the ACTING member's, never the org's.
		const [account, sync] = await Promise.all([
			this.syncsRepository.findGoogleAccount(scope.userId),
			this.syncsRepository.findByProject(projectId),
		]);

		return { connected: isSheetsConnected(account), sheet: toSheetDto(sync) };
	}

	async syncNow(
		scope: ProjectScope,
		projectId: string,
	): Promise<LeadSheetSyncState> {
		const project = await this.getAccessibleProject(scope, projectId);

		const account = await this.syncsRepository.findGoogleAccount(scope.userId);
		if (!isSheetsConnected(account)) {
			throw new ConflictException(
				"Google Sheets access is not connected for this account",
			);
		}

		const accessToken = await this.mintAccessToken(scope.userId);
		const title = `Wandit Leads — ${project.name}`;
		let syncedLeadCount: number;

		try {
			let sync = await this.syncsRepository.findByProject(projectId);

			if (!sync) {
				sync = await this.createSpreadsheet(accessToken, projectId, title);
			}

			try {
				syncedLeadCount = await this.rewriteSpreadsheet(
					accessToken,
					sync.spreadsheetId,
					scope,
					projectId,
				);
			} catch (error) {
				// 404 = the merchant deleted our spreadsheet in Drive. The pointer
				// is stale, not the sync — recreate once and stage the full rewrite
				// in the fresh spreadsheet.
				if (!(error instanceof GoogleSheetsApiError) || error.status !== 404) {
					throw error;
				}

				sync = await this.createSpreadsheet(accessToken, projectId, title);
				syncedLeadCount = await this.rewriteSpreadsheet(
					accessToken,
					sync.spreadsheetId,
					scope,
					projectId,
				);
			}
		} catch (error) {
			throw this.mapGoogleError(error, projectId);
		}

		const updated = await this.syncsRepository.recordSyncResult(
			projectId,
			syncedLeadCount,
		);

		if (!updated) {
			throw new Error("Lead sheet sync row vanished while recording result");
		}

		return { connected: true, sheet: toSheetDto(updated) };
	}

	private async rewriteSpreadsheet(
		accessToken: string,
		spreadsheetId: string,
		scope: ProjectScope,
		projectId: string,
	): Promise<number> {
		let rewrite: StagedSheetRewrite | undefined;
		let commitStarted = false;
		// One grid per rewrite: it learns the dynamic extras columns while the
		// lead pages stream through, so the header can only be written last.
		const grid = new LeadSheetGrid();

		try {
			rewrite = await this.sheetsClient.beginStagedRewrite(
				accessToken,
				spreadsheetId,
				LEAD_SHEET_HEADER.length + LEAD_SHEET_ORDER_HEADER.length,
			);

			let cursor: string | undefined;
			let leadCount = 0;
			let pendingRows: string[][] = [];
			let pendingPayloadBytes = 0;
			const seenCursors = new Set<string>();
			do {
				const page = await this.leadsRepository.listForProjectSync(
					scope,
					projectId,
					{ cursor, pageSize: SYNC_PAGE_SIZE },
				);
				const rows = grid.addRows(page.rows.map(toLeadDto));

				for (const row of rows) {
					const rowPayloadBytes = stagedRowPayloadBytes(row);
					if (
						pendingRows.length > 0 &&
						pendingPayloadBytes + rowPayloadBytes > MAX_WRITE_PAYLOAD_BYTES
					) {
						await this.sheetsClient.writeStagedValues(
							accessToken,
							spreadsheetId,
							rewrite,
							leadCount + 1,
							pendingRows,
						);
						leadCount += pendingRows.length;
						pendingRows = [];
						pendingPayloadBytes = 0;
					}

					pendingRows.push(row);
					pendingPayloadBytes += rowPayloadBytes;
				}

				const nextCursor = page.nextCursor ?? undefined;
				if (nextCursor) {
					if (seenCursors.has(nextCursor)) {
						throw new Error("The leads repository returned a repeated cursor");
					}

					seenCursors.add(nextCursor);
				}
				cursor = nextCursor;
			} while (cursor);

			if (pendingRows.length > 0) {
				await this.sheetsClient.writeStagedValues(
					accessToken,
					spreadsheetId,
					rewrite,
					leadCount + 1,
					pendingRows,
				);
				leadCount += pendingRows.length;
			}

			// Row 0 was left empty on purpose: only now, after every lead has
			// streamed through the grid, is the set of dynamic columns complete.
			await this.sheetsClient.writeStagedValues(
				accessToken,
				spreadsheetId,
				rewrite,
				0,
				[grid.header()],
			);

			commitStarted = true;
			await this.sheetsClient.commitStagedRewrite(
				accessToken,
				spreadsheetId,
				rewrite,
			);

			return leadCount;
		} catch (error) {
			// Do not clean up once the atomic commit has started: a lost HTTP
			// response is ambiguous and the staging id may already be the live tab.
			if (rewrite && !commitStarted) {
				await this.discardStaging(accessToken, spreadsheetId, rewrite);
			}

			throw error;
		}
	}

	private async discardStaging(
		accessToken: string,
		spreadsheetId: string,
		rewrite: StagedSheetRewrite,
	): Promise<void> {
		try {
			await this.sheetsClient.discardStagedRewrite(
				accessToken,
				spreadsheetId,
				rewrite,
			);
		} catch (cleanupError) {
			this.logger.warn(
				`Could not clean up failed Sheets staging tab: ${String(cleanupError)}`,
			);
		}
	}

	private async getAccessibleProject(
		scope: ProjectScope,
		projectId: string,
	): Promise<{ id: string; name: string }> {
		const project = await this.syncsRepository.findAccessibleProject(
			scope,
			projectId,
		);

		// Missing and not-owned both become 404 — never reveal which.
		if (!project) {
			throw new NotFoundException("Project not found");
		}

		return project;
	}

	private async mintAccessToken(userId: string): Promise<string> {
		try {
			const tokens = await this.auth.api.getAccessToken({
				body: { providerId: "google", userId },
			});

			if (!tokens.accessToken) {
				throw new Error("better-auth returned no access token");
			}

			return tokens.accessToken;
		} catch (error) {
			this.logger.warn(`Google access token mint failed: ${String(error)}`);
			throw new ConflictException(
				"Could not get Google access — reconnect Google Sheets and try again",
			);
		}
	}

	private createSpreadsheet(
		accessToken: string,
		projectId: string,
		title: string,
	): Promise<LeadSheetSyncRow> {
		return this.sheetsClient
			.createSpreadsheet(accessToken, title)
			.then((created) =>
				this.syncsRepository.upsertSpreadsheet(projectId, created),
			);
	}

	private mapGoogleError(error: unknown, projectId: string): Error {
		if (error instanceof GoogleSheetsApiError) {
			this.logger.warn(
				`Sheets sync failed for project ${projectId}: ${error.status} ${error.message}`,
			);

			// 401/403 are user-actionable (revoked grant, or the Sheets API is
			// not enabled on the OAuth project) — surface Google's own message.
			if (error.status === 401 || error.status === 403) {
				return new ConflictException(
					`Google refused the sync: ${error.message}`,
				);
			}

			return new BadGatewayException("Google Sheets sync failed");
		}

		this.logger.error(`Sheets sync failed for project ${projectId}`, error);
		return new BadGatewayException("Google Sheets sync failed");
	}
}

function stagedRowPayloadBytes(row: string[]): number {
	const payload = {
		values: row.map((value) => ({
			userEnteredValue: { stringValue: value },
		})),
	};

	// One comma separates this row from the next in updateCells.rows.
	return Buffer.byteLength(JSON.stringify(payload), "utf8") + 1;
}

// connected = the drive.file grant is on the account AND we can still mint a
// token for it (refresh token stored, or the access token is not yet expired).
function isSheetsConnected(
	account: {
		accessTokenExpiresAt: Date | null;
		refreshToken: string | null;
		scope: string | null;
	} | null,
): boolean {
	if (!account?.scope) {
		return false;
	}

	const hasScope = account.scope.split(/[\s,]+/).includes(GOOGLE_SHEETS_SCOPE);

	if (!hasScope) {
		return false;
	}

	if (account.refreshToken) {
		return true;
	}

	return Boolean(
		account.accessTokenExpiresAt &&
			account.accessTokenExpiresAt.getTime() > Date.now(),
	);
}

function toSheetDto(row: LeadSheetSyncRow | null): LeadSheetSyncState["sheet"] {
	if (!row) {
		return null;
	}

	return {
		lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
		spreadsheetUrl: row.spreadsheetUrl,
		syncedLeadCount: row.syncedLeadCount,
	};
}

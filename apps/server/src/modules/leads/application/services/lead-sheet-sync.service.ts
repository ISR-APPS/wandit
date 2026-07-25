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
import { buildLeadSheetValues } from "../../domain/lead-sheet-rows";
import {
	GoogleSheetsApiError,
	GoogleSheetsClient,
} from "../../infrastructure/google/google-sheets.client";
import { toLeadDto } from "../../infrastructure/mappers/lead.mapper";
import {
	type LeadSheetSyncRow,
	LeadSheetSyncsRepository,
} from "../../infrastructure/persistence/lead-sheet-syncs.repository";
import { LeadsRepository } from "../../infrastructure/persistence/leads.repository";

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
		userId: string,
		projectId: string,
	): Promise<LeadSheetSyncState> {
		await this.getOwnedProject(userId, projectId);

		const [account, sync] = await Promise.all([
			this.syncsRepository.findGoogleAccount(userId),
			this.syncsRepository.findByProject(projectId),
		]);

		return { connected: isSheetsConnected(account), sheet: toSheetDto(sync) };
	}

	async syncNow(
		userId: string,
		projectId: string,
	): Promise<LeadSheetSyncState> {
		const project = await this.getOwnedProject(userId, projectId);

		const account = await this.syncsRepository.findGoogleAccount(userId);
		if (!isSheetsConnected(account)) {
			throw new ConflictException(
				"Google Sheets access is not connected for this account",
			);
		}

		const accessToken = await this.mintAccessToken(userId);
		const rows = await this.leadsRepository.listOwnedByProjectForSync(
			userId,
			projectId,
		);
		const values = buildLeadSheetValues(rows.map(toLeadDto));
		const title = `Wandit Leads — ${project.name}`;

		try {
			let sync = await this.syncsRepository.findByProject(projectId);

			if (!sync) {
				sync = await this.createSpreadsheet(accessToken, projectId, title);
			}

			try {
				// Full rewrite: clear everything, then append header + all leads
				// into the now-empty sheet (append grows the grid; update can't).
				await this.sheetsClient.clearValues(
					accessToken,
					sync.spreadsheetId,
					"A:ZZ",
				);
				await this.sheetsClient.appendValues(
					accessToken,
					sync.spreadsheetId,
					"A1",
					values,
				);
			} catch (error) {
				// 404 = the merchant deleted our spreadsheet in Drive. The pointer
				// is stale, not the sync — recreate once and write into the fresh
				// (already empty) sheet.
				if (!(error instanceof GoogleSheetsApiError) || error.status !== 404) {
					throw error;
				}

				sync = await this.createSpreadsheet(accessToken, projectId, title);
				await this.sheetsClient.appendValues(
					accessToken,
					sync.spreadsheetId,
					"A1",
					values,
				);
			}
		} catch (error) {
			throw this.mapGoogleError(error, projectId);
		}

		const updated = await this.syncsRepository.recordSyncResult(
			projectId,
			rows.length,
		);

		if (!updated) {
			throw new Error("Lead sheet sync row vanished while recording result");
		}

		return { connected: true, sheet: toSheetDto(updated) };
	}

	private async getOwnedProject(
		userId: string,
		projectId: string,
	): Promise<{ id: string; name: string }> {
		const project = await this.syncsRepository.findOwnedProject(
			userId,
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

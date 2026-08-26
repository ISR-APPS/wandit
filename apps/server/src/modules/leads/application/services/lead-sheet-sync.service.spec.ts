import {
	BadGatewayException,
	ConflictException,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type { Auth } from "@wandit/auth";
import { GOOGLE_SHEETS_SCOPE } from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	GoogleSheetsApiError,
	type GoogleSheetsClient,
	type StagedSheetRewrite,
} from "../../infrastructure/google/google-sheets.client";
import {
	LeadSheetSyncBusyError,
	LeadSheetSyncLockLostError,
	type LeadSheetSyncsRepository,
} from "../../infrastructure/persistence/lead-sheet-syncs.repository";
import type {
	LeadRow,
	LeadsRepository,
} from "../../infrastructure/persistence/leads.repository";
import {
	GoogleAccessTokenError,
	LeadSheetSyncService,
	LeadSheetSyncStaleError,
} from "./lead-sheet-sync.service";

const USER_ID = "user-1";
const SCOPE: ProjectScope = { kind: "personal", userId: USER_ID };
const ORG_SCOPE: ProjectScope = {
	actorIsLimitExempt: false,
	kind: "org",
	organizationId: "org-1",
	userId: USER_ID,
};
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const DB_NOW = new Date("2026-07-25T14:10:00.000Z");
const SHEET = {
	spreadsheetId: "sheet-abc",
	spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-abc",
};
const SYNC_ROW = { ...SHEET, syncedByUserId: USER_ID };

function connectedAccount(overrides: Record<string, unknown> = {}) {
	return {
		accessTokenExpiresAt: null,
		refreshToken: "refresh-1",
		scope: `openid,email,${GOOGLE_SHEETS_SCOPE}`,
		...overrides,
	};
}

function leadRow(overrides: Partial<LeadRow> = {}): LeadRow {
	return {
		archivedAt: null,
		attribution: { fbclid: "x" },
		commune: null,
		createdAt: new Date("2026-07-25T13:30:00.000Z"),
		extras: null,
		id: "33333333-3333-4333-8333-333333333333",
		name: "Amina B",
		phone: "+213540773102",
		productSku: "SERUM-01",
		status: "to_confirm",
		wilaya: "Alger",
		...overrides,
	};
}

function stagedRewrite(): StagedSheetRewrite {
	return {
		liveSheet: { index: 0, sheetId: 11, title: "Feuille 1" },
		stagingSheet: { columnCount: 13, rowCount: 1, sheetId: 22 },
	};
}

function buildService() {
	const syncsRepository = {
		findByProject: vi.fn().mockResolvedValue(null),
		findGoogleAccount: vi.fn().mockResolvedValue(connectedAccount()),
		findAccessibleProject: vi
			.fn()
			.mockResolvedValue({ id: PROJECT_ID, name: "Parfums d'Alger" }),
		isSyncActorAuthorized: vi.fn().mockResolvedValue(true),
		now: vi.fn().mockResolvedValue(DB_NOW),
		recordSyncResult: vi.fn().mockImplementation(
			async (
				_projectId: string,
				result: {
					lastSyncedAt: Date;
					syncedByUserId: string;
					syncedLeadCount: number;
				},
			) => ({
				...SYNC_ROW,
				lastSyncedAt: new Date("2026-07-25T14:00:00.000Z"),
				syncedByUserId: result.syncedByUserId,
				syncedLeadCount: result.syncedLeadCount,
			}),
		),
		upsertSpreadsheet: vi.fn().mockResolvedValue({
			...SYNC_ROW,
			lastSyncedAt: null,
			syncedLeadCount: 0,
		}),
		withProjectSyncLock: vi
			.fn()
			.mockImplementation(
				async <T>(
					_projectId: string,
					_mode: "try" | "wait",
					fn: () => Promise<T>,
				) => fn(),
			),
	};
	const rewrite = stagedRewrite();
	const sheetsClient = {
		beginStagedRewrite: vi.fn().mockResolvedValue(rewrite),
		commitStagedRewrite: vi.fn().mockResolvedValue(undefined),
		createSpreadsheet: vi.fn().mockResolvedValue(SHEET),
		discardStagedRewrite: vi.fn().mockResolvedValue(undefined),
		writeStagedValues: vi.fn().mockResolvedValue(undefined),
	};
	const leadsRepository = {
		listForProjectSync: vi.fn().mockResolvedValue({
			nextCursor: null,
			rows: [leadRow()],
		}),
	};
	const auth = {
		api: {
			getAccessToken: vi.fn().mockResolvedValue({ accessToken: "token-1" }),
		},
	};
	const service = new LeadSheetSyncService(
		auth as unknown as Auth,
		sheetsClient as unknown as GoogleSheetsClient,
		syncsRepository as unknown as LeadSheetSyncsRepository,
		leadsRepository as unknown as LeadsRepository,
	);

	return {
		auth,
		leadsRepository,
		rewrite,
		service,
		sheetsClient,
		syncsRepository,
	};
}

describe("LeadSheetSyncService", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe("getState", () => {
		it("404s when the project is not owned", async () => {
			const { service, syncsRepository } = buildService();
			syncsRepository.findAccessibleProject.mockResolvedValue(null);

			await expect(service.getState(SCOPE, PROJECT_ID)).rejects.toThrow(
				NotFoundException,
			);
		});

		it("reports disconnected when the Google account lacks the scope", async () => {
			const { service, syncsRepository } = buildService();
			syncsRepository.findGoogleAccount.mockResolvedValue(
				connectedAccount({ scope: "openid,email,profile" }),
			);

			await expect(service.getState(SCOPE, PROJECT_ID)).resolves.toEqual({
				connected: false,
				sheet: null,
			});
		});

		it("reports disconnected when no token can be minted", async () => {
			const { service, syncsRepository } = buildService();
			syncsRepository.findGoogleAccount.mockResolvedValue(
				connectedAccount({
					accessTokenExpiresAt: new Date(Date.now() - 60_000),
					refreshToken: null,
				}),
			);

			const state = await service.getState(SCOPE, PROJECT_ID);

			expect(state.connected).toBe(false);
		});

		it("returns the sheet when connected and synced before", async () => {
			const { service, syncsRepository } = buildService();
			syncsRepository.findByProject.mockResolvedValue({
				...SYNC_ROW,
				lastSyncedAt: new Date("2026-07-25T14:00:00.000Z"),
				syncedLeadCount: 3,
			});

			await expect(service.getState(SCOPE, PROJECT_ID)).resolves.toEqual({
				connected: true,
				sheet: {
					autoSyncEnabled: true,
					lastSyncedAt: "2026-07-25T14:00:00.000Z",
					spreadsheetUrl: SHEET.spreadsheetUrl,
					syncedLeadCount: 3,
				},
			});
		});
	});

	describe("syncNow", () => {
		it("uses organization scope for project data and the acting member for Google", async () => {
			const { auth, leadsRepository, service, syncsRepository } =
				buildService();

			await service.syncNow(ORG_SCOPE, PROJECT_ID);

			expect(syncsRepository.findAccessibleProject).toHaveBeenCalledWith(
				ORG_SCOPE,
				PROJECT_ID,
			);
			expect(syncsRepository.findGoogleAccount).toHaveBeenCalledWith(USER_ID);
			expect(auth.api.getAccessToken).toHaveBeenCalledWith({
				body: { providerId: "google", userId: USER_ID },
			});
			expect(leadsRepository.listForProjectSync).toHaveBeenCalledWith(
				ORG_SCOPE,
				PROJECT_ID,
				{ cursor: undefined, pageSize: 1_000 },
			);
			expect(syncsRepository.withProjectSyncLock).toHaveBeenCalledWith(
				PROJECT_ID,
				"wait",
				expect.any(Function),
			);
		});

		it("creates the spreadsheet on first sync, then writes leads + header", async () => {
			const { rewrite, service, sheetsClient, syncsRepository } =
				buildService();

			const state = await service.syncNow(SCOPE, PROJECT_ID);

			expect(sheetsClient.createSpreadsheet).toHaveBeenCalledWith(
				"token-1",
				"Wandit Leads — Parfums d'Alger",
			);
			expect(syncsRepository.upsertSpreadsheet).toHaveBeenCalledWith(
				PROJECT_ID,
				SHEET,
				USER_ID,
			);
			expect(sheetsClient.beginStagedRewrite).toHaveBeenCalledWith(
				"token-1",
				SHEET.spreadsheetId,
				13,
			);
			expect(sheetsClient.writeStagedValues).toHaveBeenNthCalledWith(
				1,
				"token-1",
				SHEET.spreadsheetId,
				rewrite,
				1,
				[
					[
						"Amina B",
						"+213540773102",
						"Alger",
						"",
						"À confirmer",
						"Facebook",
						"25/07/2026 14:30",
						"SERUM-01",
						"",
						"",
						"",
						"",
						"",
					],
				],
			);
			// The header goes in last: only after every lead has streamed through
			// is the set of dynamic form-field columns known.
			expect(sheetsClient.writeStagedValues).toHaveBeenNthCalledWith(
				2,
				"token-1",
				SHEET.spreadsheetId,
				rewrite,
				0,
				[
					[
						"Nom",
						"Téléphone",
						"Wilaya",
						"Commune",
						"Statut",
						"Source",
						"Date",
						"SKU",
						"Produit",
						"Quantité",
						"Prix",
						"Livraison",
						"Total",
					],
				],
			);
			expect(sheetsClient.commitStagedRewrite).toHaveBeenCalledWith(
				"token-1",
				SHEET.spreadsheetId,
				rewrite,
			);
			expect(syncsRepository.recordSyncResult).toHaveBeenCalledWith(
				PROJECT_ID,
				{
					lastSyncedAt: expect.any(Date),
					syncedByUserId: USER_ID,
					syncedLeadCount: 1,
				},
			);
			const commitCallOrder =
				sheetsClient.commitStagedRewrite.mock.invocationCallOrder[0];
			const recordCallOrder =
				syncsRepository.recordSyncResult.mock.invocationCallOrder[0];
			if (commitCallOrder === undefined || recordCallOrder === undefined) {
				throw new Error("Expected commit and sync-result calls");
			}
			expect(commitCallOrder).toBeLessThan(recordCallOrder);
			expect(state).toEqual({
				connected: true,
				sheet: {
					autoSyncEnabled: true,
					lastSyncedAt: "2026-07-25T14:00:00.000Z",
					spreadsheetUrl: SHEET.spreadsheetUrl,
					syncedLeadCount: 1,
				},
			});
		});

		it("records the acting user with the DB clock captured before reading leads", async () => {
			const { leadsRepository, service, syncsRepository } = buildService();

			await service.syncNow(SCOPE, PROJECT_ID);

			expect(syncsRepository.now).toHaveBeenCalledOnce();
			expect(syncsRepository.recordSyncResult).toHaveBeenCalledWith(
				PROJECT_ID,
				{
					lastSyncedAt: DB_NOW,
					syncedByUserId: USER_ID,
					syncedLeadCount: 1,
				},
			);
			const nowCallOrder = syncsRepository.now.mock.invocationCallOrder[0];
			const readCallOrder =
				leadsRepository.listForProjectSync.mock.invocationCallOrder[0];
			if (nowCallOrder === undefined || readCallOrder === undefined) {
				throw new Error("Expected DB clock and lead-read calls");
			}
			expect(nowCallOrder).toBeLessThan(readCallOrder);
		});

		it("atomically stages and swaps an existing spreadsheet", async () => {
			const { rewrite, service, sheetsClient, syncsRepository } =
				buildService();
			syncsRepository.findByProject.mockResolvedValue({
				...SYNC_ROW,
				lastSyncedAt: new Date("2026-07-20T10:00:00.000Z"),
				syncedLeadCount: 5,
			});

			await service.syncNow(SCOPE, PROJECT_ID);

			expect(sheetsClient.createSpreadsheet).not.toHaveBeenCalled();
			expect(sheetsClient.beginStagedRewrite).toHaveBeenCalledWith(
				"token-1",
				SHEET.spreadsheetId,
				13,
			);
			expect(sheetsClient.writeStagedValues).toHaveBeenCalledTimes(2);
			expect(sheetsClient.commitStagedRewrite).toHaveBeenCalledWith(
				"token-1",
				SHEET.spreadsheetId,
				rewrite,
			);
			expect(sheetsClient.discardStagedRewrite).not.toHaveBeenCalled();
		});

		it("recreates the spreadsheet when the old one was deleted in Drive", async () => {
			const { rewrite, service, sheetsClient, syncsRepository } =
				buildService();
			syncsRepository.findByProject.mockResolvedValue({
				...SYNC_ROW,
				spreadsheetId: "deleted-sheet",
				lastSyncedAt: null,
				syncedLeadCount: 0,
			});
			sheetsClient.beginStagedRewrite.mockRejectedValueOnce(
				new GoogleSheetsApiError(404, "Requested entity was not found."),
			);

			await service.syncNow(SCOPE, PROJECT_ID);

			expect(sheetsClient.createSpreadsheet).toHaveBeenCalledTimes(1);
			expect(sheetsClient.beginStagedRewrite).toHaveBeenNthCalledWith(
				1,
				"token-1",
				"deleted-sheet",
				13,
			);
			expect(sheetsClient.beginStagedRewrite).toHaveBeenNthCalledWith(
				2,
				"token-1",
				SHEET.spreadsheetId,
				13,
			);
			expect(sheetsClient.commitStagedRewrite).toHaveBeenCalledWith(
				"token-1",
				SHEET.spreadsheetId,
				rewrite,
			);
		});

		it("pages through and chunks the complete export before committing", async () => {
			const {
				leadsRepository,
				rewrite,
				service,
				sheetsClient,
				syncsRepository,
			} = buildService();
			const firstPage = Array.from({ length: 1_000 }, (_, index) =>
				leadRow({ name: `${index}-${"x".repeat(2_000)}` }),
			);
			const secondPage = [leadRow({ name: `1000-${"x".repeat(2_000)}` })];
			syncsRepository.findByProject.mockResolvedValue({
				...SYNC_ROW,
				lastSyncedAt: null,
				syncedLeadCount: 0,
			});
			leadsRepository.listForProjectSync
				.mockResolvedValueOnce({ nextCursor: "next-page", rows: firstPage })
				.mockResolvedValueOnce({ nextCursor: null, rows: secondPage });

			await service.syncNow(SCOPE, PROJECT_ID);

			expect(leadsRepository.listForProjectSync).toHaveBeenNthCalledWith(
				1,
				SCOPE,
				PROJECT_ID,
				{ cursor: undefined, pageSize: 1_000 },
			);
			expect(leadsRepository.listForProjectSync).toHaveBeenNthCalledWith(
				2,
				SCOPE,
				PROJECT_ID,
				{ cursor: "next-page", pageSize: 1_000 },
			);
			const writeCalls = sheetsClient.writeStagedValues.mock.calls;
			// Last write is the header row, once every page has been seen.
			expect(writeCalls.at(-1)?.[3]).toBe(0);
			expect(writeCalls.at(-1)?.[4]).toHaveLength(1);
			const dataWrites = writeCalls.slice(0, -1);
			expect(dataWrites.length).toBeGreaterThan(1);
			let nextStartRowIndex = 1;
			for (const call of dataWrites) {
				expect(call[3]).toBe(nextStartRowIndex);
				nextStartRowIndex += call[4].length;
			}
			expect(dataWrites.flatMap((call) => call[4])).toHaveLength(1_001);
			expect(sheetsClient.commitStagedRewrite).toHaveBeenCalledWith(
				"token-1",
				SHEET.spreadsheetId,
				rewrite,
			);
			expect(syncsRepository.recordSyncResult).toHaveBeenCalledWith(
				PROJECT_ID,
				{
					lastSyncedAt: expect.any(Date),
					syncedByUserId: USER_ID,
					syncedLeadCount: 1_001,
				},
			);
		});

		it("appends one column per form field discovered across pages", async () => {
			const { leadsRepository, service, sheetsClient, syncsRepository } =
				buildService();
			syncsRepository.findByProject.mockResolvedValue({
				...SYNC_ROW,
				lastSyncedAt: null,
				syncedLeadCount: 0,
			});
			leadsRepository.listForProjectSync
				.mockResolvedValueOnce({
					nextCursor: "page-2",
					rows: [leadRow({ extras: { _rawPhone: "0550", size: "XL" } })],
				})
				.mockResolvedValueOnce({
					nextCursor: null,
					rows: [leadRow({ extras: { color: "Noir", size: "M" } })],
				});

			await service.syncNow(SCOPE, PROJECT_ID);

			const writeCalls = sheetsClient.writeStagedValues.mock.calls;
			// The header is written last, once every field is known; capture
			// metadata (_rawPhone) never becomes a column.
			expect(writeCalls.at(-1)?.[3]).toBe(0);
			expect(writeCalls.at(-1)?.[4]).toEqual([
				[
					"Nom",
					"Téléphone",
					"Wilaya",
					"Commune",
					"Statut",
					"Source",
					"Date",
					"SKU",
					"Produit",
					"Quantité",
					"Prix",
					"Livraison",
					"Total",
					"size",
					"color",
				],
			]);
			const fixedCells = [
				"Amina B",
				"+213540773102",
				"Alger",
				"",
				"À confirmer",
				"Facebook",
				"25/07/2026 14:30",
				"SERUM-01",
				"",
				"",
				"",
				"",
				"",
			];
			expect(writeCalls.slice(0, -1).flatMap((call) => call[4])).toEqual([
				[...fixedCells, "XL"],
				[...fixedCells, "M", "Noir"],
			]);
		});

		it("fails safely when the repository repeats a paging cursor", async () => {
			const {
				leadsRepository,
				rewrite,
				service,
				sheetsClient,
				syncsRepository,
			} = buildService();
			syncsRepository.findByProject.mockResolvedValue({
				...SYNC_ROW,
				lastSyncedAt: null,
				syncedLeadCount: 1,
			});
			leadsRepository.listForProjectSync
				.mockResolvedValueOnce({
					nextCursor: "repeated-cursor",
					rows: [leadRow({ name: "First page" })],
				})
				.mockResolvedValueOnce({
					nextCursor: "repeated-cursor",
					rows: [leadRow({ name: "Repeated page" })],
				});

			await expect(service.syncNow(SCOPE, PROJECT_ID)).rejects.toThrow(
				BadGatewayException,
			);

			expect(leadsRepository.listForProjectSync).toHaveBeenCalledTimes(2);
			expect(sheetsClient.commitStagedRewrite).not.toHaveBeenCalled();
			expect(sheetsClient.discardStagedRewrite).toHaveBeenCalledWith(
				"token-1",
				SHEET.spreadsheetId,
				rewrite,
			);
			expect(syncsRepository.recordSyncResult).not.toHaveBeenCalled();
		});

		it("409s when the Sheets scope was never granted", async () => {
			const { service, sheetsClient, syncsRepository } = buildService();
			syncsRepository.findGoogleAccount.mockResolvedValue(
				connectedAccount({ scope: "openid,email" }),
			);

			await expect(service.syncNow(SCOPE, PROJECT_ID)).rejects.toThrow(
				ConflictException,
			);
			expect(sheetsClient.createSpreadsheet).not.toHaveBeenCalled();
		});

		it("returns a typed 409 with a reconnect hint when token minting fails", async () => {
			const { auth, service } = buildService();
			const mintFailure = new Error("Failed to refresh access token");
			auth.api.getAccessToken.mockRejectedValue(mintFailure);

			const error = await service
				.syncNow(SCOPE, PROJECT_ID)
				.catch((caught: unknown) => caught);
			expect(error).toBeInstanceOf(GoogleAccessTokenError);
			expect(error).toBeInstanceOf(ConflictException);
			if (!(error instanceof GoogleAccessTokenError)) {
				throw new Error("Expected a GoogleAccessTokenError");
			}
			expect(error.getStatus()).toBe(409);
			expect(error.cause).toBe(mintFailure);
			expect(error.message).toMatch(/reconnect Google Sheets/);
		});

		it("returns 503 rather than 409 when another project sync holds the lock", async () => {
			const { service, syncsRepository } = buildService();
			syncsRepository.withProjectSyncLock.mockRejectedValueOnce(
				new LeadSheetSyncBusyError(),
			);

			const error = await service
				.syncNow(SCOPE, PROJECT_ID)
				.catch((caught: unknown) => caught);
			expect(error).toBeInstanceOf(ServiceUnavailableException);
			if (!(error instanceof ServiceUnavailableException)) {
				throw new Error("Expected the manual sync to return a 503");
			}
			expect(error.getStatus()).toBe(503);
			expect(error).not.toBeInstanceOf(ConflictException);
		});

		it("returns 503 when the project sync loses its advisory-lock connection", async () => {
			const { service, syncsRepository } = buildService();
			const cause = new Error("database connection terminated");
			syncsRepository.withProjectSyncLock.mockRejectedValueOnce(
				new LeadSheetSyncLockLostError(cause),
			);

			const error = await service
				.syncNow(SCOPE, PROJECT_ID)
				.catch((caught: unknown) => caught);
			expect(error).toBeInstanceOf(ServiceUnavailableException);
			if (!(error instanceof ServiceUnavailableException)) {
				throw new Error("Expected the lost lock to return a 503");
			}
			expect(error.getStatus()).toBe(503);
			expect(error.message).toBe(
				"The sync lost its lock — try again in a moment",
			);
		});

		it.each([
			401, 403,
		])("preserves Google's %i response as the conflict cause", async (status) => {
			const { service, sheetsClient } = buildService();
			const googleError = new GoogleSheetsApiError(
				status,
				"Google Sheets API has not been used in project 123 before",
			);
			sheetsClient.createSpreadsheet.mockRejectedValue(googleError);

			const error = await service
				.syncNow(SCOPE, PROJECT_ID)
				.catch((caught: unknown) => caught);
			expect(error).toBeInstanceOf(ConflictException);
			if (!(error instanceof ConflictException)) {
				throw new Error(`Expected Google's ${status} to map to a conflict`);
			}
			expect(error.message).toMatch(/Google Sheets API has not been used/);
			expect(error.cause).toBe(googleError);
		});

		it("preserves a mapped Google API error as the bad gateway cause", async () => {
			const { service, sheetsClient } = buildService();
			const googleError = new GoogleSheetsApiError(429, "Quota exceeded");
			sheetsClient.createSpreadsheet.mockRejectedValue(googleError);

			const error = await service
				.syncNow(SCOPE, PROJECT_ID)
				.catch((caught: unknown) => caught);
			expect(error).toBeInstanceOf(BadGatewayException);
			if (!(error instanceof BadGatewayException)) {
				throw new Error("Expected Google's 429 to map to a bad gateway");
			}
			expect(error.cause).toBe(googleError);
		});

		it("preserves the previous live values when a staged write fails", async () => {
			const { rewrite, service, sheetsClient, syncsRepository } =
				buildService();
			const previousLiveValues = [
				["Nom", "Téléphone"],
				["Previous lead", "+213555000000"],
			];
			let liveValues = structuredClone(previousLiveValues);
			let stagedValues: string[][] = [];
			syncsRepository.findByProject.mockResolvedValue({
				...SYNC_ROW,
				lastSyncedAt: null,
				syncedLeadCount: 0,
			});
			sheetsClient.writeStagedValues.mockImplementation(
				async (
					_accessToken: string,
					_spreadsheetId: string,
					_stagedRewrite: StagedSheetRewrite,
					startRowIndex: number,
					values: string[][],
				) => {
					if (startRowIndex > 0) {
						throw new GoogleSheetsApiError(500, "Internal error");
					}

					stagedValues.splice(startRowIndex, values.length, ...values);
				},
			);
			sheetsClient.commitStagedRewrite.mockImplementation(async () => {
				liveValues = structuredClone(stagedValues);
			});
			sheetsClient.discardStagedRewrite.mockImplementation(async () => {
				stagedValues = [];
			});

			await expect(service.syncNow(SCOPE, PROJECT_ID)).rejects.toThrow(
				BadGatewayException,
			);
			expect(liveValues).toEqual(previousLiveValues);
			expect(sheetsClient.commitStagedRewrite).not.toHaveBeenCalled();
			expect(sheetsClient.discardStagedRewrite).toHaveBeenCalledWith(
				"token-1",
				SHEET.spreadsheetId,
				rewrite,
			);
			expect(syncsRepository.recordSyncResult).not.toHaveBeenCalled();
		});

		it("does not record success when the atomic commit fails", async () => {
			const { service, sheetsClient, syncsRepository } = buildService();
			syncsRepository.findByProject.mockResolvedValue({
				...SYNC_ROW,
				lastSyncedAt: null,
				syncedLeadCount: 1,
			});
			sheetsClient.commitStagedRewrite.mockRejectedValue(
				new GoogleSheetsApiError(503, "Temporary backend error"),
			);

			await expect(service.syncNow(SCOPE, PROJECT_ID)).rejects.toThrow(
				BadGatewayException,
			);

			expect(sheetsClient.commitStagedRewrite).toHaveBeenCalledTimes(1);
			// Once a commit request is in flight its response can be ambiguous. Never
			// delete that tab as "cleanup": it may already be the replacement live tab.
			expect(sheetsClient.discardStagedRewrite).not.toHaveBeenCalled();
			expect(syncsRepository.recordSyncResult).not.toHaveBeenCalled();
		});

		it("404s when the project is not owned, before touching Google", async () => {
			const { auth, service, syncsRepository } = buildService();
			syncsRepository.findAccessibleProject.mockResolvedValue(null);

			await expect(service.syncNow(SCOPE, PROJECT_ID)).rejects.toThrow(
				NotFoundException,
			);
			expect(auth.api.getAccessToken).not.toHaveBeenCalled();
		});
	});

	describe("scheduled candidate validation", () => {
		it("does not re-check the sync actor for a manual sync", async () => {
			const { service, syncsRepository } = buildService();
			syncsRepository.isSyncActorAuthorized.mockResolvedValue(false);

			await expect(service.syncNow(SCOPE, PROJECT_ID)).resolves.toMatchObject({
				connected: true,
			});
			expect(syncsRepository.isSyncActorAuthorized).not.toHaveBeenCalled();
		});

		it("treats a missing sync row as stale and never creates a spreadsheet", async () => {
			const { leadsRepository, service, sheetsClient, syncsRepository } =
				buildService();
			let insideLock = false;
			syncsRepository.withProjectSyncLock.mockImplementationOnce(
				async <T>(
					_projectId: string,
					_mode: "try" | "wait",
					fn: () => Promise<T>,
				) => {
					insideLock = true;
					try {
						return await fn();
					} finally {
						insideLock = false;
					}
				},
			);
			syncsRepository.findByProject.mockImplementationOnce(async () => {
				expect(insideLock).toBe(true);
				return null;
			});

			await expect(
				service.syncProject(
					SCOPE,
					{ id: PROJECT_ID, name: "Parfums d'Alger" },
					"try",
					{ lastSyncedAt: null },
				),
			).rejects.toThrow(LeadSheetSyncStaleError);
			expect(insideLock).toBe(false);
			expect(sheetsClient.createSpreadsheet).not.toHaveBeenCalled();
			expect(sheetsClient.beginStagedRewrite).not.toHaveBeenCalled();
			expect(syncsRepository.now).not.toHaveBeenCalled();
			expect(syncsRepository.recordSyncResult).not.toHaveBeenCalled();
			expect(leadsRepository.listForProjectSync).not.toHaveBeenCalled();
		});

		it("treats a changed sync owner as stale and never creates a spreadsheet", async () => {
			const { leadsRepository, service, sheetsClient, syncsRepository } =
				buildService();
			const scheduledAt = new Date("2026-08-25T10:00:00.000Z");
			syncsRepository.findByProject.mockResolvedValue({
				...SYNC_ROW,
				lastSyncedAt: scheduledAt,
				syncedByUserId: "another-user",
				syncedLeadCount: 2,
			});

			await expect(
				service.syncProject(
					SCOPE,
					{ id: PROJECT_ID, name: "Parfums d'Alger" },
					"try",
					{ lastSyncedAt: scheduledAt },
				),
			).rejects.toThrow(LeadSheetSyncStaleError);
			expect(sheetsClient.createSpreadsheet).not.toHaveBeenCalled();
			expect(sheetsClient.beginStagedRewrite).not.toHaveBeenCalled();
			expect(syncsRepository.now).not.toHaveBeenCalled();
			expect(syncsRepository.recordSyncResult).not.toHaveBeenCalled();
			expect(leadsRepository.listForProjectSync).not.toHaveBeenCalled();
		});

		it("treats a changed last sync timestamp as stale and never creates a spreadsheet", async () => {
			const { leadsRepository, service, sheetsClient, syncsRepository } =
				buildService();
			syncsRepository.findByProject.mockResolvedValue({
				...SYNC_ROW,
				lastSyncedAt: new Date("2026-08-25T10:30:00.000Z"),
				syncedLeadCount: 3,
			});

			await expect(
				service.syncProject(
					SCOPE,
					{ id: PROJECT_ID, name: "Parfums d'Alger" },
					"try",
					{ lastSyncedAt: new Date("2026-08-25T10:00:00.000Z") },
				),
			).rejects.toThrow(LeadSheetSyncStaleError);
			expect(sheetsClient.createSpreadsheet).not.toHaveBeenCalled();
			expect(sheetsClient.beginStagedRewrite).not.toHaveBeenCalled();
			expect(syncsRepository.now).not.toHaveBeenCalled();
			expect(syncsRepository.recordSyncResult).not.toHaveBeenCalled();
			expect(leadsRepository.listForProjectSync).not.toHaveBeenCalled();
		});

		it("treats a no-longer-authorized sync actor as stale under the lock", async () => {
			const { leadsRepository, service, sheetsClient, syncsRepository } =
				buildService();
			const scheduledAt = new Date("2026-08-25T10:00:00.000Z");
			let insideLock = false;
			syncsRepository.findByProject.mockResolvedValue({
				...SYNC_ROW,
				lastSyncedAt: scheduledAt,
				syncedLeadCount: 2,
			});
			syncsRepository.isSyncActorAuthorized.mockImplementationOnce(async () => {
				expect(insideLock).toBe(true);
				return false;
			});
			syncsRepository.withProjectSyncLock.mockImplementationOnce(
				async <T>(
					_projectId: string,
					_mode: "try" | "wait",
					fn: () => Promise<T>,
				) => {
					insideLock = true;
					try {
						return await fn();
					} finally {
						insideLock = false;
					}
				},
			);

			await expect(
				service.syncProject(
					SCOPE,
					{ id: PROJECT_ID, name: "Parfums d'Alger" },
					"try",
					{ lastSyncedAt: scheduledAt },
				),
			).rejects.toThrow(LeadSheetSyncStaleError);
			expect(insideLock).toBe(false);
			expect(syncsRepository.isSyncActorAuthorized).toHaveBeenCalledWith(
				PROJECT_ID,
				USER_ID,
			);
			expect(sheetsClient.beginStagedRewrite).not.toHaveBeenCalled();
			expect(syncsRepository.now).not.toHaveBeenCalled();
			expect(syncsRepository.recordSyncResult).not.toHaveBeenCalled();
			expect(leadsRepository.listForProjectSync).not.toHaveBeenCalled();
		});
	});
});

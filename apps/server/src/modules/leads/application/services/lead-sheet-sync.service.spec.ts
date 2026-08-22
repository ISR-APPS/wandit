import {
	BadGatewayException,
	ConflictException,
	NotFoundException,
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
import type { LeadSheetSyncsRepository } from "../../infrastructure/persistence/lead-sheet-syncs.repository";
import type {
	LeadRow,
	LeadsRepository,
} from "../../infrastructure/persistence/leads.repository";
import { LeadSheetSyncService } from "./lead-sheet-sync.service";

const USER_ID = "user-1";
const SCOPE: ProjectScope = { kind: "personal", userId: USER_ID };
const ORG_SCOPE: ProjectScope = {
	actorIsLimitExempt: false,
	kind: "org",
	organizationId: "org-1",
	userId: USER_ID,
};
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const SHEET = {
	spreadsheetId: "sheet-abc",
	spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-abc",
};

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
		recordSyncResult: vi
			.fn()
			.mockImplementation(
				async (_projectId: string, syncedLeadCount: number) => ({
					...SHEET,
					lastSyncedAt: new Date("2026-07-25T14:00:00.000Z"),
					syncedLeadCount,
				}),
			),
		upsertSpreadsheet: vi.fn().mockResolvedValue({
			...SHEET,
			lastSyncedAt: null,
			syncedLeadCount: 0,
		}),
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
				...SHEET,
				lastSyncedAt: new Date("2026-07-25T14:00:00.000Z"),
				syncedLeadCount: 3,
			});

			await expect(service.getState(SCOPE, PROJECT_ID)).resolves.toEqual({
				connected: true,
				sheet: {
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
				1,
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
					lastSyncedAt: "2026-07-25T14:00:00.000Z",
					spreadsheetUrl: SHEET.spreadsheetUrl,
					syncedLeadCount: 1,
				},
			});
		});

		it("atomically stages and swaps an existing spreadsheet", async () => {
			const { rewrite, service, sheetsClient, syncsRepository } =
				buildService();
			syncsRepository.findByProject.mockResolvedValue({
				...SHEET,
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
				...SHEET,
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
				...SHEET,
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
				1_001,
			);
		});

		it("appends one column per form field discovered across pages", async () => {
			const { leadsRepository, service, sheetsClient, syncsRepository } =
				buildService();
			syncsRepository.findByProject.mockResolvedValue({
				...SHEET,
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
				...SHEET,
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

		it("409s with a reconnect hint when the token mint fails", async () => {
			const { auth, service } = buildService();
			auth.api.getAccessToken.mockRejectedValue(
				new Error("Failed to refresh access token"),
			);

			await expect(service.syncNow(SCOPE, PROJECT_ID)).rejects.toThrow(
				ConflictException,
			);
		});

		it("surfaces Google's message on 403 (API not enabled / revoked)", async () => {
			const { service, sheetsClient } = buildService();
			sheetsClient.createSpreadsheet.mockRejectedValue(
				new GoogleSheetsApiError(
					403,
					"Google Sheets API has not been used in project 123 before",
				),
			);

			await expect(service.syncNow(SCOPE, PROJECT_ID)).rejects.toThrow(
				/Google Sheets API has not been used/,
			);
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
				...SHEET,
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
				...SHEET,
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
});

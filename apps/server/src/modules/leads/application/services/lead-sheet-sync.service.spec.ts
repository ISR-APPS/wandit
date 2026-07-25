import {
	BadGatewayException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
import type { Auth } from "@wandit/auth";
import { GOOGLE_SHEETS_SCOPE } from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	GoogleSheetsApiError,
	type GoogleSheetsClient,
} from "../../infrastructure/google/google-sheets.client";
import type { LeadSheetSyncsRepository } from "../../infrastructure/persistence/lead-sheet-syncs.repository";
import type {
	LeadRow,
	LeadsRepository,
} from "../../infrastructure/persistence/leads.repository";
import { LeadSheetSyncService } from "./lead-sheet-sync.service";

const USER_ID = "user-1";
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

function leadRow(): LeadRow {
	return {
		attribution: { fbclid: "x" },
		commune: null,
		createdAt: new Date("2026-07-25T13:30:00.000Z"),
		extras: null,
		id: "33333333-3333-4333-8333-333333333333",
		name: "Amina B",
		phone: "+213540773102",
		status: "to_confirm",
		wilaya: "Alger",
	};
}

function buildService() {
	const syncsRepository = {
		findByProject: vi.fn().mockResolvedValue(null),
		findGoogleAccount: vi.fn().mockResolvedValue(connectedAccount()),
		findOwnedProject: vi
			.fn()
			.mockResolvedValue({ id: PROJECT_ID, name: "Parfums d'Alger" }),
		recordSyncResult: vi.fn().mockResolvedValue({
			...SHEET,
			lastSyncedAt: new Date("2026-07-25T14:00:00.000Z"),
			syncedLeadCount: 1,
		}),
		upsertSpreadsheet: vi.fn().mockResolvedValue({
			...SHEET,
			lastSyncedAt: null,
			syncedLeadCount: 0,
		}),
	};
	const sheetsClient = {
		clearValues: vi.fn().mockResolvedValue(undefined),
		createSpreadsheet: vi.fn().mockResolvedValue(SHEET),
		appendValues: vi.fn().mockResolvedValue(undefined),
	};
	const leadsRepository = {
		listOwnedByProjectForSync: vi.fn().mockResolvedValue([leadRow()]),
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

	return { auth, leadsRepository, service, sheetsClient, syncsRepository };
}

describe("LeadSheetSyncService", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe("getState", () => {
		it("404s when the project is not owned", async () => {
			const { service, syncsRepository } = buildService();
			syncsRepository.findOwnedProject.mockResolvedValue(null);

			await expect(service.getState(USER_ID, PROJECT_ID)).rejects.toThrow(
				NotFoundException,
			);
		});

		it("reports disconnected when the Google account lacks the scope", async () => {
			const { service, syncsRepository } = buildService();
			syncsRepository.findGoogleAccount.mockResolvedValue(
				connectedAccount({ scope: "openid,email,profile" }),
			);

			await expect(service.getState(USER_ID, PROJECT_ID)).resolves.toEqual({
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

			const state = await service.getState(USER_ID, PROJECT_ID);

			expect(state.connected).toBe(false);
		});

		it("returns the sheet when connected and synced before", async () => {
			const { service, syncsRepository } = buildService();
			syncsRepository.findByProject.mockResolvedValue({
				...SHEET,
				lastSyncedAt: new Date("2026-07-25T14:00:00.000Z"),
				syncedLeadCount: 3,
			});

			await expect(service.getState(USER_ID, PROJECT_ID)).resolves.toEqual({
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
		it("creates the spreadsheet on first sync, then writes header + leads", async () => {
			const { service, sheetsClient, syncsRepository } = buildService();

			const state = await service.syncNow(USER_ID, PROJECT_ID);

			expect(sheetsClient.createSpreadsheet).toHaveBeenCalledWith(
				"token-1",
				"Wandit Leads — Parfums d'Alger",
			);
			expect(syncsRepository.upsertSpreadsheet).toHaveBeenCalledWith(
				PROJECT_ID,
				SHEET,
			);
			expect(sheetsClient.appendValues).toHaveBeenCalledWith(
				"token-1",
				SHEET.spreadsheetId,
				"A1",
				[
					["Nom", "Téléphone", "Wilaya", "Commune", "Statut", "Source", "Date"],
					[
						"Amina B",
						"+213540773102",
						"Alger",
						"",
						"À confirmer",
						"Facebook",
						"25/07/2026 14:30",
					],
				],
			);
			expect(syncsRepository.recordSyncResult).toHaveBeenCalledWith(
				PROJECT_ID,
				1,
			);
			expect(state).toEqual({
				connected: true,
				sheet: {
					lastSyncedAt: "2026-07-25T14:00:00.000Z",
					spreadsheetUrl: SHEET.spreadsheetUrl,
					syncedLeadCount: 1,
				},
			});
		});

		it("rewrites the existing spreadsheet: clear, then update", async () => {
			const { service, sheetsClient, syncsRepository } = buildService();
			syncsRepository.findByProject.mockResolvedValue({
				...SHEET,
				lastSyncedAt: new Date("2026-07-20T10:00:00.000Z"),
				syncedLeadCount: 5,
			});

			await service.syncNow(USER_ID, PROJECT_ID);

			expect(sheetsClient.createSpreadsheet).not.toHaveBeenCalled();
			expect(sheetsClient.clearValues).toHaveBeenCalledWith(
				"token-1",
				SHEET.spreadsheetId,
				"A:ZZ",
			);
			expect(sheetsClient.appendValues).toHaveBeenCalledTimes(1);
		});

		it("recreates the spreadsheet when the old one was deleted in Drive", async () => {
			const { service, sheetsClient, syncsRepository } = buildService();
			syncsRepository.findByProject.mockResolvedValue({
				...SHEET,
				spreadsheetId: "deleted-sheet",
				lastSyncedAt: null,
				syncedLeadCount: 0,
			});
			sheetsClient.clearValues.mockRejectedValue(
				new GoogleSheetsApiError(404, "Requested entity was not found."),
			);

			await service.syncNow(USER_ID, PROJECT_ID);

			expect(sheetsClient.createSpreadsheet).toHaveBeenCalledTimes(1);
			expect(sheetsClient.appendValues).toHaveBeenCalledWith(
				"token-1",
				SHEET.spreadsheetId,
				"A1",
				expect.any(Array),
			);
		});

		it("409s when the Sheets scope was never granted", async () => {
			const { service, sheetsClient, syncsRepository } = buildService();
			syncsRepository.findGoogleAccount.mockResolvedValue(
				connectedAccount({ scope: "openid,email" }),
			);

			await expect(service.syncNow(USER_ID, PROJECT_ID)).rejects.toThrow(
				ConflictException,
			);
			expect(sheetsClient.createSpreadsheet).not.toHaveBeenCalled();
		});

		it("409s with a reconnect hint when the token mint fails", async () => {
			const { auth, service } = buildService();
			auth.api.getAccessToken.mockRejectedValue(
				new Error("Failed to refresh access token"),
			);

			await expect(service.syncNow(USER_ID, PROJECT_ID)).rejects.toThrow(
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

			await expect(service.syncNow(USER_ID, PROJECT_ID)).rejects.toThrow(
				/Google Sheets API has not been used/,
			);
		});

		it("502s on other Google failures", async () => {
			const { service, sheetsClient, syncsRepository } = buildService();
			syncsRepository.findByProject.mockResolvedValue({
				...SHEET,
				lastSyncedAt: null,
				syncedLeadCount: 0,
			});
			sheetsClient.appendValues.mockRejectedValue(
				new GoogleSheetsApiError(500, "Internal error"),
			);

			await expect(service.syncNow(USER_ID, PROJECT_ID)).rejects.toThrow(
				BadGatewayException,
			);
			expect(syncsRepository.recordSyncResult).not.toHaveBeenCalled();
		});

		it("404s when the project is not owned, before touching Google", async () => {
			const { auth, service, syncsRepository } = buildService();
			syncsRepository.findOwnedProject.mockResolvedValue(null);

			await expect(service.syncNow(USER_ID, PROJECT_ID)).rejects.toThrow(
				NotFoundException,
			);
			expect(auth.api.getAccessToken).not.toHaveBeenCalled();
		});
	});
});

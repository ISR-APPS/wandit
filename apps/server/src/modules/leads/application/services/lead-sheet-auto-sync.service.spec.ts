import { BadGatewayException, ConflictException, Logger } from "@nestjs/common";
import { GOOGLE_SHEETS_SCOPE } from "@wandit/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleSheetsApiError } from "../../infrastructure/google/google-sheets.client";
import {
	type LeadSheetAutoSyncCandidate,
	LeadSheetSyncBusyError,
	LeadSheetSyncLockLostError,
	type LeadSheetSyncsRepository,
} from "../../infrastructure/persistence/lead-sheet-syncs.repository";
import { LeadSheetAutoSyncService } from "./lead-sheet-auto-sync.service";
import {
	GoogleAccessTokenError,
	type LeadSheetSyncService,
	LeadSheetSyncStaleError,
} from "./lead-sheet-sync.service";

const PERSONAL_CANDIDATE: LeadSheetAutoSyncCandidate = {
	lastSyncedAt: new Date("2026-08-25T10:00:00.000Z"),
	organizationId: null,
	projectId: "project-personal",
	projectName: "Personal shop",
	syncedByUserId: "user-personal",
	syncedLeadCount: 2,
};
const ORG_CANDIDATE: LeadSheetAutoSyncCandidate = {
	lastSyncedAt: null,
	organizationId: "org-1",
	projectId: "project-org",
	projectName: "Organization shop",
	syncedByUserId: "user-org-member",
	syncedLeadCount: 0,
};

function connectedAccount() {
	return {
		accessTokenExpiresAt: null,
		refreshToken: "refresh-token",
		scope: `openid email ${GOOGLE_SHEETS_SCOPE}`,
	};
}

function buildService(
	candidates: LeadSheetAutoSyncCandidate[] = [PERSONAL_CANDIDATE],
) {
	const syncsRepository = {
		findGoogleAccounts: vi
			.fn()
			.mockImplementation(async (userIds: string[]) => {
				return new Map(userIds.map((userId) => [userId, connectedAccount()]));
			}),
		listDueForAutoSync: vi.fn().mockResolvedValue(candidates),
	};
	const syncService = {
		syncProject: vi.fn().mockResolvedValue({
			lastSyncedAt: new Date("2026-08-25T10:30:00.000Z"),
			spreadsheetId: "sheet-updated",
			spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-updated",
			syncedByUserId: "user-personal",
			syncedLeadCount: 3,
		}),
	};
	const service = new LeadSheetAutoSyncService(
		syncsRepository as unknown as LeadSheetSyncsRepository,
		syncService as unknown as LeadSheetSyncService,
	);

	return { service, syncService, syncsRepository };
}

describe("LeadSheetAutoSyncService", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
		vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
	});

	it("builds personal and organization scopes and syncs with a try lock", async () => {
		const { service, syncService, syncsRepository } = buildService([
			PERSONAL_CANDIDATE,
			ORG_CANDIDATE,
		]);

		await expect(service.sweep()).resolves.toEqual({
			candidates: 2,
			deferred: 0,
			failed: 0,
			failures: [],
			skipped: 0,
			synced: 2,
			tokenFailed: 0,
			tokenFailedUsers: 0,
		});
		expect(syncsRepository.findGoogleAccounts).toHaveBeenCalledWith([
			"user-personal",
			"user-org-member",
		]);
		expect(syncService.syncProject).toHaveBeenNthCalledWith(
			1,
			{ kind: "personal", userId: "user-personal" },
			{ id: "project-personal", name: "Personal shop" },
			"try",
			{ lastSyncedAt: PERSONAL_CANDIDATE.lastSyncedAt },
		);
		expect(syncService.syncProject).toHaveBeenNthCalledWith(
			2,
			{
				actorIsLimitExempt: false,
				kind: "org",
				organizationId: "org-1",
				userId: "user-org-member",
			},
			{ id: "project-org", name: "Organization shop" },
			"try",
			{ lastSyncedAt: ORG_CANDIDATE.lastSyncedAt },
		);
	});

	it("skips a project whose Google grant is gone", async () => {
		const { service, syncService, syncsRepository } = buildService();
		syncsRepository.findGoogleAccounts.mockResolvedValueOnce(new Map());

		await expect(service.sweep()).resolves.toMatchObject({
			candidates: 1,
			failed: 0,
			skipped: 1,
			synced: 0,
			tokenFailed: 0,
			tokenFailedUsers: 0,
		});
		expect(syncService.syncProject).not.toHaveBeenCalled();
	});

	it("continues after one project fails and reports the failure", async () => {
		const { service, syncService } = buildService([
			PERSONAL_CANDIDATE,
			ORG_CANDIDATE,
		]);
		syncService.syncProject
			.mockRejectedValueOnce(new Error("Google Sheets unavailable"))
			.mockResolvedValueOnce(undefined);

		await expect(service.sweep()).resolves.toEqual({
			candidates: 2,
			deferred: 0,
			failed: 1,
			failures: [
				{
					message: "Google Sheets unavailable",
					projectId: "project-personal",
				},
			],
			skipped: 0,
			synced: 1,
			tokenFailed: 0,
			tokenFailedUsers: 0,
		});
		expect(syncService.syncProject).toHaveBeenCalledTimes(2);
	});

	it("counts a lost lock as a failed project", async () => {
		const { service, syncService } = buildService();
		syncService.syncProject.mockRejectedValueOnce(
			new LeadSheetSyncLockLostError(new Error("connection terminated")),
		);

		await expect(service.sweep()).resolves.toMatchObject({
			failed: 1,
			failures: [
				{
					message: "The lead sheet sync lock connection was lost",
					projectId: "project-personal",
				},
			],
			skipped: 0,
			synced: 0,
			tokenFailed: 0,
			tokenFailedUsers: 0,
		});
	});

	it("counts a busy project lock as skipped", async () => {
		const { service, syncService } = buildService();
		syncService.syncProject.mockRejectedValueOnce(new LeadSheetSyncBusyError());

		await expect(service.sweep()).resolves.toMatchObject({
			failed: 0,
			failures: [],
			skipped: 1,
			synced: 0,
			tokenFailed: 0,
			tokenFailedUsers: 0,
		});
	});

	it("does not pace after a pre-lock conflict", async () => {
		const secondPersonalCandidate = {
			...PERSONAL_CANDIDATE,
			projectId: "project-personal-second",
			projectName: "Second personal shop",
		};
		const { service, syncService } = buildService([
			PERSONAL_CANDIDATE,
			secondPersonalCandidate,
		]);
		const now = vi.fn(() => 0);
		const sleep = vi.fn(async () => undefined);
		syncService.syncProject.mockRejectedValueOnce(
			new ConflictException("Reconnect Google Sheets"),
		);

		await expect(service.sweep({ now, sleep })).resolves.toMatchObject({
			failed: 0,
			failures: [],
			skipped: 1,
			synced: 1,
			tokenFailed: 0,
			tokenFailedUsers: 0,
		});
		expect(syncService.syncProject).toHaveBeenCalledTimes(2);
		expect(sleep).not.toHaveBeenCalled();
	});

	it("counts token failures by user and skips later projects without pacing", async () => {
		const secondPersonalCandidate = {
			...PERSONAL_CANDIDATE,
			projectId: "project-personal-second",
			projectName: "Second personal shop",
		};
		const { service, syncService } = buildService([
			PERSONAL_CANDIDATE,
			secondPersonalCandidate,
			ORG_CANDIDATE,
		]);
		const now = vi.fn(() => 0);
		const sleep = vi.fn(async () => undefined);
		syncService.syncProject
			.mockRejectedValueOnce(
				new GoogleAccessTokenError(new Error("Google OAuth client mismatch")),
			)
			.mockRejectedValueOnce(
				new GoogleAccessTokenError(new Error("Google OAuth secret mismatch")),
			);

		await expect(service.sweep({ now, sleep })).resolves.toEqual({
			candidates: 3,
			deferred: 0,
			failed: 0,
			failures: [],
			skipped: 0,
			synced: 0,
			tokenFailed: 3,
			tokenFailedUsers: 2,
		});
		expect(syncService.syncProject).toHaveBeenCalledTimes(2);
		expect(sleep).not.toHaveBeenCalled();
		expect(Logger.prototype.warn).toHaveBeenCalledTimes(2);
		expect(Logger.prototype.warn).toHaveBeenCalledWith(
			"Lead sheet auto-sync could not mint a Google access token for user user-personal; 2 project(s) had token failures: Google OAuth client mismatch",
		);
		expect(Logger.prototype.warn).toHaveBeenCalledWith(
			"Lead sheet auto-sync could not mint a Google access token for user user-org-member; 1 project(s) had token failures: Google OAuth secret mismatch",
		);
	});

	it("counts a stale scheduled candidate as skipped", async () => {
		const { service, syncService } = buildService();
		syncService.syncProject.mockRejectedValueOnce(
			new LeadSheetSyncStaleError(),
		);

		await expect(service.sweep()).resolves.toMatchObject({
			failed: 0,
			failures: [],
			skipped: 1,
			synced: 0,
			tokenFailed: 0,
			tokenFailedUsers: 0,
		});
	});

	it("defers a 429 and every later project for that user without another call", async () => {
		const secondPersonalCandidate = {
			...PERSONAL_CANDIDATE,
			projectId: "project-personal-second",
			projectName: "Second personal shop",
		};
		const { service, syncService } = buildService([
			PERSONAL_CANDIDATE,
			secondPersonalCandidate,
			ORG_CANDIDATE,
		]);
		const now = vi.fn(() => 0);
		const sleep = vi.fn(async () => undefined);
		syncService.syncProject.mockRejectedValueOnce(
			new BadGatewayException("Google Sheets sync failed", {
				cause: new GoogleSheetsApiError(429, "write quota exceeded"),
			}),
		);

		await expect(service.sweep({ now, sleep })).resolves.toEqual({
			candidates: 3,
			deferred: 2,
			failed: 0,
			failures: [],
			skipped: 0,
			synced: 1,
			tokenFailed: 0,
			tokenFailedUsers: 0,
		});
		expect(syncService.syncProject).toHaveBeenCalledTimes(2);
		expect(syncService.syncProject).toHaveBeenNthCalledWith(
			2,
			{
				actorIsLimitExempt: false,
				kind: "org",
				organizationId: "org-1",
				userId: "user-org-member",
			},
			{ id: "project-org", name: "Organization shop" },
			"try",
			{ lastSyncedAt: ORG_CANDIDATE.lastSyncedAt },
		);
		expect(sleep).not.toHaveBeenCalled();
		expect(Logger.prototype.warn).toHaveBeenCalledWith(
			"Deferred 2 lead sheet project(s) for user user-personal after Google Sheets quota exhaustion",
		);
	});

	it("paces only repeated syncs for the same user", async () => {
		const secondPersonalCandidate = {
			...PERSONAL_CANDIDATE,
			projectId: "project-personal-second",
			projectName: "Second personal shop",
		};
		const { service, syncService } = buildService([
			PERSONAL_CANDIDATE,
			ORG_CANDIDATE,
			secondPersonalCandidate,
		]);
		let currentTime = 0;
		const now = vi.fn(() => currentTime);
		let markSleepEntered: (() => void) | undefined;
		let releaseSleep: (() => void) | undefined;
		const sleepEntered = new Promise<void>((resolve) => {
			markSleepEntered = resolve;
		});
		const sleep = vi.fn((milliseconds: number) => {
			return new Promise<void>((resolve) => {
				releaseSleep = () => {
					currentTime += milliseconds;
					resolve();
				};
				markSleepEntered?.();
			});
		});
		syncService.syncProject.mockImplementation(async () => {
			currentTime += 1_000;
			return {
				lastSyncedAt: new Date("2026-08-25T10:30:00.000Z"),
				spreadsheetId: "sheet-updated",
				spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-updated",
				syncedByUserId: "user-personal",
				syncedLeadCount: 3,
			};
		});

		const sweep = service.sweep({ now, sleep });
		await sleepEntered;
		expect(syncService.syncProject).toHaveBeenCalledTimes(2);
		if (!releaseSleep) {
			throw new Error("Expected the repeated user's pacing sleep to start");
		}
		releaseSleep();

		await expect(sweep).resolves.toMatchObject({
			deferred: 0,
			failed: 0,
			skipped: 0,
			synced: 3,
			tokenFailed: 0,
			tokenFailedUsers: 0,
		});
		expect(sleep).toHaveBeenCalledOnce();
		expect(sleep).toHaveBeenCalledWith(3_000);
	});

	it("defers every remaining project when the time budget is exhausted", async () => {
		const thirdCandidate = {
			...PERSONAL_CANDIDATE,
			projectId: "project-third",
			projectName: "Third shop",
		};
		const { service, syncService } = buildService([
			PERSONAL_CANDIDATE,
			ORG_CANDIDATE,
			thirdCandidate,
		]);
		const now = vi
			.fn<() => number>()
			.mockReturnValue(101)
			.mockReturnValueOnce(0)
			.mockReturnValueOnce(0)
			.mockReturnValueOnce(0);

		await expect(service.sweep({ budgetMs: 100, now })).resolves.toEqual({
			candidates: 3,
			deferred: 2,
			failed: 0,
			failures: [],
			skipped: 0,
			synced: 1,
			tokenFailed: 0,
			tokenFailedUsers: 0,
		});
		expect(syncService.syncProject).toHaveBeenCalledOnce();
		expect(syncService.syncProject).toHaveBeenCalledWith(
			{ kind: "personal", userId: "user-personal" },
			{ id: "project-personal", name: "Personal shop" },
			"try",
			{ lastSyncedAt: PERSONAL_CANDIDATE.lastSyncedAt },
		);
	});

	it("uses a 15-minute default sweep budget", async () => {
		const { service, syncService } = buildService([
			PERSONAL_CANDIDATE,
			ORG_CANDIDATE,
		]);
		const now = vi
			.fn<() => number>()
			.mockReturnValueOnce(0)
			.mockReturnValueOnce(15 * 60_000 + 1);

		await expect(service.sweep({ now })).resolves.toEqual({
			candidates: 2,
			deferred: 2,
			failed: 0,
			failures: [],
			skipped: 0,
			synced: 0,
			tokenFailed: 0,
			tokenFailedUsers: 0,
		});
		expect(syncService.syncProject).not.toHaveBeenCalled();
	});
});

/**
 * Finds attached lead sheets whose exported lead data changed and refreshes
 * them sequentially. Sequential writes are deliberate: Google's Sheets write
 * quota is per user per minute, and one project failure must not stop a sweep.
 */

import { ConflictException, Inject, Injectable, Logger } from "@nestjs/common";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import { GoogleSheetsApiError } from "../../infrastructure/google/google-sheets.client";
import {
	LeadSheetSyncBusyError,
	LeadSheetSyncsRepository,
} from "../../infrastructure/persistence/lead-sheet-syncs.repository";
import {
	GoogleAccessTokenError,
	isSheetsConnected,
	LeadSheetSyncService,
	LeadSheetSyncStaleError,
} from "./lead-sheet-sync.service";

const DEFAULT_SWEEP_BUDGET_MS = 15 * 60_000;
const MIN_GAP_PER_USER_MS = 5_000;

export type LeadSheetAutoSyncSummary = {
	candidates: number;
	deferred: number;
	failed: number;
	failures: Array<{ message: string; projectId: string }>;
	skipped: number;
	synced: number;
	tokenFailed: number;
	tokenFailedUsers: number;
};

type SweepOptions = {
	budgetMs?: number;
	now?: () => number;
	sleep?: (milliseconds: number) => Promise<void>;
};

@Injectable()
export class LeadSheetAutoSyncService {
	private readonly logger = new Logger(LeadSheetAutoSyncService.name);

	constructor(
		@Inject(LeadSheetSyncsRepository)
		private readonly syncsRepository: LeadSheetSyncsRepository,
		@Inject(LeadSheetSyncService)
		private readonly syncService: LeadSheetSyncService,
	) {}

	async sweep(options: SweepOptions = {}): Promise<LeadSheetAutoSyncSummary> {
		const now = options.now ?? Date.now;
		const sleep = options.sleep ?? defaultSleep;
		const startedAt = now();
		const budgetMs = options.budgetMs ?? DEFAULT_SWEEP_BUDGET_MS;
		const candidates = await this.syncsRepository.listDueForAutoSync();
		const userIds = [
			...new Set(candidates.map(({ syncedByUserId }) => syncedByUserId)),
		];
		const accounts = await this.syncsRepository.findGoogleAccounts(userIds);
		const summary: LeadSheetAutoSyncSummary = {
			candidates: candidates.length,
			deferred: 0,
			failed: 0,
			failures: [],
			skipped: 0,
			synced: 0,
			tokenFailed: 0,
			tokenFailedUsers: 0,
		};
		const lastSyncStartedAtByUser = new Map<string, number>();
		const quotaExhaustedUsers = new Set<string>();
		const quotaDeferredByUser = new Map<string, number>();
		const tokenFailedUserIds = new Set<string>();
		const tokenFailedByUser = new Map<string, number>();
		const tokenFailureMessageByUser = new Map<string, string>();

		for (const [index, candidate] of candidates.entries()) {
			const candidateStartedAt = now();
			if (candidateStartedAt - startedAt > budgetMs) {
				const budgetDeferred = candidates.length - index;
				summary.deferred += budgetDeferred;
				this.logger.warn(
					`Lead sheet auto-sync budget exhausted; deferred ${budgetDeferred} project(s)`,
				);
				break;
			}

			if (quotaExhaustedUsers.has(candidate.syncedByUserId)) {
				summary.deferred += 1;
				incrementCount(quotaDeferredByUser, candidate.syncedByUserId);
				continue;
			}

			if (tokenFailedUserIds.has(candidate.syncedByUserId)) {
				summary.tokenFailed += 1;
				incrementCount(tokenFailedByUser, candidate.syncedByUserId);
				continue;
			}

			if (!isSheetsConnected(accounts.get(candidate.syncedByUserId))) {
				summary.skipped += 1;
				this.logger.warn(
					`Skipping lead sheet auto-sync for project ${candidate.projectId}: the Google grant is gone; the merchant must reconnect`,
				);
				continue;
			}

			const scope: ProjectScope =
				candidate.organizationId !== null
					? {
							actorIsLimitExempt: false,
							kind: "org",
							organizationId: candidate.organizationId,
							userId: candidate.syncedByUserId,
						}
					: { kind: "personal", userId: candidate.syncedByUserId };

			const previousSyncStartedAt = lastSyncStartedAtByUser.get(
				candidate.syncedByUserId,
			);
			if (previousSyncStartedAt !== undefined) {
				const remaining =
					MIN_GAP_PER_USER_MS - (candidateStartedAt - previousSyncStartedAt);
				if (remaining > 0) {
					await sleep(remaining);
				}
			}
			lastSyncStartedAtByUser.set(candidate.syncedByUserId, now());

			try {
				await this.syncService.syncProject(
					scope,
					{ id: candidate.projectId, name: candidate.projectName },
					"try",
					{ lastSyncedAt: candidate.lastSyncedAt },
				);
				summary.synced += 1;
			} catch (error) {
				if (error instanceof LeadSheetSyncBusyError) {
					summary.skipped += 1;
					this.logger.warn(
						`Skipping lead sheet auto-sync for project ${candidate.projectId}: another sync is running`,
					);
					continue;
				}

				if (error instanceof LeadSheetSyncStaleError) {
					summary.skipped += 1;
					this.logger.warn(
						`Skipping lead sheet auto-sync for project ${candidate.projectId}: ${error.message}`,
					);
					continue;
				}

				if (error instanceof GoogleAccessTokenError) {
					lastSyncStartedAtByUser.delete(candidate.syncedByUserId);
					summary.tokenFailed += 1;
					tokenFailedUserIds.add(candidate.syncedByUserId);
					incrementCount(tokenFailedByUser, candidate.syncedByUserId);
					tokenFailureMessageByUser.set(
						candidate.syncedByUserId,
						errorCauseMessage(error),
					);
					continue;
				}

				if (error instanceof ConflictException) {
					lastSyncStartedAtByUser.delete(candidate.syncedByUserId);
					summary.skipped += 1;
					this.logger.warn(
						`Skipping lead sheet auto-sync for project ${candidate.projectId}: ${errorMessage(error)}`,
					);
					continue;
				}

				const googleError = googleSheetsApiCause(error);
				if (googleError?.status === 429) {
					quotaExhaustedUsers.add(candidate.syncedByUserId);
					summary.deferred += 1;
					incrementCount(quotaDeferredByUser, candidate.syncedByUserId);
					this.logger.warn(
						`Deferring lead sheet auto-sync for project ${candidate.projectId}: Google Sheets quota is exhausted`,
					);
					continue;
				}

				const message = errorMessage(error);
				summary.failed += 1;
				summary.failures.push({ message, projectId: candidate.projectId });
				this.logger.error(
					`Lead sheet auto-sync failed for project ${candidate.projectId}: ${message}`,
				);
			}
		}

		for (const [userId, deferred] of quotaDeferredByUser) {
			this.logger.warn(
				`Deferred ${deferred} lead sheet project(s) for user ${userId} after Google Sheets quota exhaustion`,
			);
		}

		for (const [userId, failed] of tokenFailedByUser) {
			this.logger.warn(
				`Lead sheet auto-sync could not mint a Google access token for user ${userId}; ${failed} project(s) had token failures: ${tokenFailureMessageByUser.get(userId)}`,
			);
		}
		summary.tokenFailedUsers = tokenFailedUserIds.size;

		return summary;
	}
}

function defaultSleep(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function errorCauseMessage(error: Error): string {
	return errorMessage(error.cause ?? error);
}

function googleSheetsApiCause(
	error: unknown,
): GoogleSheetsApiError | undefined {
	if (!(error instanceof Error)) {
		return undefined;
	}

	return error.cause instanceof GoogleSheetsApiError ? error.cause : undefined;
}

function incrementCount(counts: Map<string, number>, key: string): void {
	counts.set(key, (counts.get(key) ?? 0) + 1);
}

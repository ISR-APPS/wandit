// Service for the Page tab's read side: the overview the web polls while a
// build runs, and the HTML of one finished version.
//
// The controller receives HTTP, this service decides the steps, and the
// repository talks to the database. R2 access goes through the plain storage
// module (no Nest wrapper) because the Trigger.dev task shares it.
import {
	BadGatewayException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { runs } from "@trigger.dev/sdk";
import type {
	ListPageVersionsResponse,
	PageAttemptDetail,
	PageOverview,
	PageVersionHtml,
	RetryPageAttemptResponse,
	StopPageAttemptBody,
} from "@wandit/contracts";
import {
	pageBuildFailureCodeReadSchema,
	pageVersionSourceSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";

import { getPageHtml } from "../../../../infrastructure/storage/r2";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import { stampHtml } from "../../domain/stamp";
import {
	type PageAttemptDetailRow,
	PagesRepository,
} from "../../infrastructure/persistence/pages.repository";
import {
	isDefinitiveTriggerRejection,
	mintRealtimeHandle,
	triggerGeneratePageTask,
} from "../page-build-handoff";

@Injectable()
export class PagesService {
	private readonly logger = new Logger(PagesService.name);

	constructor(
		@Inject(PagesRepository)
		private readonly pagesRepository: PagesRepository,
	) {}

	// One request answers "what should the Page tab show right now?".
	async overview(
		scope: ProjectScope,
		projectId: string,
	): Promise<PageOverview> {
		const rows = await this.pagesRepository.findOverviewByProject(
			scope,
			projectId,
		);

		// Missing and not-owned both become 404 — never reveal which.
		if (!rows) {
			throw new NotFoundException();
		}

		// Map DB rows (Date) to the contract shape (ISO strings).
		return {
			activeVersion: rows.activeVersion
				? {
						createdAt: rows.activeVersion.createdAt.toISOString(),
						id: rows.activeVersion.id,
						number: rows.activeVersion.number,
					}
				: null,
			artifactId: rows.artifactId,
			latestAttempt: rows.latestAttempt
				? {
						createdAt: rows.latestAttempt.createdAt.toISOString(),
						error: rows.latestAttempt.error,
						failureCode: pageBuildFailureCodeReadSchema.parse(
							rows.latestAttempt.failureCode,
						),
						id: rows.latestAttempt.id,
						status: rows.latestAttempt.status,
						versionId: rows.latestAttempt.versionId,
					}
				: null,
		};
	}

	// Durable state of one build attempt — the chat card polls this while
	// queued/generating and reads it once more after any terminal state.
	async attemptDetail(
		scope: ProjectScope,
		projectId: string,
		attemptId: string,
	): Promise<PageAttemptDetail> {
		const row = await this.pagesRepository.findAttemptDetail(
			scope,
			projectId,
			attemptId,
		);

		if (!row) {
			throw new NotFoundException();
		}

		return mapAttemptDetail(row);
	}

	/**
	 * User Stop. Ownership first, then CAS queued/generating → canceled, then
	 * best-effort Trigger run cancellation. Idempotent: stopping an already
	 * terminal attempt just answers with current truth.
	 */
	async stopAttempt(
		scope: ProjectScope,
		projectId: string,
		attemptId: string,
		body: StopPageAttemptBody,
	): Promise<PageAttemptDetail> {
		const existing = await this.pagesRepository.findAttemptDetail(
			scope,
			projectId,
			attemptId,
		);

		if (!existing) {
			throw new NotFoundException();
		}

		const canceled = await this.pagesRepository.cancelAttempt(
			attemptId,
			body.observedPercent,
		);

		// Cancel the background run AFTER the row flip: the task's own catch
		// then sees a non-"generating" row and cannot overwrite the decision.
		const runId = canceled?.triggerRunId ?? null;

		if (canceled && runId && env.TRIGGER_SECRET_KEY) {
			try {
				await runs.cancel(runId);
			} catch (error) {
				// The row already says canceled; a failed remote cancel only means
				// the worker burns until its own abort signal / TTL catches up.
				this.logger.warn(
					`Trigger cancel for run ${runId} failed: ${
						error instanceof Error ? error.message : String(error)
					}`,
				);
			}
		}

		return this.attemptDetail(scope, projectId, attemptId);
	}

	/**
	 * Retry a failed build / resume a stopped one: SAME attempt row back to
	 * "queued" on a fresh Trigger run, with a fresh Realtime handle so the
	 * chat card follows the new run live. A concurrent double-click loses the
	 * CAS and simply gets current truth without a second run.
	 */
	async retryAttempt(
		scope: ProjectScope,
		projectId: string,
		attemptId: string,
	): Promise<RetryPageAttemptResponse> {
		const existing = await this.pagesRepository.findAttemptDetail(
			scope,
			projectId,
			attemptId,
		);

		if (!existing) {
			throw new NotFoundException();
		}

		const reset = await this.pagesRepository.resetAttemptForRetry(attemptId);

		if (!reset) {
			// Already running (double-click) or succeeded — answer with truth.
			return { attempt: await this.attemptDetail(scope, projectId, attemptId) };
		}

		let handle: { id: string };

		try {
			handle = await triggerGeneratePageTask({
				attemptId,
				...(scope.kind === "org" && scope.actorIsLimitExempt
					? { actorIsLimitExempt: true }
					: {}),
				actorUserId: scope.userId,
				// A fresh nonce per retry — the attempt-scoped global idempotency
				// key would otherwise resolve this queue to the original dead run.
				idempotencyNonce: crypto.randomUUID(),
				projectId,
			});
		} catch (error) {
			this.logger.error(
				`Retry handoff for attempt ${attemptId} failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);

			if (isDefinitiveTriggerRejection(error)) {
				await this.pagesRepository.markAttemptFailed(
					attemptId,
					"The background page builder rejected this retry. Please try again.",
					scope.userId,
				);

				throw new BadGatewayException(
					"The background builder rejected the retry",
				);
			}

			// Timeout/lost response: Trigger may still have accepted the queue.
			// Leave the row queued; the card's poll settles it either way.
			return { attempt: await this.attemptDetail(scope, projectId, attemptId) };
		}

		try {
			await this.pagesRepository.markAttemptTriggered(attemptId, handle.id);
		} catch (error) {
			this.logger.warn(
				`Could not persist run id for retried attempt ${attemptId}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}

		const realtime = await mintRealtimeHandle(handle.id, (message) =>
			this.logger.warn(message),
		);

		return {
			attempt: await this.attemptDetail(scope, projectId, attemptId),
			...(realtime ? { realtime } : {}),
		};
	}

	// Discard/Dismiss the terminal chat card. Idempotent by construction.
	async dismissAttempt(
		scope: ProjectScope,
		projectId: string,
		attemptId: string,
	): Promise<PageAttemptDetail> {
		const existing = await this.pagesRepository.findAttemptDetail(
			scope,
			projectId,
			attemptId,
		);

		if (!existing) {
			throw new NotFoundException();
		}

		await this.pagesRepository.dismissAttempt(attemptId);

		return this.attemptDetail(scope, projectId, attemptId);
	}

	// Full version history (Settings history, version switcher, rollback).
	async listVersions(
		scope: ProjectScope,
		projectId: string,
	): Promise<ListPageVersionsResponse> {
		const rows = await this.pagesRepository.listVersionsForProject(
			scope,
			projectId,
		);

		if (!rows) {
			throw new NotFoundException();
		}

		return {
			versions: rows.map((row) => ({
				createdAt: row.createdAt.toISOString(),
				id: row.id,
				isBuilderOrigin: versionIsBuilderOrigin(row.meta),
				isLive: row.isLive,
				label: versionLabel(row.meta),
				number: row.number,
				source: versionSource(row.meta),
			})),
		};
	}

	// Full HTML of one immutable version, fetched from R2.
	async versionHtml(
		scope: ProjectScope,
		versionId: string,
	): Promise<PageVersionHtml> {
		const version = await this.pagesRepository.findAccessibleVersionById(
			scope,
			versionId,
		);

		if (!version) {
			throw new NotFoundException();
		}

		const html = await getPageHtml(version.r2Key);

		// Row exists but the object is gone (or R2 unconfigured mid-flight):
		// treat as not found rather than a 500 — the client shows "no page".
		if (html === null) {
			throw new NotFoundException();
		}

		return { html: stampHtml(html), versionId: version.id };
	}
}

// DB row → contract shape. failureCode is re-validated through the tolerant
// read schema so an unknown stored code degrades to null, never a 500.
function mapAttemptDetail(row: PageAttemptDetailRow): PageAttemptDetail {
	return {
		completedAt: row.completedAt ? row.completedAt.toISOString() : null,
		createdAt: row.createdAt.toISOString(),
		dismissed: row.dismissedAt !== null,
		error: row.error,
		failureCode: pageBuildFailureCodeReadSchema.parse(row.failureCode),
		id: row.id,
		lastProgressPercent: row.lastProgressPercent,
		status: row.status,
		triggerRunId: row.triggerRunId,
		versionId: row.versionId,
	};
}

function versionIsBuilderOrigin(meta: unknown): boolean {
	const source =
		typeof meta === "object" && meta !== null
			? (meta as Record<string, unknown>).source
			: undefined;

	return source === "builder" || source === undefined || source === null;
}

function versionSource(meta: unknown) {
	if (typeof meta !== "object" || meta === null) {
		return null;
	}

	const parsed = pageVersionSourceSchema.safeParse(
		(meta as Record<string, unknown>).source,
	);

	return parsed.success ? parsed.data : null;
}

// Human summary from a version's build metadata: the builder's own summary
// when the AI generated it, an edit count for inline-editor batches.
function versionLabel(meta: unknown): string | null {
	if (typeof meta !== "object" || meta === null) {
		return null;
	}

	const record = meta as Record<string, unknown>;

	if (typeof record.builderSummary === "string" && record.builderSummary) {
		return record.builderSummary;
	}

	if (Array.isArray(record.ops) && record.ops.length > 0) {
		const count = record.ops.length;

		return count === 1 ? "1 manual edit" : `${count} manual edits`;
	}

	return null;
}

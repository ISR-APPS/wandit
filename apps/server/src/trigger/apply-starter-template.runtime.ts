/**
 * Apply-starter-template runtime: puts the files of one starter template in
 * the sandbox of a new project, and commits them as the first version with
 * the source `starter`. No agent turn runs.
 * `apply-starter-template.task.ts` calls `runApplyStarterTemplate` for each
 * attempt and `failStarterTemplateApply` after the last failed attempt. The spec calls both with fakes.
 */
import { randomUUID } from "node:crypto";
import { findStarterTemplate } from "@wandit/contracts/v2/starter-template-catalog";
import { getErrorMessage } from "@wandit/observability/error";

import type {
	SandboxLogger,
	SandboxReader,
} from "../modules/app-builder/domain/ports/sandbox-provider";
import type { TurnLock } from "../modules/app-builder/domain/ports/turn-lock";
import { starterTemplateNoteMessage } from "../modules/app-builder/domain/starter-template-note";
import { RESTORE_LOCK_HOLDER_PREFIX } from "../modules/app-builder/domain/turn-queue";
import type {
	CommitTurnDeps,
	commitTurn,
} from "../modules/app-builder/infrastructure/git/commit-turn";
import {
	type AppCommitsRepository,
	VERSIONS_PAGE_MAX,
} from "../modules/app-builder/infrastructure/persistence/app-commits.repository";
import type { SandboxSessionsRepository } from "../modules/app-builder/infrastructure/persistence/sandbox-sessions.repository";
import type { TurnProjectRepository } from "../modules/app-builder/infrastructure/persistence/turn-project.repository";
import { applyStarterTemplateArchive } from "../modules/app-builder/infrastructure/sandbox/starter-template-archive";
import type { ApplyStarterTemplateTaskInput } from "../modules/app-builder/infrastructure/trigger/trigger-apply-starter-template-task-starter";
import type { ChatsRepository } from "../modules/generation/infrastructure/persistence/chats.repository";
import type { ProjectsRepository } from "../modules/projects/infrastructure/persistence/projects.repository";

/**
 * 2 min, the TTL of the restore lock. The run refreshes the lock every
 * `APPLY_LOCK_REFRESH_MS`, so a slow sandbox boot keeps it. A dead worker
 * frees the project after this time.
 */
const APPLY_LOCK_TTL_MS = 2 * 60_000;
/** 40 s, a third of the TTL. After one failed refresh, the next one still comes 40 s before the lock ends. */
const APPLY_LOCK_REFRESH_MS = 40_000;

/**
 * `project_has_versions`: the project got a version before the apply.
 * `empty_archive`: the commit of the archive changed no file.
 */
type ApplyFailedReason = "project_has_versions" | "empty_archive";

/** The answer of one attempt. A thrown error is not an answer: Trigger.dev then runs the next attempt. */
export type ApplyStarterTemplateResult =
	| {
			outcome: "applied";
			/** The 40-hex sha of the commit that holds the starter template. */
			commitSha: string;
	  }
	/** The project is deleted, or `starter_template_id` does not hold this id. Nothing changed. */
	| { outcome: "skipped"; reason: "project_missing" | "not_pending" }
	/** No retry can help. The column is now NULL and the chat holds the failed note. */
	| { outcome: "failed"; reason: ApplyFailedReason };

/** The slice of the apply that the spec fakes. */
export type ApplyStarterTemplateDeps = {
	/** Gives `starterTemplateId`, the owner, and the workspace of the project. */
	turnProjects: Pick<TurnProjectRepository, "findForTurn">;
	/** The project turn lock. A chat turn that starts during the apply answers 409. */
	lock: Pick<TurnLock, "acquire" | "refresh" | "release">;
	/** Tells if the project has versions, if one of them is the starter template commit, and if a version changed a file. */
	appCommits: Pick<AppCommitsRepository, "hasFileChanges" | "listByProject">;
	/** Boots or wakes the project sandbox. The task binds `startSandboxWithoutTurn` with the harness key, so a new sandbox boots from the template snapshot. */
	startSandbox: (projectId: string) => Promise<SandboxReader>;
	/** The bytes of `starter-<id>.tar.gz` from the archive folder of the worker. Throws when the file is missing. */
	readArchive: (starterTemplateId: string) => Promise<Uint8Array>;
	/** `commitTurn` in the task. */
	commit: typeof commitTurn;
	commitDeps: CommitTurnDeps;
	chats: Pick<ChatsRepository, "insertUiMessagesIfAbsent">;
	projects: Pick<ProjectsRepository, "clearStarterTemplateId">;
	/** Queues the dashboard thumbnail of the commit. It never throws. */
	scheduleThumbnail: (projectId: string, commitSha: string) => Promise<void>;
	sandboxSessions: Pick<SandboxSessionsRepository, "touchActivity">;
	logger: SandboxLogger;
};

/**
 * The sha of the starter template commit of the project, with the count of
 * versions read. `commitTurn` finds its own commit only on HEAD, so this row
 * read is the check that still works after a later turn.
 */
// LIMIT: it reads the newest 50 versions. The task ends minutes after the create, and a project cannot hold 50 versions then. Upgrade: a query by source.
async function readStarterCommit(
	appCommits: ApplyStarterTemplateDeps["appCommits"],
	projectId: string,
): Promise<{ starterSha: string | null; versionCount: number }> {
	const { items } = await appCommits.listByProject(projectId, {
		limit: VERSIONS_PAGE_MAX,
	});
	return {
		starterSha: items.find((item) => item.source === "starter")?.sha ?? null,
		versionCount: items.length,
	};
}

// Stores the one note of the project. The message id comes from the project, so a second write is a no-op.
async function storeNote(
	deps: Pick<ApplyStarterTemplateDeps, "chats">,
	input: ApplyStarterTemplateTaskInput,
	status: "applied" | "failed",
): Promise<void> {
	await deps.chats.insertUiMessagesIfAbsent(
		input.chatId,
		[
			starterTemplateNoteMessage(input.projectId, {
				starterTemplateId: input.starterTemplateId,
				status,
			}),
		],
		null,
	);
}

/**
 * One attempt. It takes the project lock, applies the archive, commits, and
 * stores the `applied` note. A retry after a commit finds the commit row and
 * only stores the note. Throws on a held lock and on each failed step: the
 * lock is released first, and Trigger.dev runs the next attempt.
 */
export async function runApplyStarterTemplate(
	deps: ApplyStarterTemplateDeps,
	input: ApplyStarterTemplateTaskInput,
): Promise<ApplyStarterTemplateResult> {
	const { projectId, starterTemplateId } = input;
	const project = await deps.turnProjects.findForTurn(projectId);
	if (project === null) {
		deps.logger.info("starter-template.skipped", {
			projectId,
			reason: "project_missing",
		});
		return { outcome: "skipped", reason: "project_missing" };
	}
	// State rule: the column holds the id only while the apply is wanted. The
	// API clears it when the task handoff fails.
	if (project.starterTemplateId !== starterTemplateId) {
		deps.logger.info("starter-template.skipped", {
			projectId,
			reason: "not_pending",
		});
		return { outcome: "skipped", reason: "not_pending" };
	}

	// The `restore:` holder makes a chat turn answer 409. With another holder,
	// `TurnsService` parks a turn that nothing starts later.
	const lockId = `${RESTORE_LOCK_HOLDER_PREFIX}starter-${randomUUID()}`;
	if (!(await deps.lock.acquire(projectId, lockId, APPLY_LOCK_TTL_MS))) {
		throw new Error(
			`The lock of project ${projectId} is held; the starter template waits for the next attempt`,
		);
	}
	// The short TTL frees the project soon after a lost worker. While the
	// attempt runs, this timer keeps the lock.
	const lockRefresh = setInterval(() => {
		void deps.lock
			.refresh(projectId, lockId, APPLY_LOCK_TTL_MS)
			.then((isRefreshed) => {
				if (!isRefreshed) {
					deps.logger.warn("starter-template.lock-lost", { projectId });
				}
			})
			.catch((error: unknown) => {
				deps.logger.warn("starter-template.lock-refresh-failed", {
					error: getErrorMessage(error),
					projectId,
				});
			});
	}, APPLY_LOCK_REFRESH_MS);

	let applied: LockedApplyResult;
	try {
		applied = await applyUnderLock(deps, input, {
			organizationId: project.organizationId,
			userId: project.userId,
		});
	} finally {
		// A refresh after the release would find no lock and log a false loss.
		clearInterval(lockRefresh);
		// A failed release frees at the lock TTL; it must not hide the result.
		await deps.lock.release(projectId, lockId).catch((error: unknown) => {
			deps.logger.warn("starter-template.lock-release-failed", {
				error: getErrorMessage(error),
				projectId,
			});
		});
	}
	if ("failedReason" in applied) {
		return { outcome: "failed", reason: applied.failedReason };
	}
	const { commitSha } = applied;

	// After the lock release, as a turn does: these two calls must not delay
	// the first chat turn.
	await deps.scheduleThumbnail(projectId, commitSha);
	try {
		// The idle sweep counts its 20 minutes from this stamp.
		await deps.sandboxSessions.touchActivity(projectId);
	} catch (error) {
		// The sandbox boot already wrote a stamp, so a lost one only logs.
		deps.logger.warn("starter-template.activity-stamp-failed", {
			error: getErrorMessage(error),
			projectId,
		});
	}
	deps.logger.info("starter-template.applied", {
		commitSha,
		projectId,
		starterTemplateId,
	});
	return { outcome: "applied", commitSha };
}

// What `applyUnderLock` answers: the sha of the starter template commit, or
// the reason why the project cannot get the starter template.
type LockedApplyResult =
	| { commitSha: string }
	| { failedReason: ApplyFailedReason };

/**
 * The work that needs the lock. On a failed reason, the column is already
 * NULL and the chat already holds the failed note.
 */
async function applyUnderLock(
	deps: ApplyStarterTemplateDeps,
	input: ApplyStarterTemplateTaskInput,
	owner: {
		/** The project creator. The commit row names this user. */
		userId: string;
		/** Org workspace of the project, or null for a personal project. */
		organizationId: string | null;
	},
): Promise<LockedApplyResult> {
	const { chatId, messageId, projectId, starterTemplateId } = input;
	const existing = await readStarterCommit(deps.appCommits, projectId);
	let commitSha = existing.starterSha;
	if (commitSha === null) {
		// State rule: the archive goes only on a project with no version. A turn
		// that started before the task took the lock already built an app, and
		// the files of the starter template would replace its work.
		if (existing.versionCount > 0) {
			deps.logger.warn("starter-template.project-has-versions", { projectId });
			await endWithFailedNote(deps, input);
			return { failedReason: "project_has_versions" };
		}

		const sandbox = await deps.startSandbox(projectId);
		await applyStarterTemplateArchive(sandbox, {
			bytes: await deps.readArchive(starterTemplateId),
			starterTemplateId,
		});
		// `commitTurn`, not `commitTurnUnlessClean`: after a failed push, the
		// tree is clean but the commit row is missing. The trailer check then
		// skips the commit and the call writes the rest.
		const result = await deps.commit(sandbox, deps.commitDeps, {
			chatId,
			messageId,
			organizationId: owner.organizationId,
			projectId,
			source: "starter",
			summary: `Start from the template ${findStarterTemplate(starterTemplateId)?.name ?? starterTemplateId}`,
			turnId: null,
			userId: owner.userId,
		});
		commitSha = result.sha;
	}
	// State rule: the web waits until `hasCodeChanges` of the project answer is
	// true, and this is the same read. `commitTurn` also commits an archive
	// that changes no file. A retry cannot change that, so the apply ends here.
	if (!(await deps.appCommits.hasFileChanges(projectId))) {
		deps.logger.error("starter-template.empty-archive", {
			commitSha,
			projectId,
			starterTemplateId,
		});
		await endWithFailedNote(deps, input);
		return { failedReason: "empty_archive" };
	}
	await storeNote(deps, input, "applied");
	return { commitSha };
}

// Ends an apply that no retry can help. The note goes first: when its write
// throws, the column is still set, so the next attempt comes here again.
// With the column cleared first, that attempt skips and the chat gets no note.
async function endWithFailedNote(
	deps: Pick<ApplyStarterTemplateDeps, "chats" | "projects">,
	input: ApplyStarterTemplateTaskInput,
): Promise<void> {
	await storeNote(deps, input, "failed");
	await deps.projects.clearStarterTemplateId(
		input.projectId,
		input.starterTemplateId,
	);
}

/**
 * The end of a run that failed its last attempt. The column is then NULL and
 * the chat holds the failed note. The sandbox can still hold files of the
 * starter template. When the commit row exists and changed a file, the files
 * are in the project: it stores the `applied` note and keeps the column.
 */
// LIMIT: the sandbox can keep the files of a failed apply, and the next turn commits them. Upgrade: reset the workspace to the template commit before the last attempt ends.
export async function failStarterTemplateApply(
	deps: Pick<
		ApplyStarterTemplateDeps,
		"appCommits" | "chats" | "logger" | "projects"
	>,
	input: ApplyStarterTemplateTaskInput,
): Promise<void> {
	const { projectId, starterTemplateId } = input;
	const { starterSha } = await readStarterCommit(deps.appCommits, projectId);
	// The same state rule as the attempt: a commit that changed no file is not
	// an applied starter template.
	if (
		starterSha !== null &&
		(await deps.appCommits.hasFileChanges(projectId))
	) {
		await storeNote(deps, input, "applied");
		return;
	}
	// The note goes first: the NULL column ends the wait of the web, and the
	// web then loads the chat one time. No attempt follows, so a failed note
	// write only logs, and the clear always runs.
	try {
		await storeNote(deps, input, "failed");
	} catch (error) {
		deps.logger.error("starter-template.failed-note-not-stored", {
			error: getErrorMessage(error),
			projectId,
			starterTemplateId,
		});
	}
	await deps.projects.clearStarterTemplateId(projectId, starterTemplateId);
	deps.logger.error("starter-template.failed", {
		projectId,
		starterTemplateId,
	});
}

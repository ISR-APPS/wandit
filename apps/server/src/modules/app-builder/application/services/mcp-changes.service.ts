/**
 * The `apply_changes` MCP tool: direct file edits of an external coding agent, as one commit with source "mcp".
 * `McpTools` calls `apply` after it proves project access and the `project:update` role.
 * It copies the `AppThemeService.save` flow: the turn lock, the sandbox HEAD check, `commitTurn`, and the undo.
 * The files go through the guarded write script, because the sandbox hook does not see these writes.
 */
import { randomUUID } from "node:crypto";

import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type { McpApplyChangesInput } from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import { isWritableCodePath } from "../../domain/code-tree";
import { GIT_STORE, type GitStore } from "../../domain/ports/git-store";
import {
	SANDBOX_PROVIDER,
	type SandboxProvider,
	type SandboxReader,
} from "../../domain/ports/sandbox-provider";
import { TURN_LOCK, type TurnLock } from "../../domain/ports/turn-lock";
import {
	TURN_TASK_STARTER,
	type TurnTaskStarter,
} from "../../domain/ports/turn-task-starter";
import { RESTORE_LOCK_HOLDER_PREFIX } from "../../domain/turn-queue";
import {
	CommitTurnError,
	commitTurn,
} from "../../infrastructure/git/commit-turn";
import { mustRunGit } from "../../infrastructure/git/sandbox-git";
import {
	AppCommitsRepository,
	VersionConflictError,
} from "../../infrastructure/persistence/app-commits.repository";
import { BuilderTurnsRepository } from "../../infrastructure/persistence/builder-turns.repository";
import {
	applyGuardedWrites,
	stageGuardedWrites,
} from "../../infrastructure/sandbox/guarded-file-writes";
import { TurnPromoter } from "./turn-promotion";
import { VERSION_OBJECTS, type VersionsObjectStore } from "./versions.service";

/**
 * 60 s. One call writes at most 50 files, then commits and pushes once: a few seconds.
 * The call refreshes the lock, and a dead API process frees it after this time.
 */
const CHANGES_LOCK_TTL_MS = 60_000;
/** 20 s, a third of the TTL: one missed refresh does not lose the lock. */
const CHANGES_LOCK_REFRESH_MS = 20_000;

/** The answer of `apply_changes`. */
export type McpApplyChangesResult = {
	/** The new sandbox HEAD. The next `apply_changes` sends it as `expectedHeadSha`. */
	headSha: string;
};

/** Holds the project turn lock for each edit. So an edit and a builder turn never run at the same time. */
@Injectable()
export class McpChangesService {
	private readonly logger = new Logger(McpChangesService.name);
	private readonly promoter: TurnPromoter;

	constructor(
		// The Pick types keep each seam at the methods the service needs.
		// A spec passes plain fakes. Nest still injects by the token.
		@Inject(AppCommitsRepository)
		private readonly appCommits: Pick<
			AppCommitsRepository,
			"findScopedProject" | "findBranch" | "insert" | "upsertBranchHead"
		>,
		@Inject(SANDBOX_PROVIDER)
		private readonly sandboxes: Pick<SandboxProvider, "findRunning">,
		@Inject(TURN_LOCK)
		private readonly turnLock: TurnLock,
		@Inject(GIT_STORE)
		private readonly gitStore: GitStore,
		@Inject(VERSION_OBJECTS)
		private readonly objects: Pick<VersionsObjectStore, "putPatch">,
		@Inject(BuilderTurnsRepository)
		private readonly turns: Pick<
			BuilderTurnsRepository,
			| "findWaitingForUser"
			| "promoteOldestWaiting"
			| "setTriggerRunId"
			| "transition"
		>,
		@Inject(TURN_TASK_STARTER)
		starter: TurnTaskStarter,
	) {
		this.promoter = new TurnPromoter(turns, turnLock, starter);
	}

	/**
	 * The HEAD sha of the running sandbox, or null when no sandbox runs. `get_project` shows it,
	 * and `apply_changes` takes it back as `expectedHeadSha`. The caller proves project access first.
	 */
	async sandboxHead(projectId: string): Promise<string | null> {
		const sandbox = await this.sandboxes.findRunning(projectId);
		if (sandbox === null) {
			return null;
		}
		return (
			await mustRunGit(sandbox, ["rev-parse", "HEAD"], Error)
		).stdout.trim();
	}

	/**
	 * Writes and deletes the files, then commits exactly these paths. It never boots a sandbox.
	 * 400 PATH_NOT_ALLOWED or FILE_NOT_FOUND, 404 PROJECT_NOT_FOUND, and 409 BUILDER_TURN_RUNNING,
	 * BUILDER_TURN_WAITING, SANDBOX_NOT_RUNNING, or HEAD_MOVED. A failed apply pass, git command, or push
	 * puts HEAD and the changed paths back to `expectedHeadSha`. A failed staging or a check-pass refusal changes nothing.
	 */
	async apply(
		scope: ProjectScope,
		input: McpApplyChangesInput,
	): Promise<McpApplyChangesResult> {
		const { projectId } = input;
		const project = await this.appCommits.findScopedProject(scope, projectId);
		if (project?.engine !== "v2_app") {
			throw new NotFoundException({
				code: "PROJECT_NOT_FOUND",
				message: "Project not found",
			});
		}
		// Security check: the sandbox hook does not see these writes, so the API applies the deny list.
		const blocked = input.changes.find(
			(change) => !isWritableCodePath(change.path),
		);
		if (blocked !== undefined) {
			throw pathNotAllowed(blocked.path);
		}

		// Product rule: an edit while a turn runs would commit next to the turn's git commands.
		// The restore prefix makes a turn submit answer 409 instead of parking a turn that nothing promotes.
		const changeId = randomUUID();
		const lockId = `${RESTORE_LOCK_HOLDER_PREFIX}mcp-${changeId}`;
		if (
			!(await this.turnLock.acquire(projectId, lockId, CHANGES_LOCK_TTL_MS))
		) {
			throw new ConflictException({
				code: "BUILDER_TURN_RUNNING",
				message:
					"A builder turn, a restore, or a sandbox wake is running for this project",
			});
		}
		// The short TTL frees the project soon after a lost API process. While the call runs,
		// this timer keeps the lock alive.
		// LIMIT: an API restart during an edit blocks the project for up to 60 s.
		// Upgrade: run the edit in a Trigger task.
		const lockRefresh = setInterval(() => {
			void this.turnLock
				.refresh(projectId, lockId, CHANGES_LOCK_TTL_MS)
				.then((refreshed) => {
					if (!refreshed) {
						this.logger.warn("mcp.changes-lock-lost", { projectId });
					}
				})
				.catch((error: unknown) => {
					this.logger.warn("mcp.changes-lock-refresh-failed", {
						error: getErrorMessage(error),
						projectId,
					});
				});
		}, CHANGES_LOCK_REFRESH_MS);

		try {
			// Product rule: a turn paused on a question resumes on the files it saw.
			if ((await this.turns.findWaitingForUser(projectId)) !== null) {
				throw new ConflictException({
					code: "BUILDER_TURN_WAITING",
					message:
						"A builder turn waits for an answer in the chat. Answer it or cancel the turn first",
				});
			}
			// Product rule: an edit never boots a sandbox. The agent calls wake_sandbox first.
			const sandbox = await this.sandboxes.findRunning(projectId);
			if (sandbox === null) {
				throw new ConflictException({
					code: "SANDBOX_NOT_RUNNING",
					message:
						"The sandbox is not running. Call wake_sandbox, then try again",
				});
			}
			const headSha = (
				await mustRunGit(sandbox, ["rev-parse", "HEAD"], Error)
			).stdout.trim();
			if (headSha !== input.expectedHeadSha) {
				throw headMoved();
			}

			const paths = input.changes.map((change) => change.path);
			const tracked = await trackedPathsAt(sandbox, headSha, paths);
			// `git add` stages the removal of a tracked file only. An untracked path has nothing to delete.
			const missing = input.changes.find(
				(change) => "delete" in change && !tracked.has(change.path),
			);
			if (missing !== undefined) {
				throw new BadRequestException({
					code: "FILE_NOT_FOUND",
					message: `The saved version holds no file at this path: ${missing.path}`,
				});
			}

			// The staging writes only to /tmp. A throw here leaves the worktree as it was, so no undo runs.
			const staging = await stageGuardedWrites(sandbox, input.changes);
			const refusal = await applyGuardedWrites(
				sandbox,
				staging,
				input.changes,
			).catch(async (error: unknown) => {
				// A failed or timed-out apply pass can leave earlier changes written.
				await this.undoChanges(sandbox, headSha, paths, tracked);
				throw error;
			});
			if (refusal !== null) {
				// A check-pass refusal wrote nothing. An undo would then restore or delete files that the agent did not write.
				if (refusal.pass === "apply") {
					await this.undoChanges(sandbox, headSha, paths, tracked);
				}
				throw pathNotAllowed(refusal.path);
			}
			try {
				const result = await commitTurn(
					sandbox,
					{
						appCommits: this.appCommits,
						gitStore: this.gitStore,
						putPatch: this.objects.putPatch,
					},
					{
						chatId: null,
						messageId: `mcp-${changeId}`,
						organizationId: project.organizationId,
						// Only these paths: the files of a failed turn stay for the next turn commit.
						paths,
						projectId,
						source: "mcp",
						summary: input.message,
						turnId: null,
						userId: scope.userId,
					},
				);
				return { headSha: result.sha };
			} catch (error) {
				// A CommitTurnError comes from a git command or from the push, so code.storage never got
				// the commit. After another failure, code.storage can hold the commit. Then the commit
				// and the new files stay, so the worktree matches HEAD.
				if (error instanceof CommitTurnError) {
					await this.undoChanges(sandbox, headSha, paths, tracked);
				}
				if (error instanceof VersionConflictError) {
					throw headMoved();
				}
				throw error;
			}
		} finally {
			// A refresh after the release would find no lock and log a false loss.
			clearInterval(lockRefresh);
			// A failed release frees at the lock TTL; it must not mask the result.
			await this.turnLock.release(projectId, lockId).catch((error: unknown) => {
				this.logger.warn("mcp.changes-lock-release-failed", {
					error: getErrorMessage(error),
					projectId,
				});
			});
			// A turn that parked while the lock was held starts now. promoteNext returns null when none waits.
			await this.promoter.promoteNext(projectId).catch((error: unknown) => {
				this.logger.warn("mcp.changes-promote-failed", {
					error: getErrorMessage(error),
					projectId,
				});
			});
		}
	}

	// Moves HEAD and the index back to `headSha`, restores each tracked path from it, and removes
	// each new path. A mixed reset keeps the other worktree files: the files of a failed turn stay.
	// A tracked path also loses an uncommitted edit of a failed turn: the agent wrote over it.
	private async undoChanges(
		sandbox: SandboxReader,
		headSha: string,
		paths: string[],
		tracked: Set<string>,
	): Promise<void> {
		const restored = paths.filter((path) => tracked.has(path));
		const added = paths.filter((path) => !tracked.has(path));
		try {
			await mustRunGit(sandbox, ["reset", "--quiet", headSha], Error);
			// Security: a fixed label keeps the agent's paths out of the error text, the log, and Sentry.
			if (restored.length > 0) {
				await mustRunGit(
					sandbox,
					["--literal-pathspecs", "checkout", headSha, "--", ...restored],
					Error,
					{ label: "git checkout" },
				);
			}
			if (added.length > 0) {
				// `-x`: a new file under an ignored folder is also removed.
				await mustRunGit(
					sandbox,
					["--literal-pathspecs", "clean", "-f", "-q", "-x", "--", ...added],
					Error,
					{ label: "git clean" },
				);
			}
		} catch (error) {
			// The first error goes to the caller. The agent then reads the project again.
			this.logger.warn("mcp.changes-undo-failed", {
				error: getErrorMessage(error),
				projectId: sandbox.projectId,
			});
		}
	}
}

/**
 * The paths that the commit `sha` holds as files. `--literal-pathspecs` reads each path as a file
 * name, so a path such as `src/*` matches no other file.
 */
async function trackedPathsAt(
	sandbox: SandboxReader,
	sha: string,
	paths: string[],
): Promise<Set<string>> {
	const listed = await mustRunGit(
		sandbox,
		[
			"--literal-pathspecs",
			"ls-tree",
			"-r",
			"-z",
			"--name-only",
			sha,
			"--",
			...paths,
		],
		Error,
		// Security: the agent's paths stay out of the error text that `reportServerError` sends to Sentry.
		{ label: "git ls-tree" },
	);
	const files = new Set(listed.stdout.split("\0"));
	return new Set(paths.filter((path) => files.has(path)));
}

function pathNotAllowed(path: string): BadRequestException {
	return new BadRequestException({
		code: "PATH_NOT_ALLOWED",
		message: `An agent may not change this path: ${path}`,
	});
}

function headMoved(): ConflictException {
	return new ConflictException({
		code: "HEAD_MOVED",
		message:
			"The project changed after expectedHeadSha. Call get_project for the new head",
	});
}

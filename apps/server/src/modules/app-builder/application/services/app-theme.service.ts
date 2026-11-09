/**
 * Application service behind the theme routes of the builder Thème sheet.
 * `ThemeController` calls `get` to read src/styles/theme.json and `save` to write a user selection.
 * `get` reads the running sandbox, else the stored `main` head on code.storage through `GitFileReader`.
 * `save` takes the project turn lock, writes the file through app-theme-file.ts, and commits only
 * that file through `commitTurn`. Every method first proves the project is a scoped `v2_app` row.
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
import {
	APP_THEME_TEMPLATE_SELECTION,
	type AppThemeFile,
	buildAppThemeFile,
	type GetAppThemeResponse,
	type PutAppThemeBody,
	type PutAppThemeResponse,
} from "@wandit/contracts/v2/app-theme";
import { getErrorMessage } from "@wandit/observability/error";

import { worldCardOf } from "../../../ai-chat/agent/worlds";
import type { ProjectScope } from "../../../projects/domain/project-scope";
import {
	fallbackThemeSelection,
	isThemeEditable,
} from "../../domain/app-theme-deal";
import {
	GIT_FILE_READER,
	GIT_STORE,
	type GitFileReader,
	type GitStore,
} from "../../domain/ports/git-store";
import {
	GITHUB_SYNC_SCHEDULER,
	type GithubSyncScheduler,
} from "../../domain/ports/github-sync-scheduler";
import {
	SANDBOX_PROVIDER,
	type SandboxProvider,
	type SandboxReader,
} from "../../domain/ports/sandbox-provider";
import { TURN_LOCK, type TurnLock } from "../../domain/ports/turn-lock";
import { RESTORE_LOCK_HOLDER_PREFIX } from "../../domain/turn-queue";
import {
	CommitTurnError,
	commitTurn,
} from "../../infrastructure/git/commit-turn";
import { mustRunGit } from "../../infrastructure/git/sandbox-git";
import {
	AppCommitsRepository,
	type ScopedAppProject,
	VersionConflictError,
} from "../../infrastructure/persistence/app-commits.repository";
import { BuilderTurnsRepository } from "../../infrastructure/persistence/builder-turns.repository";
import {
	APP_THEME_FILE_PATH,
	parseAppThemeFileText,
	readAppThemeFile,
	writeAppThemeFile,
} from "../../infrastructure/sandbox/app-theme-file";
import { VERSION_OBJECTS, type VersionsObjectStore } from "./versions.service";

/**
 * 60 s. A save takes a few seconds: one file write, one commit, and one push.
 * The save refreshes the lock, and a dead API process frees it after this time.
 */
const THEME_LOCK_TTL_MS = 60_000;
/** 20 s, a third of the TTL: one missed refresh does not lose the lock. */
const THEME_LOCK_REFRESH_MS = 20_000;

/** The theme read and the theme save of the builder. */
@Injectable()
export class AppThemeService {
	private readonly logger = new Logger(AppThemeService.name);

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
		@Inject(GIT_FILE_READER)
		private readonly gitFiles: GitFileReader,
		@Inject(VERSION_OBJECTS)
		private readonly objects: Pick<VersionsObjectStore, "putPatch">,
		@Inject(BuilderTurnsRepository)
		private readonly turns: Pick<BuilderTurnsRepository, "findWaitingForUser">,
		// `commitTurn` schedules the GitHub push of a linked project after the theme commit.
		@Inject(GITHUB_SYNC_SCHEDULER)
		private readonly githubSync: GithubSyncScheduler,
	) {}

	/**
	 * The theme, the card of its world, and the commit it comes from. A running sandbox gives its
	 * worktree file and HEAD. Without one, the file comes from the stored `main` head on code.storage.
	 * 409 PREVIEW_NOT_RUNNING when no sandbox runs and the project has no stored head.
	 */
	async get(
		scope: ProjectScope,
		projectId: string,
	): Promise<GetAppThemeResponse> {
		const project = await this.requireV2Project(scope, projectId);
		const editable = isThemeEditable(project);
		const { file, headSha } = await this.readCurrent(projectId, editable);
		const theme = file ?? defaultThemeOf(projectId, editable);
		const { source } = theme.selection;
		return {
			editable,
			headSha,
			theme,
			world:
				source.kind === "world" ? (worldCardOf(source.world) ?? null) : null,
		};
	}

	/**
	 * Writes the selection as theme.json with origin "user", and commits only that file with source
	 * "theme" and the message "Theme: <name>". The body name, when given, replaces the default name.
	 * It never boots a sandbox. 409 answers:
	 * BUILDER_TURN_RUNNING while a turn or a restore holds the lock, BUILDER_TURN_WAITING while a turn
	 * waits for the user, PREVIEW_NOT_RUNNING without a running sandbox, and THEME_HEAD_MOVED when the
	 * sandbox HEAD is not `expectedHeadSha`, or when the head CAS fails after the push.
	 * A failed git command or push puts the sandbox HEAD and theme.json back as they were.
	 */
	async save(
		scope: ProjectScope,
		projectId: string,
		body: PutAppThemeBody,
	): Promise<PutAppThemeResponse> {
		const project = await this.requireV2Project(scope, projectId);
		// Product rule: only a web-app@1.1.0+ or desktop-app@1.0.0+ project has a theme file. The GET answers other projects as not editable.
		if (!isThemeEditable(project)) {
			throw new NotFoundException();
		}
		const { source } = body.selection;
		// The schema accepts any world id. Only a world with a preview has the poles that the resolver needs.
		const world =
			source.kind === "world" ? worldCardOf(source.world) : undefined;
		if (source.kind === "world" && world === undefined) {
			throw new BadRequestException({
				code: "VALIDATION_ERROR",
				message: `No design world "${source.world}" with a preview`,
			});
		}
		// `name` comes from an AI theme draft. Without it, the file takes the look, world, or seeds name.
		const file = buildAppThemeFile({
			name: body.name,
			origin: "user",
			selection: body.selection,
			world,
		});

		// Product rule: a save while a turn runs would commit next to the turn's git commands.
		// The restore prefix makes a turn submit answer 409 instead of parking a turn that nothing promotes.
		const saveId = randomUUID();
		const lockId = `${RESTORE_LOCK_HOLDER_PREFIX}theme-${saveId}`;
		if (!(await this.turnLock.acquire(projectId, lockId, THEME_LOCK_TTL_MS))) {
			throw new ConflictException({
				code: "BUILDER_TURN_RUNNING",
				message: "A builder turn or a restore is running for this project",
			});
		}
		// The short TTL frees the project soon after a lost API process. While the save runs,
		// this timer keeps the lock alive.
		// LIMIT: an API restart during a theme save blocks the project for up to 60 s.
		// Upgrade: run the save in a Trigger task.
		const lockRefresh = setInterval(() => {
			void this.turnLock
				.refresh(projectId, lockId, THEME_LOCK_TTL_MS)
				.then((refreshed) => {
					if (!refreshed) {
						this.logger.warn("theme.save-lock-lost", { projectId });
					}
				})
				.catch((error: unknown) => {
					this.logger.warn("theme.save-lock-refresh-failed", {
						error: getErrorMessage(error),
						projectId,
					});
				});
		}, THEME_LOCK_REFRESH_MS);

		try {
			// Product rule: a turn paused on a question resumes on the files it saw. A theme
			// question answer also writes theme.json, after this save.
			if ((await this.turns.findWaitingForUser(projectId)) !== null) {
				throw new ConflictException({
					code: "BUILDER_TURN_WAITING",
					message: "Answer the open question in the chat first",
				});
			}
			// Product rule: a save never boots a sandbox. The Thème sheet shows the theme in the live preview.
			const sandbox = await this.sandboxes.findRunning(projectId);
			if (sandbox === null) {
				throw previewNotRunning();
			}
			if ((await sandboxHeadOf(sandbox)) !== body.expectedHeadSha) {
				throw themeHeadMoved();
			}

			const previous = await readAppThemeFile(sandbox);
			await writeAppThemeFile(sandbox, file);
			try {
				const result = await commitTurn(
					sandbox,
					{
						appCommits: this.appCommits,
						githubSync: this.githubSync,
						gitStore: this.gitStore,
						putPatch: this.objects.putPatch,
					},
					{
						chatId: null,
						messageId: `theme-${saveId}`,
						organizationId: project.organizationId,
						// Only the theme file: the files of a failed turn stay for the next turn commit.
						paths: [APP_THEME_FILE_PATH],
						projectId,
						source: "theme",
						summary: `Theme: ${file.name}`,
						turnId: null,
						userId: scope.actorUserId,
					},
				);
				return { headSha: result.sha, theme: file };
			} catch (error) {
				// A CommitTurnError comes from a git command or from the push, so code.storage never got
				// the theme commit. After another failure, code.storage can hold the commit. Then the commit
				// and the new file stay, so theme.json matches HEAD.
				if (error instanceof CommitTurnError) {
					await this.undoThemeSave(
						sandbox,
						body.expectedHeadSha,
						previous?.file ?? null,
					);
				}
				if (error instanceof VersionConflictError) {
					throw themeHeadMoved();
				}
				throw error;
			}
		} finally {
			// A refresh after the release would find no lock and log a false loss.
			clearInterval(lockRefresh);
			// A failed release frees at the lock TTL; it must not mask the save result.
			await this.turnLock.release(projectId, lockId).catch((error: unknown) => {
				this.logger.warn("theme.save-lock-release-failed", {
					error: getErrorMessage(error),
					projectId,
				});
			});
		}
	}

	// The theme file and its commit: the worktree and HEAD of a running sandbox, else the file at the
	// stored `main` head. With `withFile` false, it reads only the head.
	private async readCurrent(
		projectId: string,
		withFile: boolean,
	): Promise<{ file: AppThemeFile | null; headSha: string }> {
		const sandbox = await this.sandboxes.findRunning(projectId);
		if (sandbox !== null) {
			return {
				file: withFile
					? ((await readAppThemeFile(sandbox))?.file ?? null)
					: null,
				headSha: await sandboxHeadOf(sandbox),
			};
		}
		const headSha =
			(await this.appCommits.findBranch(projectId, "main"))?.headSha ?? null;
		// No sandbox and no stored version: no copy of the code exists to read.
		if (headSha === null) {
			throw previewNotRunning();
		}
		const bytes = withFile
			? await this.gitFiles.readFile(projectId, headSha, APP_THEME_FILE_PATH)
			: null;
		return {
			file:
				bytes === null
					? null
					: parseAppThemeFileText(new TextDecoder().decode(bytes)),
			headSha,
		};
	}

	// Moves HEAD and the index back to `headSha` and writes the old file back. The sandbox is then as
	// before the save. Without a theme commit, HEAD is already at `headSha` and the reset moves nothing.
	// A mixed reset keeps every worktree file: the files of a failed turn stay for the next turn commit.
	// A missing or broken old file stays replaced: the app cannot load it.
	private async undoThemeSave(
		sandbox: SandboxReader,
		headSha: string,
		previous: AppThemeFile | null,
	): Promise<void> {
		try {
			await mustRunGit(sandbox, ["reset", "--quiet", headSha], Error);
			if (previous !== null) {
				await writeAppThemeFile(sandbox, previous);
			}
		} catch (error) {
			// The commit error goes to the caller. After a failed reset, the new file stays to match HEAD.
			this.logger.warn("theme.save-undo-failed", {
				error: getErrorMessage(error),
				projectId: sandbox.projectId,
			});
		}
	}

	// The project must exist inside the caller's scope and be a V2 app; a
	// V1 project or another workspace's project answers 404, not 403.
	private async requireV2Project(
		scope: ProjectScope,
		projectId: string,
	): Promise<ScopedAppProject> {
		const project = await this.appCommits.findScopedProject(scope, projectId);
		if (project?.engine !== "v2_app") {
			throw new NotFoundException();
		}
		return project;
	}
}

/**
 * The theme of a project with no readable file. Before web-app@1.1.0 it is the template default.
 * From web-app@1.1.0 or desktop-app@1.0.0 it is the file that the pre-turn fallback of the next turn writes.
 */
function defaultThemeOf(projectId: string, editable: boolean): AppThemeFile {
	return editable
		? buildAppThemeFile({
				origin: "host",
				selection: fallbackThemeSelection(projectId),
			})
		: buildAppThemeFile({
				origin: "template",
				selection: APP_THEME_TEMPLATE_SELECTION,
			});
}

/** The commit of the sandbox worktree. The GET answers it; the save compares `expectedHeadSha` with it. */
async function sandboxHeadOf(sandbox: SandboxReader): Promise<string> {
	return (
		await mustRunGit(sandbox, ["rev-parse", "HEAD"], Error)
	).stdout.trim();
}

function previewNotRunning(): ConflictException {
	return new ConflictException({
		code: "PREVIEW_NOT_RUNNING",
		message: "The preview sandbox is not running",
	});
}

function themeHeadMoved(): ConflictException {
	return new ConflictException({
		code: "THEME_HEAD_MOVED",
		message: "The project changed after the theme was read; read it again",
	});
}

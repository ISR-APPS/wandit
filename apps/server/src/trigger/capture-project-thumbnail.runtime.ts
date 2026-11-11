/**
 * Capture-project-thumbnail runtime: takes one screenshot of a V2 app inside
 * its running sandbox with the agent-browser CLI, and stores it as the
 * dashboard thumbnail (`projects.preview_image_url`).
 * `capture-project-thumbnail.task.ts` calls it through
 * `createCaptureProjectThumbnailRuntime`; the spec calls `runCaptureProjectThumbnail` with fakes.
 */
import { logger } from "@trigger.dev/sdk";
import type { createDb } from "@wandit/db";

import {
	deleteObject,
	projectThumbnailKey,
	publicAssetUrl,
	putSiteFile,
} from "../infrastructure/storage/r2";
import type {
	SandboxLogger,
	SandboxProvider,
} from "../modules/app-builder/domain/ports/sandbox-provider";
import { LoggingRepoRestorer } from "../modules/app-builder/infrastructure/git/logging-repo-restorer";
import { AppCommitsRepository } from "../modules/app-builder/infrastructure/persistence/app-commits.repository";
import { BuilderTurnsRepository } from "../modules/app-builder/infrastructure/persistence/builder-turns.repository";
import { SandboxSessionsRepository } from "../modules/app-builder/infrastructure/persistence/sandbox-sessions.repository";
import { TurnProjectRepository } from "../modules/app-builder/infrastructure/persistence/turn-project.repository";
import {
	ArchiveTemplateInit,
	TEMPLATE_ARCHIVE_DIR,
} from "../modules/app-builder/infrastructure/sandbox/template-init";
import {
	profileForFramework,
	TEMPLATE_PROFILES,
	type TemplateProfile,
} from "../modules/app-builder/infrastructure/sandbox/template-profiles";
import { VercelSandboxProvider } from "../modules/app-builder/infrastructure/sandbox/vercel-sandbox.provider";
import { ProjectsRepository } from "../modules/projects/infrastructure/persistence/projects.repository";

type TriggerDatabase = ReturnType<typeof createDb>;

// The capture writes to /tmp only: a file in the workspace would enter the next turn commit.
const THUMBNAIL_SANDBOX_PATH = "/tmp/wandit-thumbnail.jpg";
// The script exits with this code when the sandbox has no agent-browser CLI (an old sandbox).
const BROWSER_MISSING_EXIT_CODE = 127;
// 120 s for the whole script: six browser commands of at most 15 s each, plus the Chrome start.
const CAPTURE_EXEC_TIMEOUT_MS = 120_000;
// 5 MB. A 1440 x 900 JPEG at quality 80 is about 0.5 MB, so a bigger file is not our screenshot.
const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;
// 500 chars of stderr: enough for the agent-browser error line. The log stays small.
const STDERR_LOG_MAX_CHARS = 500;

/** Why a capture stopped without a thumbnail. Each one is logged with the project and the commit. */
export type ThumbnailSkipReason =
	| "project_missing"
	| "not_v2_app"
	| "turn_active"
	| "head_moved"
	| "sandbox_stopped"
	| "browser_missing"
	| "capture_failed"
	| "not_an_image"
	| "project_gone";

/** The answer of one capture run. `url` is the public R2 URL that the project row now holds. */
export type CaptureProjectThumbnailResult =
	| { outcome: "captured"; url: string }
	| { outcome: "skipped"; reason: ThumbnailSkipReason };

/** The payload of the task, after its zod parse. */
export type CaptureProjectThumbnailInput = {
	projectId: string;
	/** The 40-hex sha of the commit that the builder turn made. */
	commitSha: string;
};

/** The slice of the capture that the spec fakes. */
export type CaptureProjectThumbnailDeps = {
	turnProjects: Pick<TurnProjectRepository, "findForTurn">;
	turns: Pick<BuilderTurnsRepository, "findActiveForProject">;
	appCommits: Pick<AppCommitsRepository, "findBranch">;
	/** `findRunning` only: it never wakes a sandbox and never stamps activity. */
	sandboxes: Pick<SandboxProvider, "findRunning">;
	projects: Pick<ProjectsRepository, "setPreviewImageUrl">;
	/** Stores the JPEG under the R2 key. `createCaptureProjectThumbnailRuntime` binds `putSiteFile` with no cache header. */
	uploadThumbnail: (key: string, bytes: Uint8Array) => Promise<void>;
	/** Deletes one R2 object; a missing key is not an error. `createCaptureProjectThumbnailRuntime` binds `deleteObject`. */
	deleteObject: (key: string) => Promise<void>;
	logger: SandboxLogger;
};

/**
 * The fixed capture script. Only the dev port of the frozen template profile
 * and the fixed viewport numbers go in, never user data.
 * Its own session name keeps the agent's default browser session as it is.
 */
function captureScriptOf(profile: Readonly<TemplateProfile>): string {
	// The viewport in CSS px: it fits the browser frame or the phone frame of the dashboard card.
	const [width, height] =
		profile === TEMPLATE_PROFILES.mobile ? [390, 844] : [1440, 900];
	// LIMIT: a first page load over 15 s fails the capture. Upgrade: a longer timeout on open and wait --load, still under CAPTURE_EXEC_TIMEOUT_MS.
	// `timeout 15` on each command: a stuck command must not skip the close
	// below, which frees about 300 MB of Chrome memory on a 4 GB VM.
	const browser = "timeout 15 agent-browser --session wandit-thumbnail";
	return [
		// The version check fetches a host that the turn egress policy blocks.
		"export AGENT_BROWSER_NO_VERSION_CHECK=1",
		`command -v agent-browser >/dev/null 2>&1 || exit ${BROWSER_MISSING_EXIT_CODE}`,
		`rm -f ${THUMBNAIL_SANDBOX_PATH}`,
		// "wait --load load", never "networkidle": the dev server websocket keeps the network busy.
		`${browser} set viewport ${width} ${height} && ` +
			`${browser} open http://localhost:${profile.devPort} && ` +
			`${browser} wait --load load && ` +
			`${browser} wait 1500 && ` +
			`${browser} screenshot ${THUMBNAIL_SANDBOX_PATH} --screenshot-format jpeg --screenshot-quality 80`,
		"status=$?",
		`${browser} close >/dev/null 2>&1`,
		"exit $status",
	].join("\n");
}

/**
 * True for a JPEG of at most `THUMBNAIL_MAX_BYTES`. The bytes come from a VM
 * that runs user code, and the public asset origin serves them.
 */
function isThumbnailJpeg(bytes: Uint8Array): boolean {
	return (
		bytes.length <= THUMBNAIL_MAX_BYTES &&
		bytes[0] === 0xff &&
		bytes[1] === 0xd8 &&
		bytes[2] === 0xff
	);
}

/**
 * Takes one screenshot of the app at `commitSha` and writes its URL to the
 * project row. Every check that fails answers `skipped` with a reason and
 * changes nothing. A vendor or storage error throws: the task reports it to Sentry.
 */
export async function runCaptureProjectThumbnail(
	deps: CaptureProjectThumbnailDeps,
	input: CaptureProjectThumbnailInput,
): Promise<CaptureProjectThumbnailResult> {
	const { commitSha, projectId } = input;
	const skip = (
		reason: ThumbnailSkipReason,
		level: "info" | "warn" = "info",
		fields: Record<string, string> = {},
	): CaptureProjectThumbnailResult => {
		deps.logger[level]("project-thumbnail.skipped", {
			...fields,
			commitSha,
			projectId,
			reason,
		});
		return { outcome: "skipped", reason };
	};

	const project = await deps.turnProjects.findForTurn(projectId);
	if (project === null) {
		return skip("project_missing");
	}
	// A V2 row without a framework is broken: no dev server runs for it.
	if (project.engine !== "v2_app" || project.framework === null) {
		return skip("not_v2_app");
	}
	// A live turn changes the files now. Its own end schedules a new capture.
	// LIMIT: when that turn commits nothing, this commit gets no thumbnail. Upgrade: schedule a capture after every succeeded turn.
	if ((await deps.turns.findActiveForProject(projectId)) !== null) {
		return skip("turn_active");
	}
	// A newer commit exists, and its own capture writes the newer thumbnail.
	if ((await deps.appCommits.findBranch(projectId))?.headSha !== commitSha) {
		return skip("head_moved");
	}
	// Never a wake: the idle sweep must still stop a sandbox that nobody uses.
	const sandbox = await deps.sandboxes.findRunning(projectId);
	if (sandbox === null) {
		return skip("sandbox_stopped");
	}

	// LIMIT: a turn that leaves a Vite or Expo error screen gets that screen as its thumbnail. Upgrade: skip when the page shows an error overlay.
	const capture = await sandbox.exec(
		"sh",
		["-c", captureScriptOf(profileForFramework(project.framework))],
		{ timeoutMs: CAPTURE_EXEC_TIMEOUT_MS },
	);
	if (capture.exitCode === BROWSER_MISSING_EXIT_CODE) {
		return skip("browser_missing");
	}
	if (capture.exitCode !== 0) {
		return skip("capture_failed", "warn", {
			exitCode: String(capture.exitCode),
			stderr: capture.stderr.slice(0, STDERR_LOG_MAX_CHARS),
		});
	}

	// Security check: only a real JPEG reaches the public asset origin.
	const bytes = await sandbox.readFile(THUMBNAIL_SANDBOX_PATH);
	if (bytes === null || !isThumbnailJpeg(bytes)) {
		return skip("not_an_image", "warn", {
			byteLength: String(bytes?.length ?? 0),
		});
	}

	// LIMIT: one JPEG per committed turn stays in R2 until the project delete drains sites/{id}/thumbnails/. Upgrade: delete the previous key after a successful write.
	const key = projectThumbnailKey(projectId, commitSha);
	await deps.uploadThumbnail(key, bytes);
	const url = publicAssetUrl(key);
	// The project was deleted during the capture: its prefix drain may be done already.
	if (!(await deps.projects.setPreviewImageUrl(projectId, url))) {
		await deps.deleteObject(key);
		return skip("project_gone");
	}
	deps.logger.info("project-thumbnail.captured", { commitSha, projectId, url });
	return { outcome: "captured", url };
}

/**
 * Composes the real repositories, the provider, and the R2 writes for the
 * Trigger worker. The capture only calls `findRunning`, which never restores
 * a repo or applies a template, like the idle sweep. The task ends the pool.
 */
export function createCaptureProjectThumbnailRuntime(db: TriggerDatabase) {
	const deps: CaptureProjectThumbnailDeps = {
		appCommits: new AppCommitsRepository(db),
		deleteObject,
		// The Trigger logger: the Trigger Sentry client drops `Sentry.logger` lines.
		logger,
		projects: new ProjectsRepository(db),
		sandboxes: new VercelSandboxProvider(
			new SandboxSessionsRepository(db),
			new LoggingRepoRestorer(),
			new ArchiveTemplateInit(TEMPLATE_ARCHIVE_DIR),
		),
		turnProjects: new TurnProjectRepository(db),
		turns: new BuilderTurnsRepository(db),
		// No cache header: each capture writes a new key (see `putSiteFile` in r2.ts).
		uploadThumbnail: (key, bytes) => putSiteFile(key, bytes, "image/jpeg"),
	};
	return {
		run: (input: CaptureProjectThumbnailInput) =>
			runCaptureProjectThumbnail(deps, input),
	};
}

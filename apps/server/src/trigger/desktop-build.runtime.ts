/**
 * Desktop-build runtime (docs/v2/desktop-apps.md sections 9 to 11): builds
 * the files of one desktop app for one platform (the Windows setup exe, or
 * the macOS disk image and update archive) and moves its `desktop_builds`
 * row to a terminal status. `desktop-build.task.ts` calls `runDesktopBuild`;
 * the spec runs it on fakes. It calls the sandbox, the migration gate, the
 * secret scanner, the theme font bundle, R2, the GitHub runner, the macOS
 * archive check, the updater signature, and the credit hold of build-credit-hold.ts.
 */
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
	access,
	mkdtemp,
	open,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
	DESKTOP_MIGRATION_MAX_BYTES,
	DESKTOP_MIGRATIONS_DIR,
	DESKTOP_MIGRATIONS_MAX_COUNT,
	DESKTOP_MIGRATIONS_MAX_TOTAL_BYTES,
	type DesktopBuildErrorCode,
	type DesktopGateFinding,
} from "@wandit/contracts";
import type { AppThemeFile } from "@wandit/contracts/v2/app-theme";
import { getErrorMessage } from "@wandit/observability/error";

import {
	desktopBuildFolderKey,
	desktopInputKey,
	desktopManifestKey,
	desktopStagingKey,
} from "../infrastructure/storage/r2";
import {
	desktopBuildHoldKey,
	desktopIdentifier,
	desktopStatusesThatMayMoveTo,
} from "../modules/app-builder/domain/desktop-build";
import {
	type DesktopMigrationFile,
	desktopGateFinding,
	type PlannedDesktopMigration,
	planDesktopMigrations,
} from "../modules/app-builder/domain/desktop-migrations";
import {
	type DesktopBuildDispatchInput,
	type DesktopBuildRunner,
	DesktopBuildRunnerError,
} from "../modules/app-builder/domain/ports/desktop-build-runner";
import type {
	SandboxExecResult,
	SandboxHandle,
	SandboxLogger,
	SandboxProvider,
} from "../modules/app-builder/domain/ports/sandbox-provider";
import { SecretScanGate } from "../modules/app-builder/domain/publish-gate/secret-scanner";
import {
	DesktopBuildInputError,
	type DesktopBuildInputFile,
	writeDesktopBuildInput,
} from "../modules/app-builder/infrastructure/desktop/desktop-build-input";
import { repackMacAppArchive } from "../modules/app-builder/infrastructure/desktop/macos-update-archive";
import {
	bundleThemeFonts,
	THEME_FONTS_DIR,
} from "../modules/app-builder/infrastructure/desktop/theme-fonts";
import {
	decryptDesktopUpdaterKey,
	signUpdaterArtifact,
	verifyUpdaterSignature,
} from "../modules/app-builder/infrastructure/desktop/updater-signature";
import type { AppBackendsRepository } from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import type {
	DesktopAppRow,
	DesktopBuildRow,
	DesktopBuildsRepository,
} from "../modules/app-builder/infrastructure/persistence/desktop-builds.repository";
import type { DesktopMigrationsRepository } from "../modules/app-builder/infrastructure/persistence/desktop-migrations.repository";
import type { TurnProjectRepository } from "../modules/app-builder/infrastructure/persistence/turn-project.repository";
import {
	APP_THEME_FILE_PATH,
	readAppThemeFile,
} from "../modules/app-builder/infrastructure/sandbox/app-theme-file";
import { startSandboxWithoutTurn } from "../modules/app-builder/infrastructure/sandbox/sandbox-start";
import { parseSecretKeyRing } from "../modules/app-builder/infrastructure/secrets/secret-crypto";
import { checkDesktopMigrations } from "../modules/app-builder/infrastructure/sqlite/desktop-migration-gate";
import { DESKTOP_BUILD_CREDITS_CENTI } from "../modules/metering/domain/operation-registry";

import {
	type BuildCreditHoldInput,
	createBuildCreditHold,
} from "./build-credit-hold";

// Outside the project worktree, so a running turn never sees the build
// checkout in `git status` and `git add -A`.
const BUILD_ROOT = "/tmp/wandit-desktop";
// The same command ceilings as the publish build: a warm pnpm store makes
// the install fast, and a template build takes under one minute.
const INSTALL_TIMEOUT_MS = 180_000;
const BUILD_TIMEOUT_MS = 300_000;
const COMMAND_TIMEOUT_MS = 60_000;
// The publish limits of section 9 for the frontend output.
const MAX_DIST_FILES = 5_000;
const MAX_DIST_BYTES = 100 * 1024 * 1024;
// Parallel `readFile` calls; each one is one sandbox API request.
const READ_BATCH_SIZE = 16;
// The tail of a failed command that goes into the row for support.
const STDERR_TAIL_LENGTH = 400;
// The template theme.json has about 4 KB. A file of 64 KiB or more gets no fonts.
const THEME_FILE_MAX_BYTES = 64 * 1024;
// The exit code of LIST_MIGRATIONS_SCRIPT when migrations/ is a symlink or a file.
const NOT_A_FOLDER_EXIT_CODE = 46;
// 2 h (section 9): CI waits in its queue, builds up to 60 min, then uploads.
const PRESIGNED_URL_TTL_SECONDS = 2 * 60 * 60;
// One GitHub run read every 20 s. A Trigger wait above 5 s frees the machine.
const POLL_INTERVAL_MS = 20_000;
// LIMIT: the task gives up 70 min after the dispatch, also when GitHub still queues the run. Upgrade: a ceiling that starts when the run starts.
const POLL_CEILING_MS = 70 * 60_000;
// Section 9: the largest staged file (setup exe, disk image, or update
// archive). A Tauri NSIS installer is about 10 MB, a disk image about 6 MB.
const MAX_INSTALLER_BYTES = 300 * 1024 * 1024;
// 10 min for a 300 MB read from R2 into the worker.
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;
// The build input is private data in a public bucket. Only its random key
// protects it, so no cache keeps a copy.
const INPUT_CACHE_CONTROL = "private, no-store";
// Every Windows exe and installer starts with the DOS header "MZ".
const EXE_MAGIC = Buffer.from("MZ", "latin1");
// A UDIF disk image ends with a 512-byte trailer that starts with "koly".
const DMG_TRAILER_MAGIC = Buffer.from("koly", "latin1");
const DMG_TRAILER_BYTES = 512;
// Every gzip stream starts with these 2 bytes.
const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);

/** Payload of one `desktop-build` run, plus the Trigger run id. Not the tar build input. */
export type DesktopBuildRunInput = {
	/** `desktop_builds.id`. */
	buildId: string;
	/** Project of the build. The run skips a row of another project. */
	projectId: string;
	/** `ctx.run.id` of this run. The claim writes it to `desktop_builds.trigger_run_id`. */
	triggerRunId: string;
};

/** The R2 calls of one build. The task binds them to the r2.ts functions. */
export type DesktopBuildStorage = {
	/** Uploads the gzip build input with `INPUT_CACHE_CONTROL`. */
	putInput: (
		key: string,
		bytes: Uint8Array,
		cacheControl: string,
	) => Promise<void>;
	/** Uploads one signed build file from a local file with download headers. */
	putBuildFile: (
		key: string,
		filePath: string,
		/** The download name, for example `stock-1.0.3.dmg`. It sets the content type. */
		fileName: string,
	) => Promise<void>;
	/** Presigned GET URL of one object. A credential: never log it. */
	presignGet: (key: string, expiresInSeconds: number) => Promise<string>;
	/** Presigned PUT URL of one object. A credential: never log it. */
	presignPut: (key: string, expiresInSeconds: number) => Promise<string>;
	/** Deletes one object. A missing object counts as deleted. */
	deleteObject: (key: string) => Promise<void>;
};

/** Everything `runDesktopBuild` calls. The task wires the real ones; the spec passes fakes. */
export type DesktopBuildDeps = {
	/** The `desktop_builds` and `desktop_apps` rows. Every status change is a compare-and-set. */
	builds: Pick<
		DesktopBuildsRepository,
		"findById" | "findForTask" | "findMigrationsCommit" | "transition"
	>;
	/** The frozen migration files of the project, for the gate. */
	migrations: Pick<DesktopMigrationsRepository, "listFrozen">;
	/** Leases, settles, and refunds the `desktop_build:<projectId>:<requestKey>` hold of the API. */
	metering: BuildCreditHoldInput["metering"];
	/** Reuses a running sandbox, or wakes or creates it at the build. */
	sandboxes: Pick<
		SandboxProvider,
		"findRunning" | "getOrCreate" | "keepAliveIfRunning"
	>;
	/** The sandbox inputs of the project. Null also means the project is soft-deleted. */
	projects: Pick<TurnProjectRepository, "findForTurn">;
	/** The backend row that the sandbox start reads. */
	backends: Pick<AppBackendsRepository, "findByProjectId">;
	/** The GitHub runner. Null without DESKTOP_BUILD_GITHUB_TOKEN or DESKTOP_BUILD_REPO: the run fails `unconfigured`. */
	runner: DesktopBuildRunner | null;
	/** R2. Null when R2 is not configured: the run fails `unconfigured`. */
	storage: DesktopBuildStorage | null;
	/** `desktopUpdatesUrl` of r2.ts: the public URL of a `desktop/` key, or null without a base URL. */
	updatesUrl: (key: string) => string | null;
	/** `APP_SECRETS_ENCRYPTION_KEY`. Null on a worker without it: the run fails `unconfigured`. */
	appSecretsEncryptionKey: string | null;
	/** The trusted `src-tauri` folder: `resolve(TEMPLATE_ARCHIVE_DIR, "desktop-shell/src-tauri")`. */
	shellDir: string;
	/** `globalThis.fetch` in production. It reads the staged files and fetches the theme fonts. */
	fetch: typeof fetch;
	/** `GENERATION_BILLING_MODE === "off"`: the API made no hold. An existing hold still settles or refunds. */
	billingDisabled: boolean;
	/** `wait.for` in production; the spec adds the ms to a fake clock. */
	sleep: (ms: number) => Promise<void>;
	/** `Date.now` in production; the spec reads a fake clock. */
	now: () => number;
	/** `Sentry.captureException` with the run tags. `failure` is the error code or `settle_failed`. */
	captureException: (
		error: unknown,
		tags: {
			buildId: string;
			projectId: string;
			failure: DesktopBuildErrorCode | "settle_failed";
		},
	) => void;
	/** `Sentry.logger` in production; the spec records lines. */
	logger: SandboxLogger;
};

/**
 * Outcome of one run. `canceled`: the API canceled the build, or the
 * project was deleted or suspended. `skipped`: the run did not claim the row.
 */
export type DesktopBuildResult = {
	outcome: "ready" | "blocked" | "failed" | "canceled" | "skipped";
	/** The stored error code on `failed`, else null. */
	errorCode: DesktopBuildErrorCode | null;
};

/** A failure with a known error code. Any other error becomes `internal`. */
class DesktopBuildFailure extends Error {
	constructor(
		readonly code: DesktopBuildErrorCode,
		message: string,
	) {
		super(message);
		this.name = "DesktopBuildFailure";
	}
}

/** Why the run stops before `ready` without a failure. */
type StopReason =
	// Another writer ended the row (an API cancel, or a failed task start)
	// and released the hold.
	| "canceled"
	// The project is soft-deleted: nobody can see or cancel the build.
	| "project_deleted"
	// Staff suspended the project. Its build files must not stay in R2.
	| "project_suspended"
	// The `ready` write saw a suspension that staff lifted before the stop
	// check. The row is still live, and nobody else ends it.
	| "suspension_lifted"
	// The row is gone with its hard-deleted project.
	| "row_gone";

const SKIPPED: DesktopBuildResult = { errorCode: null, outcome: "skipped" };
const CANCELED: DesktopBuildResult = { errorCode: null, outcome: "canceled" };

/**
 * Runs one build: claim the queued row, lease the credit hold, build and
 * check the frontend and the migrations, run CI, sign, and upload. Then
 * settle or release the hold. After the claim, every failure exit goes
 * through `fail`. The run throws only when the `failed` write itself fails.
 * The row then stays live until the user cancels it.
 */
export async function runDesktopBuild(
	deps: DesktopBuildDeps,
	input: DesktopBuildRunInput,
): Promise<DesktopBuildResult> {
	const { buildId, projectId } = input;

	const found = await deps.builds.findForTask(buildId);
	// The payload crossed a queue: a row of another project is never built.
	if (found === null || found.build.projectId !== projectId) {
		deps.logger.info("desktop-build.skipped", {
			buildId,
			projectId,
			reason: found === null ? "no-row" : "project-mismatch",
		});
		return SKIPPED;
	}
	const { app } = found;
	const logFields = { buildId, platform: found.build.platform, projectId };
	// The claim fails when the API canceled the row or another run claimed it.
	const build = await deps.builds.transition(buildId, {
		to: "preparing",
		triggerRunId: input.triggerRunId,
	});
	if (build === null) {
		deps.logger.info("desktop-build.skipped", {
			...logFields,
			reason: "not-queued",
		});
		return SKIPPED;
	}

	// The hold row names the payer, so the run passes only the row columns.
	const hold = createBuildCreditHold({
		billingDisabled: deps.billingDisabled,
		build,
		holdKey: desktopBuildHoldKey(projectId, build.requestKey),
		logFields,
		logPrefix: "desktop-build",
		logger: deps.logger,
		metering: deps.metering,
		operation: "desktop_build",
	});
	// The input and staged objects. Every exit deletes them.
	const temporaryKeys: string[] = [];
	// The public build files. An exit before `ready` deletes them.
	const signedKeys: string[] = [];
	// Set after the dispatch. A stop before the CI run ends cancels it.
	let ciRunId: string | null = null;
	let isCiDone = false;
	// Security: the presigned URLs are credentials. A stored failure text never holds one.
	const credentials: string[] = [];

	const masked = (text: string): string =>
		credentials.reduce((result, url) => result.replaceAll(url, "***"), text);

	/**
	 * Settles a still-reserved hold at the fixed price. The row is already
	 * `ready`, so a failed settle is logged and captured, never thrown.
	 */
	const settleHold = async (): Promise<void> => {
		try {
			await hold.settle({
				costUsdMicros: null,
				finalCredits: DESKTOP_BUILD_CREDITS_CENTI,
				pricing: "direct",
				pricingSnapshot: {
					creditsPerUnit: DESKTOP_BUILD_CREDITS_CENTI,
					mode: "fixed",
					operation: "desktop_build",
					source: "operation_registry",
					unit: "operation",
					units: 1,
				},
				provider: "github",
				rawUsage: { ciRunId, platform: build.platform },
			});
		} catch (error) {
			deps.captureException(error, { ...logFields, failure: "settle_failed" });
			deps.logger.error("desktop-build.settle-failed", {
				...logFields,
				error: getErrorMessage(error),
			});
		}
	};

	/** Cancels the CI run while it can still run. Best effort: a failure only logs. */
	const cancelCi = async (): Promise<void> => {
		if (ciRunId === null || isCiDone || deps.runner === null) {
			return;
		}
		try {
			await deps.runner.cancel(ciRunId);
		} catch (error) {
			deps.logger.warn("desktop-build.ci-cancel-failed", {
				...logFields,
				ciRunId,
				error: getErrorMessage(error),
			});
		}
	};

	/** Deletes the objects of this run that must not stay. Best effort: a failure only logs. */
	const deleteObjects = async (keys: string[]): Promise<void> => {
		if (deps.storage === null) {
			return;
		}
		for (const key of keys) {
			try {
				await deps.storage.deleteObject(key);
			} catch (error) {
				deps.logger.warn("desktop-build.object-delete-failed", {
					...logFields,
					error: getErrorMessage(error),
				});
			}
		}
	};

	/** Every exit before `ready`: stop CI, then delete the temporary objects and the build files. */
	const cleanUp = async (): Promise<void> => {
		await cancelCi();
		await deleteObjects([...temporaryKeys, ...signedKeys]);
	};

	/** Reads the row and the project. Answers why the run must stop, or null. */
	const findStopReason = async (): Promise<StopReason | null> => {
		const row = await deps.builds.findById(buildId);
		if (row === null) {
			return "row_gone";
		}
		// A row that cannot move to `canceled` has ended. The API canceled it, or
		// `failStart` failed it, and that writer released the hold.
		if (!desktopStatusesThatMayMoveTo("canceled").includes(row.status)) {
			return "canceled";
		}
		const project = await deps.projects.findForTurn(projectId);
		if (project === null) {
			return "project_deleted";
		}
		return project.suspendedReasonCode === null ? null : "project_suspended";
	};

	/**
	 * Ends the run without a failure. For `canceled`, the writer that ended
	 * the row released the hold. For a deleted or suspended project, and
	 * after a lifted suspension, nobody else ends the build. So the run
	 * cancels the row and releases the hold itself.
	 */
	const stop = async (reason: StopReason): Promise<DesktopBuildResult> => {
		await cleanUp();
		if (
			reason === "project_deleted" ||
			reason === "project_suspended" ||
			reason === "suspension_lifted"
		) {
			// A lost compare-and-set means another writer ended the row and released the hold.
			if (
				(await deps.builds.transition(buildId, {
					by: "task",
					to: "canceled",
				})) !== null
			) {
				await hold.refund("desktop_build_canceled");
			}
		} else if (reason === "row_gone") {
			await hold.refund("desktop_build_canceled");
		}
		deps.logger.info("desktop-build.stopped", { ...logFields, reason });
		return CANCELED;
	};

	/**
	 * A compare-and-set lost against a cancel, a failed start, a delete, or a
	 * suspension. The `ready` write refuses a suspended project, so a takedown
	 * after the last check still deletes the uploaded files here. No
	 * reason on the read: only the `ready` write refuses a row that stays
	 * live, so the suspension ended after that write.
	 */
	const stopAfterLostTransition = async (): Promise<DesktopBuildResult> =>
		stop((await findStopReason()) ?? "suspension_lifted");

	/**
	 * One exit for every failure. Only a won compare-and-set releases the
	 * hold, captures to Sentry, and logs. A lost one means the API canceled
	 * the row and released the hold first.
	 */
	const fail = async (
		errorCode: DesktopBuildErrorCode,
		error: unknown,
	): Promise<DesktopBuildResult> => {
		await cleanUp();
		const errorMessage = masked(getErrorMessage(error));
		const failed = await deps.builds.transition(buildId, {
			errorCode,
			errorMessage,
			to: "failed",
		});
		if (failed === null) {
			deps.logger.info("desktop-build.fail-lost", { ...logFields, errorCode });
			return CANCELED;
		}
		await hold.refund("desktop_build_failed");
		// Sentry keeps the original stack, unless the text holds a presigned URL.
		deps.captureException(
			errorMessage === getErrorMessage(error) ? error : new Error(errorMessage),
			{ ...logFields, failure: errorCode },
		);
		deps.logger.error("desktop-build.failed", { ...logFields, errorCode });
		return { errorCode, outcome: "failed" };
	};

	try {
		const lease = await hold.lease();
		if (lease === "hold_mismatch") {
			return await fail(
				"internal",
				new Error("credit hold is missing or does not match the build"),
			);
		}
		if (lease === "not_reserved") {
			return await fail("internal", new Error("credit hold is not reserved"));
		}

		const startStop = await findStopReason();
		if (startStop !== null) {
			return await stop(startStop);
		}
		// Only the project delete removes the app row, after the soft delete. So
		// the check above stops that build, and a null here is a broken row.
		if (app === null) {
			return await fail("internal", new Error("the desktop app row is gone"));
		}

		const { runner, storage } = deps;
		const updatesEndpoint = deps.updatesUrl(
			desktopManifestKey(projectId, build.platform),
		);
		// The deployed worker gets the shell through `additionalFiles` of
		// trigger.config.ts. A missing file means an image without it.
		const hasShell = await access(join(deps.shellDir, "tauri.conf.json")).then(
			() => true,
			() => false,
		);
		// tauri-plugin-updater refuses an http endpoint, and every installed app
		// keeps the endpoint for good.
		if (
			runner === null ||
			storage === null ||
			deps.appSecretsEncryptionKey === null ||
			updatesEndpoint === null ||
			!updatesEndpoint.startsWith("https://") ||
			!hasShell
		) {
			return await fail(
				"unconfigured",
				new Error(
					"the worker lacks the GitHub runner, R2, APP_SECRETS_ENCRYPTION_KEY, an https updates URL, or the desktop shell",
				),
			);
		}

		// --- preparing: the frontend, the secret scan, and the gate ---------
		const sources = await prepareSources(deps, build);
		if (sources.kind === "blocked") {
			const blocked = await deps.builds.transition(buildId, {
				findings: sources.findings,
				to: "blocked",
			});
			if (blocked === null) {
				return await stopAfterLostTransition();
			}
			await hold.refund("desktop_build_blocked");
			deps.logger.warn("desktop-build.blocked", {
				...logFields,
				findings: String(sources.findings.length),
			});
			return { errorCode: null, outcome: "blocked" };
		}
		await hold.heartbeat();

		// --- the build input and the CI dispatch ----------------------------
		// The shell CSP allows only local fonts, so the app carries the theme
		// fonts. They stay in memory until the archive, before any wait.
		const fonts = await bundleThemeFonts(
			{ fetch: deps.fetch, logFields, logger: deps.logger },
			sources.theme,
		);
		let archive: Buffer;
		try {
			archive = await writeDesktopBuildInput({
				config: {
					identifier: desktopIdentifier(projectId),
					mainBinaryName: app.binaryName,
					productName: build.productName,
					updaterPublicKey: app.updaterPublicKey,
					updatesEndpoint,
					version: build.version,
				},
				// The host owns `wandit-fonts/`. A user file there would clash with
				// a font path. Windows and macOS ignore case, so the check does too.
				dist: [
					...sources.dist.filter(
						(file) => file.path.toLowerCase().split("/")[0] !== THEME_FONTS_DIR,
					),
					...fonts,
				],
				migrations: sources.migrations.map((migration) => ({
					// The gate hashed the UTF-8 bytes of this text, and the shell
					// hashes the file bytes, so the archive holds the same bytes.
					content: new TextEncoder().encode(migration.sql),
					path: migration.fileName,
				})),
				shellDir: deps.shellDir,
			});
		} catch (error) {
			if (error instanceof DesktopBuildInputError) {
				throw new DesktopBuildFailure("output_invalid", error.message);
			}
			throw error;
		}
		const inputKey = desktopInputKey(projectId, buildId);
		temporaryKeys.push(inputKey);
		await mustStore("input upload", () =>
			storage.putInput(inputKey, archive, INPUT_CACHE_CONTROL),
		);
		const stagingKey = desktopStagingKey(
			projectId,
			buildId,
			build.platform === "macos" ? "dmg" : "exe",
		);
		// macOS only: the update archive. Windows installs its setup exe.
		const stagingUpdateKey =
			build.platform === "macos"
				? desktopStagingKey(projectId, buildId, "app.tar.gz")
				: null;
		temporaryKeys.push(
			stagingKey,
			...(stagingUpdateKey === null ? [] : [stagingUpdateKey]),
		);

		const beforeDispatch = await findStopReason();
		if (beforeDispatch !== null) {
			return await stop(beforeDispatch);
		}
		const inputUrl = await storage.presignGet(
			inputKey,
			PRESIGNED_URL_TTL_SECONDS,
		);
		const outputUrl = await storage.presignPut(
			stagingKey,
			PRESIGNED_URL_TTL_SECONDS,
		);
		credentials.push(inputUrl, outputUrl);
		const dispatchBase = {
			buildId,
			inputSha256: createHash("sha256").update(archive).digest("hex"),
			inputUrl,
			outputUrl,
		};
		let dispatchInput: DesktopBuildDispatchInput;
		if (stagingUpdateKey === null) {
			dispatchInput = { ...dispatchBase, platform: "windows" };
		} else {
			const updateUrl = await storage.presignPut(
				stagingUpdateKey,
				PRESIGNED_URL_TTL_SECONDS,
			);
			credentials.push(updateUrl);
			dispatchInput = { ...dispatchBase, platform: "macos", updateUrl };
		}
		try {
			ciRunId = (await runner.dispatch(dispatchInput)).runId;
		} catch (error) {
			if (error instanceof DesktopBuildRunnerError) {
				throw new DesktopBuildFailure("ci_start_failed", error.message);
			}
			throw error;
		}
		// Null: the API canceled the row during the dispatch. It did not know
		// the run id, so `stop` cancels the run.
		if (
			(await deps.builds.transition(buildId, { ciRunId, to: "building" })) ===
			null
		) {
			return await stopAfterLostTransition();
		}
		await hold.heartbeat();

		// --- building: poll the CI run ---------------------------------------
		const dispatchedAt = deps.now();
		// The loop ends on a completed run, a stop, a lost hold, or the poll
		// ceiling. Never through its header.
		while (true) {
			if (deps.now() - dispatchedAt >= POLL_CEILING_MS) {
				return await fail(
					"timeout",
					new Error(`CI run ${ciRunId} did not end before the poll ceiling`),
				);
			}
			await deps.sleep(POLL_INTERVAL_MS);
			let pollStop: StopReason | null;
			try {
				pollStop = await findStopReason();
			} catch (error) {
				// A failed DB read does not end a healthy CI run: the next poll
				// reads again, and the ceiling still applies.
				deps.logger.warn("desktop-build.row-read-failed", {
					...logFields,
					error: getErrorMessage(error),
				});
				continue;
			}
			if (pollStop !== null) {
				return await stop(pollStop);
			}
			await hold.heartbeat();
			let run: Awaited<ReturnType<DesktopBuildRunner["getRun"]>>;
			try {
				run = await runner.getRun(ciRunId);
			} catch (error) {
				// One failed read does not end the build: the next poll reads
				// again, and the ceiling still applies.
				deps.logger.warn("desktop-build.ci-read-failed", {
					...logFields,
					error: getErrorMessage(error),
				});
				continue;
			}
			if (run.status !== "completed") {
				continue;
			}
			isCiDone = true;
			if (run.conclusion !== "success") {
				// A failed self-test fails again on each retry, so it gets its own
				// code and text: the user asks the agent to fix the migrations.
				let errorCode: DesktopBuildErrorCode = "ci_failed";
				try {
					if (await runner.hasFailedSelfTest(ciRunId)) {
						errorCode = "self_test_failed";
					}
				} catch (error) {
					// The generic code stays. Support reads the failed step on the run page.
					deps.logger.warn("desktop-build.ci-jobs-read-failed", {
						...logFields,
						error: getErrorMessage(error),
					});
				}
				return await fail(
					errorCode,
					new Error(
						`CI run ${run.id} ended with ${run.conclusion ?? "no conclusion"}`,
					),
				);
			}
			break;
		}

		// --- signing: check, sign, verify, and upload the build files ------
		if ((await deps.builds.transition(buildId, { to: "signing" })) === null) {
			return await stopAfterLostTransition();
		}
		// One random folder per build. The key is the public download URL.
		const folder = desktopBuildFolderKey(projectId, buildId);
		// The fields of the `ready` write. The installer is the setup exe or the disk image.
		let signed: {
			installerKey: string;
			installerSha256: string;
			installerBytes: number;
			/** macOS only: the re-packed `.app.tar.gz` that the updater installs. */
			updateArchiveKey: string | null;
			/** Signature of the update file: the setup exe, or the update archive. */
			updaterSignature: string;
		};
		// The temp folder starts after the last wait: a Trigger checkpoint may
		// not keep the disk.
		const workDir = await mkdtemp(join(tmpdir(), "wandit-desktop-build-"));
		try {
			const downloadStaged = async (
				key: string,
				filePath: string,
				kind: StagedFileKind,
			): Promise<{ bytes: number; sha256: string }> => {
				const url = await storage.presignGet(key, PRESIGNED_URL_TTL_SECONDS);
				credentials.push(url);
				return await downloadStagedFile(deps.fetch, url, filePath, kind);
			};
			if (stagingUpdateKey === null) {
				const installerFileName = `${app.binaryName}-${build.version}-setup.exe`;
				const installerPath = join(workDir, installerFileName);
				const installer = await downloadStaged(
					stagingKey,
					installerPath,
					"windows_installer",
				);
				const signature = await signUpdateFile(deps, {
					app,
					fileName: installerFileName,
					filePath: installerPath,
					secretsKey: deps.appSecretsEncryptionKey,
					version: build.version,
				});
				const installerKey = `${folder}/${installerFileName}`;
				signedKeys.push(installerKey);
				await mustStore("installer upload", () =>
					storage.putBuildFile(installerKey, installerPath, installerFileName),
				);
				signed = {
					installerBytes: installer.bytes,
					installerKey,
					installerSha256: installer.sha256,
					updateArchiveKey: null,
					updaterSignature: signature,
				};
			} else {
				const dmgFileName = `${app.binaryName}-${build.version}.dmg`;
				const dmgPath = join(workDir, dmgFileName);
				const diskImage = await downloadStaged(
					stagingKey,
					dmgPath,
					"disk_image",
				);
				const stagedArchivePath = join(workDir, "staged.app.tar.gz");
				await downloadStaged(
					stagingUpdateKey,
					stagedArchivePath,
					"update_archive",
				);
				// Security: the updater unpacks with no path guard, so only the
				// server re-pack of the CI archive gets a signature.
				// LIMIT: the re-pack holds up to 4 copies of the archive, about 900 MB at the limits, next to the build sources. medium-1x has 2 GB. Upgrade: a streaming tar reader.
				const repacked = repackMacAppArchive({
					binaryName: app.binaryName,
					gzipBytes: await readFile(stagedArchivePath),
				});
				if (repacked.kind === "invalid") {
					throw new DesktopBuildFailure("artifact_invalid", repacked.reason);
				}
				const archiveFileName = `${app.binaryName}-${build.version}.app.tar.gz`;
				const archivePath = join(workDir, archiveFileName);
				await writeFile(archivePath, repacked.gzipBytes, { flag: "wx" });
				const signature = await signUpdateFile(deps, {
					app,
					fileName: archiveFileName,
					filePath: archivePath,
					secretsKey: deps.appSecretsEncryptionKey,
					version: build.version,
				});
				const dmgKey = `${folder}/${dmgFileName}`;
				const archiveKey = `${folder}/${archiveFileName}`;
				signedKeys.push(dmgKey, archiveKey);
				await mustStore("disk image upload", () =>
					storage.putBuildFile(dmgKey, dmgPath, dmgFileName),
				);
				await mustStore("update archive upload", () =>
					storage.putBuildFile(archiveKey, archivePath, archiveFileName),
				);
				signed = {
					installerBytes: diskImage.bytes,
					installerKey: dmgKey,
					installerSha256: diskImage.sha256,
					updateArchiveKey: archiveKey,
					updaterSignature: signature,
				};
			}
		} finally {
			try {
				await rm(workDir, { force: true, recursive: true });
			} catch (error) {
				// The folder holds no secret; the worker disk goes with the machine.
				deps.logger.warn("desktop-build.cleanup-failed", {
					...logFields,
					error: getErrorMessage(error),
				});
			}
		}
		await deleteObjects(temporaryKeys);

		// --- ready: the build file fields and the frozen migrations ---------
		const ready = await deps.builds.transition(buildId, {
			...signed,
			migrations: sources.migrations.map(({ name, sha256, version }) => ({
				name,
				sha256,
				version,
			})),
			to: "ready",
		});
		if (ready === null) {
			return await stopAfterLostTransition();
		}
		await settleHold();
		deps.logger.info("desktop-build.ready", {
			...logFields,
			installerBytes: String(signed.installerBytes),
		});
		return { errorCode: null, outcome: "ready" };
	} catch (error) {
		return await fail(
			error instanceof DesktopBuildFailure ? error.code : "internal",
			error,
		);
	} finally {
		await hold.release();
	}
}

/** What `prepareSources` answers: the checked files, or the findings of a blocked build. */
type PreparedSources =
	| {
			kind: "ready";
			/** The frontend files, by path inside `dist/`. */
			dist: DesktopBuildInputFile[];
			/** Every migration file in version order, with its SHA-256 from the gate plan. */
			migrations: PlannedDesktopMigration[];
			/** src/styles/theme.json at the commit, for the fonts. Null when it is missing or invalid. */
			theme: AppThemeFile | null;
	  }
	| { kind: "blocked"; findings: DesktopGateFinding[] };

// Section 9, step 1. Checks out the commit of the row in its own git
// worktree of the sandbox. It reads `migrations/` and the theme file before
// the install, so no install or build script of the user changes them. Then
// it builds and reads `dist/`. A running turn neither blocks the build nor
// changes its files. A `src-tauri/` of the project is never read (section 1,
// rule 2). A rebuild of older code reads `migrations/` from a second
// worktree (section 10).
async function prepareSources(
	deps: DesktopBuildDeps,
	build: DesktopBuildRow,
): Promise<PreparedSources> {
	// The gate refuses a build that leaves out a frozen file, and an import
	// needs each ledger row to match an embedded file. So a rebuild of older
	// code embeds every frozen file, from a commit that holds them all. The
	// frontend still comes from the commit of the row.
	const migrationsCommit = await deps.builds.findMigrationsCommit(
		build.projectId,
		build.commitSha,
	);
	let sandbox: Pick<SandboxHandle, "exec" | "readFile" | "workspaceDir">;
	try {
		// A running sandbox can serve a live turn, so the build reuses it.
		const running = await deps.sandboxes.findRunning(build.projectId);
		if (running !== null) {
			// The reader runs no keep-alive, and install plus build take up to 8 min.
			await deps.sandboxes.keepAliveIfRunning(build.projectId);
		}
		sandbox = running ?? (await startSandboxWithoutTurn(deps, build.projectId));
	} catch (error) {
		throw new DesktopBuildFailure(
			"sandbox_failed",
			`The sandbox did not start: ${getErrorMessage(error)}`,
		);
	}
	const buildDir = `${BUILD_ROOT}/${build.id}`;
	const migrationsDir =
		migrationsCommit === build.commitSha ? buildDir : `${buildDir}-migrations`;
	const worktreeDirs =
		migrationsDir === buildDir ? [buildDir] : [buildDir, migrationsDir];
	try {
		await mustExec(
			sandbox,
			"sandbox_failed",
			"git",
			["worktree", "add", "--detach", buildDir, build.commitSha],
			{ cwd: sandbox.workspaceDir, timeoutMs: COMMAND_TIMEOUT_MS },
		);
		if (migrationsDir !== buildDir) {
			await mustExec(
				sandbox,
				"sandbox_failed",
				"git",
				["worktree", "add", "--detach", migrationsDir, migrationsCommit],
				{ cwd: sandbox.workspaceDir, timeoutMs: COMMAND_TIMEOUT_MS },
			);
		}
		const migrationFolder = await readMigrations(
			sandbox,
			`${migrationsDir}/${DESKTOP_MIGRATIONS_DIR}`,
		);
		// Security: a symlink to /dev/zero or a large file could fill the task
		// memory. `find` does not follow a symlink and checks the size first.
		const themeCheck = await sandbox.exec(
			"find",
			[
				`${buildDir}/${APP_THEME_FILE_PATH}`,
				"-maxdepth",
				"0",
				"-type",
				"f",
				"-size",
				`-${THEME_FILE_MAX_BYTES}c`,
			],
			{ timeoutMs: COMMAND_TIMEOUT_MS },
		);
		// Untrusted: the contracts schema parses it. A bad file costs only the
		// fonts: the app falls back to the engine.css font stacks.
		const themeFile =
			themeCheck.exitCode === 0 && themeCheck.stdout.trim() !== ""
				? await readAppThemeFile({
						readFile: (path) => sandbox.readFile(path),
						workspaceDir: buildDir,
					})
				: null;
		if (themeFile === null || themeFile.file === null) {
			deps.logger.warn("desktop-build.theme-unreadable", {
				buildId: build.id,
				projectId: build.projectId,
				reason: themeFile === null ? "missing" : "invalid",
			});
		}
		await mustExec(
			sandbox,
			"frontend_build_failed",
			"pnpm",
			["install", "--frozen-lockfile", "--prefer-offline"],
			{ cwd: buildDir, timeoutMs: INSTALL_TIMEOUT_MS },
		);
		await mustExec(sandbox, "frontend_build_failed", "pnpm", ["run", "build"], {
			cwd: buildDir,
			timeoutMs: BUILD_TIMEOUT_MS,
		});
		const dist = await readDist(sandbox, `${buildDir}/dist`);

		// The installer is a public download, so a key in the frontend leaks.
		// A `warn` finding (a Google browser key) does not block, as in a publish.
		const secrets = await new SecretScanGate().run({
			buildId: build.id,
			files: dist.map((file) => ({
				content: file.content,
				path: `dist/${file.path}`,
			})),
			projectId: build.projectId,
		});
		const findings: DesktopGateFinding[] = secrets.flatMap((finding) =>
			finding.kind === "secret" && finding.severity === "block"
				? [
						desktopGateFinding(
							"secret_in_frontend",
							finding.path,
							`${finding.rule} ${finding.sample}`,
						),
					]
				: [],
		);
		findings.push(...migrationFolder.findings);
		if (findings.length > 0) {
			return { findings, kind: "blocked" };
		}

		const frozen = await deps.migrations.listFrozen(build.projectId);
		let gateFindings: DesktopGateFinding[];
		try {
			gateFindings = await checkDesktopMigrations(
				migrationFolder.files,
				frozen,
			);
		} catch (error) {
			// The gate throws only when sql.js does not load. A check that
			// cannot run never lets the build pass.
			throw new DesktopBuildFailure(
				"gate_unavailable",
				`The migration gate could not run: ${getErrorMessage(error)}`,
			);
		}
		if (gateFindings.length > 0) {
			return { findings: gateFindings, kind: "blocked" };
		}
		return {
			dist,
			kind: "ready",
			migrations: planDesktopMigrations(migrationFolder.files, frozen)
				.migrations,
			theme: themeFile?.file ?? null,
		};
	} finally {
		// Best effort: a left folder costs disk only, and the next sandbox
		// rebuild drops /tmp.
		for (const dir of worktreeDirs) {
			const removed = await sandbox
				.exec("git", ["worktree", "remove", "--force", dir], {
					cwd: sandbox.workspaceDir,
					timeoutMs: COMMAND_TIMEOUT_MS,
				})
				.catch((error: unknown) => ({
					exitCode: -1,
					stderr: getErrorMessage(error),
					stdout: "",
				}));
			if (removed.exitCode !== 0) {
				deps.logger.warn("desktop-build.worktree-remove-failed", {
					buildId: build.id,
					error: removed.stderr.slice(-STDERR_TAIL_LENGTH),
					projectId: build.projectId,
				});
			}
		}
	}
}

/**
 * Reads the Vite output under `distDir` with the limits of section 9: no
 * symlink, an `index.html`, at most 5,000 files and 100 MB. The archive
 * writer refuses an unsafe path later.
 */
async function readDist(
	sandbox: Pick<SandboxHandle, "exec" | "readFile">,
	distDir: string,
): Promise<DesktopBuildInputFile[]> {
	// Security: a symlink could make the read take a file outside the output.
	const links = await mustExec(
		sandbox,
		"output_invalid",
		"find",
		[distDir, "-type", "l"],
		{ timeoutMs: COMMAND_TIMEOUT_MS },
	);
	const firstLink = links.stdout.split("\n").find((line) => line !== "");
	if (firstLink !== undefined) {
		throw new DesktopBuildFailure(
			"output_invalid",
			`The build output holds a symlink: ${firstLink}`,
		);
	}
	const listing = await mustExec(
		sandbox,
		"output_invalid",
		"find",
		[distDir, "-type", "f", "-printf", "%P\\t%s\\n"],
		{ timeoutMs: COMMAND_TIMEOUT_MS },
	);
	const entries = parseDistListing(listing.stdout);
	if (!entries.some((entry) => entry.path === "index.html")) {
		throw new DesktopBuildFailure(
			"output_invalid",
			"The build output has no index.html",
		);
	}
	const bytes = entries.reduce((sum, entry) => sum + entry.size, 0);
	if (entries.length > MAX_DIST_FILES || bytes > MAX_DIST_BYTES) {
		throw new DesktopBuildFailure(
			"output_invalid",
			`The build output has ${entries.length} files and ${bytes} bytes`,
		);
	}
	const files: DesktopBuildInputFile[] = [];
	for (let start = 0; start < entries.length; start += READ_BATCH_SIZE) {
		const batch = await Promise.all(
			entries.slice(start, start + READ_BATCH_SIZE).map(async (entry) => ({
				content: await sandbox.readFile(`${distDir}/${entry.path}`),
				entry,
			})),
		);
		for (const { content, entry } of batch) {
			// A file that changed after the listing could break the size limit.
			if (content === null || content.byteLength !== entry.size) {
				throw new DesktopBuildFailure(
					"output_invalid",
					`The output file ${entry.path} changed during the read`,
				);
			}
			files.push({ content, path: entry.path });
		}
	}
	return files;
}

// One line per file: `<path>\t<size>`. A path with a tab or a newline
// breaks the format, so the line is refused, not guessed.
function parseDistListing(stdout: string): { path: string; size: number }[] {
	const entries: { path: string; size: number }[] = [];
	for (const line of stdout.split("\n")) {
		if (line === "") {
			continue;
		}
		const [path, size, ...rest] = line.split("\t");
		if (
			path === undefined ||
			path === "" ||
			size === undefined ||
			!/^\d+$/.test(size) ||
			rest.length > 0
		) {
			throw new DesktopBuildFailure(
				"output_invalid",
				`The build output has a file name the task cannot read: ${line.slice(0, 200)}`,
			);
		}
		entries.push({ path, size: Number(size) });
	}
	return entries;
}

/**
 * Prints one record per entry of the folder `$1`: "<type>\t<bytes>\t<name>\0".
 * The type is the `find -printf %y` letter ("f" for a regular file). `find`
 * does not follow a symlink. `head` keeps at most `$2` records, so stdout
 * stays small; `find` then exits 141 (SIGPIPE), which is not a failure. A
 * missing folder prints nothing. A symlink or a file in its place exits 46.
 */
const LIST_MIGRATIONS_SCRIPT = [
	"dir=$1; cap=$2",
	'[ -e "$dir" ] || [ -L "$dir" ] || exit 0',
	`[ -d "$dir" ] && [ ! -L "$dir" ] || exit ${NOT_A_FOLDER_EXIT_CODE}`,
	'find "$dir" -mindepth 1 -maxdepth 1 -printf \'%y\\t%s\\t%f\\0\' | head -z -n "$cap"',
	`s=("\${PIPESTATUS[@]}")`,
	`{ [ "\${s[0]}" -eq 0 ] || [ "\${s[0]}" -eq 141 ]; } && [ "\${s[1]}" -eq 0 ] || exit 1`,
].join("\n");

// `ignoreBOM` keeps a byte order mark in the text, so the text hashes like the
// file bytes. `fatal` throws on an invalid byte instead of a U+FFFD, which
// would change the hash.
const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/**
 * Lists and reads `migrationsDir` of the build worktree. Security: the count
 * and size limits apply to the listing before any read, so a large folder
 * never fills the task memory. A broken limit or an entry that is not a
 * regular file gives a finding: the build is blocked, not failed.
 */
async function readMigrations(
	sandbox: Pick<SandboxHandle, "exec" | "readFile">,
	migrationsDir: string,
): Promise<{ files: DesktopMigrationFile[]; findings: DesktopGateFinding[] }> {
	// One record more than the limit shows a folder that is too large.
	const listed = await sandbox.exec(
		"bash",
		[
			"-c",
			LIST_MIGRATIONS_SCRIPT,
			"bash",
			migrationsDir,
			String(DESKTOP_MIGRATIONS_MAX_COUNT + 1),
		],
		{ timeoutMs: COMMAND_TIMEOUT_MS },
	);
	if (listed.exitCode === NOT_A_FOLDER_EXIT_CODE) {
		return {
			files: [],
			findings: [
				desktopGateFinding(
					"migration_name_invalid",
					DESKTOP_MIGRATIONS_DIR,
					`${DESKTOP_MIGRATIONS_DIR} must be a folder, not a symlink or a file.`,
				),
			],
		};
	}
	if (listed.exitCode !== 0) {
		throw new DesktopBuildFailure(
			"sandbox_failed",
			`The migrations listing failed (${listed.exitCode}): ${listed.stderr.slice(-STDERR_TAIL_LENGTH)}`,
		);
	}
	const entries = parseMigrationListing(listed.stdout);
	const findings: DesktopGateFinding[] = [];
	if (entries.length > DESKTOP_MIGRATIONS_MAX_COUNT) {
		findings.push(
			desktopGateFinding(
				"migration_too_large",
				DESKTOP_MIGRATIONS_DIR,
				`The folder holds more than ${DESKTOP_MIGRATIONS_MAX_COUNT} entries.`,
			),
		);
	}
	for (const entry of entries) {
		const path = `${DESKTOP_MIGRATIONS_DIR}/${entry.name}`;
		// A symlink, a folder, or a FIFO is never read: its listed size says nothing about its content.
		if (entry.type !== "f") {
			findings.push(
				desktopGateFinding(
					"migration_name_invalid",
					path,
					"Only regular .sql files may be in the migrations folder.",
				),
			);
		} else if (entry.bytes > DESKTOP_MIGRATION_MAX_BYTES) {
			findings.push(
				desktopGateFinding(
					"migration_too_large",
					path,
					`The file has ${entry.bytes} bytes. The limit is ${DESKTOP_MIGRATION_MAX_BYTES}.`,
				),
			);
		}
	}
	const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
	if (totalBytes > DESKTOP_MIGRATIONS_MAX_TOTAL_BYTES) {
		findings.push(
			desktopGateFinding(
				"migration_too_large",
				DESKTOP_MIGRATIONS_DIR,
				`The files have ${totalBytes} bytes in total. The limit is ${DESKTOP_MIGRATIONS_MAX_TOTAL_BYTES}.`,
			),
		);
	}
	if (findings.length > 0) {
		return { files: [], findings };
	}
	const files: DesktopMigrationFile[] = [];
	for (const entry of entries) {
		const content = await sandbox.readFile(`${migrationsDir}/${entry.name}`);
		if (content === null || content.byteLength !== entry.bytes) {
			throw new DesktopBuildFailure(
				"output_invalid",
				`${DESKTOP_MIGRATIONS_DIR}/${entry.name} changed during the read`,
			);
		}
		try {
			files.push({ fileName: entry.name, sql: UTF8.decode(content) });
		} catch {
			// The fatal decoder throws only on an invalid byte. build.rs embeds
			// the file with include_str!, which refuses it too.
			findings.push(
				desktopGateFinding(
					"migration_dry_run_failed",
					`${DESKTOP_MIGRATIONS_DIR}/${entry.name}`,
					"The file is not UTF-8 text. The app embeds each migration as UTF-8.",
				),
			);
		}
	}
	return findings.length > 0 ? { files: [], findings } : { files, findings };
}

// Reads the NUL-ended records of LIST_MIGRATIONS_SCRIPT. A name can hold a
// tab or a newline, so only the first two tabs split a record. A record in
// another form throws: the listing is not trusted.
function parseMigrationListing(
	stdout: string,
): { type: string; bytes: number; name: string }[] {
	return stdout
		.split("\0")
		.slice(0, -1)
		.map((record) => {
			const match = /^([a-zA-Z])\t(\d+)\t([^/]+)$/.exec(record);
			if (match === null) {
				throw new DesktopBuildFailure(
					"output_invalid",
					`The migrations listing has a record the task cannot read: ${JSON.stringify(record.slice(0, 200))}`,
				);
			}
			const [, type = "", bytes = "", name = ""] = match;
			return { bytes: Number(bytes), name, type };
		});
}

/** What one staged file is. It sets the magic check and the error texts. */
type StagedFileKind = "windows_installer" | "disk_image" | "update_archive";

// The name and the format of each staged file for the error texts, and its
// magic bytes. `atEnd` puts the magic at the start of the disk image trailer.
const STAGED_FILES = {
	disk_image: {
		atEnd: true,
		format: "a UDIF disk image",
		label: "disk image",
		magic: DMG_TRAILER_MAGIC,
	},
	update_archive: {
		atEnd: false,
		format: "gzip",
		label: "update archive",
		magic: GZIP_MAGIC,
	},
	windows_installer: {
		atEnd: false,
		format: "a Windows executable",
		label: "installer",
		magic: EXE_MAGIC,
	},
} as const satisfies Record<
	StagedFileKind,
	{ atEnd: boolean; format: string; label: string; magic: Buffer }
>;

/**
 * Streams one staged file from R2 to `filePath`. Section 9: at most 300 MB,
 * and its magic bytes must match `kind`. Answers its size and SHA-256 hex.
 */
async function downloadStagedFile(
	fetchFn: typeof fetch,
	url: string,
	filePath: string,
	kind: StagedFileKind,
): Promise<{ bytes: number; sha256: string }> {
	const { atEnd, format, label, magic } = STAGED_FILES[kind];
	const response = await fetchFn(url, {
		signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
	});
	if (response.status === 404) {
		await response.body?.cancel();
		throw new DesktopBuildFailure(
			"artifact_invalid",
			`The CI run ended without a staged ${label}`,
		);
	}
	if (!response.ok || response.body === null) {
		await response.body?.cancel();
		throw new Error(`The staged ${label} read answered ${response.status}`);
	}
	// R2 sends the object size, so an oversized file stops before the read.
	const declaredBytes = Number(response.headers.get("content-length") ?? "0");
	if (declaredBytes > MAX_INSTALLER_BYTES) {
		await response.body.cancel();
		throw new DesktopBuildFailure(
			"artifact_invalid",
			`The staged ${label} has ${declaredBytes} bytes. The limit is ${MAX_INSTALLER_BYTES}.`,
		);
	}
	const hash = createHash("sha256");
	let bytes = 0;
	await pipeline(
		Readable.fromWeb(response.body),
		// The count also stops a body that is longer than its header said.
		async function* (source: AsyncIterable<Buffer>) {
			for await (const chunk of source) {
				bytes += chunk.byteLength;
				if (bytes > MAX_INSTALLER_BYTES) {
					throw new DesktopBuildFailure(
						"artifact_invalid",
						`The staged ${label} is larger than ${MAX_INSTALLER_BYTES} bytes`,
					);
				}
				hash.update(chunk);
				yield chunk;
			}
		},
		createWriteStream(filePath, { flags: "wx" }),
	);
	// A disk image has its magic at the start of the trailer, not at byte 0.
	const position = atEnd ? bytes - DMG_TRAILER_BYTES : 0;
	// A file shorter than the magic or the trailer keeps zero bytes here and fails.
	const found = Buffer.alloc(magic.byteLength);
	if (position >= 0) {
		const file = await open(filePath, "r");
		try {
			await file.read(found, 0, found.byteLength, position);
		} finally {
			await file.close();
		}
	}
	if (!found.equals(magic)) {
		throw new DesktopBuildFailure(
			"artifact_invalid",
			`The staged ${label} is not ${format}`,
		);
	}
	return { bytes, sha256: hash.digest("hex") };
}

/**
 * Decrypts the updater key of the app, signs one update file (section 10),
 * and verifies the signature. A miss throws `signing_failed`.
 */
async function signUpdateFile(
	deps: Pick<DesktopBuildDeps, "now">,
	input: {
		app: DesktopAppRow;
		/** The file name in the trusted comment, for example `stock-1.0.3.app.tar.gz`. */
		fileName: string;
		filePath: string;
		/** `APP_SECRETS_ENCRYPTION_KEY` of the worker. */
		secretsKey: string;
		version: string;
	},
): Promise<string> {
	let signature: string;
	try {
		signature = await signUpdaterArtifact({
			fileName: input.fileName,
			filePath: input.filePath,
			keyId: input.app.updaterKeyId,
			privateKeyPkcs8: decryptDesktopUpdaterKey(
				parseSecretKeyRing(input.secretsKey),
				input.app,
			),
			// Unix seconds, as minisign writes the timestamp.
			timestamp: Math.floor(deps.now() / 1000),
			version: input.version,
		});
	} catch (error) {
		throw new DesktopBuildFailure(
			"signing_failed",
			`The update file could not be signed: ${getErrorMessage(error)}`,
		);
	}
	// Security: an installed app refuses an update whose signature fails.
	// So a signature that does not verify never reaches R2.
	const isValid = await verifyUpdaterSignature({
		filePath: input.filePath,
		publicKey: input.app.updaterPublicKey,
		signature,
		version: input.version,
	});
	if (!isValid) {
		throw new DesktopBuildFailure(
			"signing_failed",
			"The updater signature does not verify with the public key of the app",
		);
	}
	return signature;
}

// Runs one R2 write; any error becomes `upload_failed`.
async function mustStore(
	operation: string,
	write: () => Promise<void>,
): Promise<void> {
	try {
		await write();
	} catch (error) {
		throw new DesktopBuildFailure(
			"upload_failed",
			`The ${operation} failed: ${getErrorMessage(error)}`,
		);
	}
}

// Runs one command in the sandbox; a non-zero exit throws `failure` with
// the tail of stderr. A vendor error means the sandbox stopped.
async function mustExec(
	sandbox: Pick<SandboxHandle, "exec">,
	failure: DesktopBuildErrorCode,
	command: string,
	args: string[],
	options: { cwd?: string; timeoutMs: number },
): Promise<SandboxExecResult> {
	let result: SandboxExecResult;
	try {
		result = await sandbox.exec(command, args, options);
	} catch (error) {
		throw new DesktopBuildFailure(
			"sandbox_failed",
			`${command} ${args[0] ?? ""} did not run: ${getErrorMessage(error)}`,
		);
	}
	if (result.exitCode !== 0) {
		const output = result.stderr.trim() === "" ? result.stdout : result.stderr;
		throw new DesktopBuildFailure(
			failure,
			`${command} ${args[0] ?? ""} failed (${result.exitCode}): ${output.slice(-STDERR_TAIL_LENGTH)}`,
		);
	}
	return result;
}

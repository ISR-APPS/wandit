import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import {
	DESKTOP_MIGRATION_MAX_BYTES,
	type DesktopBuildStatus,
	type DesktopEngine,
	type DesktopGateRule,
	type DesktopPlatform,
	type GithubWorkflowRun,
	type SuspendedReasonCode,
} from "@wandit/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { desktopStatusesThatMayMoveTo } from "../modules/app-builder/domain/desktop-build";
import {
	type ReleasedDesktopMigration,
	sha256OfMigration,
} from "../modules/app-builder/domain/desktop-migrations";
import type {
	DesktopBuildDispatchInput,
	DesktopBuildRunner,
} from "../modules/app-builder/domain/ports/desktop-build-runner";
import {
	packTarGzip,
	type TarEntry,
} from "../modules/app-builder/infrastructure/desktop/desktop-build-input";
import {
	encryptDesktopUpdaterKey,
	generateUpdaterKeyPair,
	verifyElectronUpdateSignature,
	verifyUpdaterSignature,
} from "../modules/app-builder/infrastructure/desktop/updater-signature";
import type {
	DesktopAppRow,
	DesktopBuildRow,
	DesktopBuildTransition,
} from "../modules/app-builder/infrastructure/persistence/desktop-builds.repository";
import { FakeSandboxProvider } from "../modules/app-builder/infrastructure/sandbox/fake-sandbox.provider";
import { parseSecretKeyRing } from "../modules/app-builder/infrastructure/secrets/secret-crypto";
import type { MeteringService } from "../modules/metering/application/services/metering.service";
import type { AiUsageEvent } from "../modules/metering/domain/metering";
import { DESKTOP_BUILD_CREDITS_CENTI } from "../modules/metering/domain/operation-registry";
import {
	type DesktopBuildDeps,
	runDesktopBuild,
} from "./desktop-build.runtime";

const BUILD_ID = "0f3c7a6e-8a51-4b0e-9d4f-2f2b8c1e6a10";
const PROJECT_ID = "7b1e2d3c-4a5b-4c6d-8e9f-0a1b2c3d4e5f";
const REQUEST_KEY = "c0ffee00-0000-4000-8000-000000000001";
const HOLD_ID = "11111111-1111-4111-8111-111111111111";
const CI_RUN_ID = "4242";
const BUILD_DIR = `/tmp/wandit-desktop/${BUILD_ID}`;
const OK = { exitCode: 0, stderr: "", stdout: "" };
const RING_TEXT = `v1:${Buffer.alloc(32, 7).toString("base64")}`;
const INIT_SQL =
	"CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);";
const DIST_FILES: Record<string, string> = {
	"assets/index.js": "console.log('app');",
	"index.html": "<!doctype html><script src='/assets/index.js'></script>",
};

const UPDATER_KEYS = generateUpdaterKeyPair();
const OTHER_KEYS = generateUpdaterKeyPair();
// The `.app` folder of build-macos.yml as the re-pack writes it, with the 3 files it requires.
const APP_ENTRIES: TarEntry[] = [
	{ content: new Uint8Array(), path: "stock-manager.app/", type: "folder" },
	{
		content: new Uint8Array(),
		path: "stock-manager.app/Contents/",
		type: "folder",
	},
	{
		content: Buffer.from("<plist/>"),
		path: "stock-manager.app/Contents/Info.plist",
		type: "file",
	},
	{
		content: new Uint8Array(),
		path: "stock-manager.app/Contents/MacOS/",
		type: "folder",
	},
	{
		content: randomBytes(1024),
		path: "stock-manager.app/Contents/MacOS/stock-manager",
		type: "executable",
	},
	{
		content: new Uint8Array(),
		path: "stock-manager.app/Contents/_CodeSignature/",
		type: "folder",
	},
	{
		content: Buffer.from("<plist/>"),
		path: "stock-manager.app/Contents/_CodeSignature/CodeResources",
		type: "file",
	},
];
// The archive that the fake CI stages. Its binary has mode 0644. The re-pack
// sets 0755, so the stored archive has other bytes than the staged archive.
const STAGED_APP_ENTRIES = APP_ENTRIES.map(
	(entry): TarEntry =>
		entry.type === "executable" ? { ...entry, type: "file" } : entry,
);

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { force: true, recursive: true });
	}
});

function tempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "desktop-build-spec-"));
	tempDirs.push(dir);
	return dir;
}

function appRow(overrides: Partial<DesktopAppRow> = {}): DesktopAppRow {
	const encrypted = encryptDesktopUpdaterKey(
		parseSecretKeyRing(RING_TEXT),
		PROJECT_ID,
		UPDATER_KEYS.privateKeyPkcs8,
	);
	return {
		binaryName: "stock-manager",
		createdAt: new Date("2026-11-01T00:00:00.000Z"),
		currentMacosBuildId: null,
		currentWindowsBuildId: null,
		organizationId: null,
		productName: "Stock Manager",
		projectId: PROJECT_ID,
		updatedAt: new Date("2026-11-01T00:00:00.000Z"),
		updaterKeyId: UPDATER_KEYS.keyId,
		updaterKeyVersion: encrypted.keyVersion,
		updaterPrivateKeyCiphertext: encrypted.ciphertext,
		updaterPublicKey: UPDATER_KEYS.publicKey,
		userId: "user-1",
		...overrides,
	};
}

function buildRow(platform: DesktopPlatform): DesktopBuildRow {
	return {
		ciRunId: null,
		commitSha: "a".repeat(40),
		completedAt: null,
		createdAt: new Date("2026-11-01T00:00:00.000Z"),
		errorCode: null,
		errorMessage: null,
		findings: [],
		id: BUILD_ID,
		installerBytes: null,
		installerKey: null,
		installerSha256: null,
		notes: null,
		organizationId: null,
		platform,
		productName: "Stock Manager",
		projectId: PROJECT_ID,
		releaseNumber: 3,
		releasedAt: null,
		requestKey: REQUEST_KEY,
		status: "queued",
		triggerRunId: null,
		updateArchiveKey: null,
		updatedAt: new Date("2026-11-01T00:00:00.000Z"),
		updaterSignature: null,
		userId: "user-1",
		version: "1.0.3",
	};
}

function holdEvent(
	status: AiUsageEvent["status"],
	overrides: Partial<AiUsageEvent> = {},
): AiUsageEvent {
	return {
		attemptRef: null,
		cacheReadTokens: null,
		cacheWriteTokens: null,
		chatId: null,
		createdAt: new Date("2026-11-01T00:00:00.000Z"),
		estimatedCostUsdMicros: null,
		executionLeaseExpiresAt: null,
		executionLeaseToken: null,
		finalCredits: null,
		id: HOLD_ID,
		idempotencyKey: `desktop_build:${PROJECT_ID}:${REQUEST_KEY}`,
		inputTokens: null,
		messageId: null,
		model: null,
		nextReconcileAttemptAt: null,
		operation: "desktop_build",
		organizationId: null,
		outputTokens: null,
		parentEventId: null,
		payerUserId: null,
		pricingSnapshot: null,
		projectId: PROJECT_ID,
		provider: null,
		rawUsage: null,
		reconcileAttempts: 0,
		reconciledAt: null,
		reconciledCostUsdMicros: null,
		reservedCredits: DESKTOP_BUILD_CREDITS_CENTI,
		settledAt: null,
		status,
		userId: "user-1",
		...overrides,
	};
}

// Records the money writes. The hold moves to `settled` or `refunded` like the real service.
class FakeMetering {
	hold: AiUsageEvent | null = holdEvent("reserved");
	readonly calls: string[] = [];
	readonly refundReasons: string[] = [];

	async findByIdempotencyKeyAnyPayer(): Promise<AiUsageEvent | null> {
		return this.hold;
	}

	async acquireExecutionLease(): Promise<AiUsageEvent | null> {
		this.calls.push("lease");
		return this.hold;
	}

	async heartbeatExecutionLease(): Promise<"renewed"> {
		return "renewed";
	}

	async releaseExecutionLease(): Promise<void> {}

	async settle(
		..._args: Parameters<MeteringService["settle"]>
	): Promise<AiUsageEvent> {
		this.calls.push("settle");
		this.hold = holdEvent("settled");
		return this.hold;
	}

	async refund(_eventId: string, reason = "ai_usage_refund") {
		this.calls.push("refund");
		this.refundReasons.push(reason);
		this.hold = holdEvent("refunded");
		return this.hold;
	}
}

/** The rows that the fakes read. A test changes them to model the API or staff. */
type FakeState = {
	row: DesktopBuildRow | null;
	/** `projects.suspended_reason_code`, read by `findForTurn`. */
	suspendedReasonCode: SuspendedReasonCode | null;
	/** The project delete ran: `findForTurn` answers null, and `deleteApp` removed the app row. */
	projectDeleted: boolean;
};

type SetupOptions = {
	app?: DesktopAppRow;
	/** The platform of the build row. Default windows. */
	platform?: DesktopPlatform;
	/** `projects.desktop_engine` of the project, as `findForTask` answers it. Default tauri. */
	engine?: DesktopEngine;
	/** The files of `dist/` after the build, by path inside `dist/`. Default DIST_FILES. */
	dist?: Record<string, string>;
	frozen?: ReleasedDesktopMigration[];
	/** Replaces the `bash` answer of the migrations listing: NUL-ended "<type>\t<bytes>\t<name>" records. */
	migrationListing?: string;
	/** The bytes of `migrations/0001_init.sql`. Default INIT_SQL. */
	initMigration?: Uint8Array;
	/** The bytes that the fake CI uploads to the staged installer key: the setup exe or the disk image. */
	installer?: Buffer;
	/** macOS only: the `.app.tar.gz` that the fake CI uploads. Default STAGED_APP_ENTRIES. */
	updateArchive?: Buffer;
	/** Replaces the R2 answer of every staged file read. */
	stagedResponse?: () => Response;
	/** The scripted GitHub run reads; the last one repeats. */
	runs?: Pick<GithubWorkflowRun, "status" | "conclusion">[];
	/** The answer of `hasFailedSelfTest`. Default false. */
	selfTestFailed?: boolean;
	/** A rebuild: `findMigrationsCommit` answers this commit, whose worktree holds these `migrations/` files. */
	rebuild?: { migrationsCommit: string; migrations: Record<string, string> };
};

async function setup(options: SetupOptions = {}) {
	let fakeNow = 0;
	const hooks: {
		onSleep: () => void;
		onBuildFileUpload: () => void;
		/** Runs after the fake repository refuses a transition, before it answers null. */
		onTransitionRefused: () => void;
	} = {
		onBuildFileUpload: () => undefined,
		onSleep: () => undefined,
		onTransitionRefused: () => undefined,
	};
	const transitions: DesktopBuildTransition[] = [];
	const state: FakeState = {
		projectDeleted: false,
		row: buildRow(options.platform ?? "windows"),
		suspendedReasonCode: null,
	};
	const initMigration = options.initMigration ?? Buffer.from(INIT_SQL);
	const app = options.app ?? appRow();
	const metering = new FakeMetering();
	// A disk image ends with a 512-byte UDIF trailer that starts with "koly".
	const installer =
		options.installer ??
		(options.platform === "macos"
			? Buffer.concat([
					randomBytes(2048),
					Buffer.from("koly"),
					Buffer.alloc(508),
				])
			: Buffer.concat([Buffer.from("MZ"), randomBytes(2048)]));
	const updateArchive =
		options.updateArchive ?? packTarGzip(STAGED_APP_ENTRIES);
	const distFiles = options.dist ?? DIST_FILES;

	// R2 as a map. The presigned URLs carry the key in clear.
	const objects = new Map<string, Uint8Array>();
	const putKeys: string[] = [];
	const uploads: { inputArchive: Uint8Array | null } = { inputArchive: null };
	const storage: NonNullable<DesktopBuildDeps["storage"]> = {
		deleteObject: async (key) => {
			objects.delete(key);
		},
		presignGet: async (key) => `https://r2.test/get/${key}`,
		presignPut: async (key) => `https://r2.test/put/${key}`,
		putInput: async (key, bytes) => {
			putKeys.push(key);
			uploads.inputArchive = bytes;
			objects.set(key, bytes);
		},
		putBuildFile: async (key, filePath) => {
			putKeys.push(key);
			objects.set(key, readFileSync(filePath));
			hooks.onBuildFileUpload();
		},
	};

	// The CI uploads its files to the presigned PUT URLs at dispatch.
	const dispatches: DesktopBuildDispatchInput[] = [];
	const cancels: string[] = [];
	const runs = options.runs ?? [{ conclusion: "success", status: "completed" }];
	const runner: DesktopBuildRunner = {
		cancel: async (runId) => {
			cancels.push(runId);
		},
		dispatch: async (input) => {
			dispatches.push(input);
			objects.set(
				input.outputUrl.replace("https://r2.test/put/", ""),
				installer,
			);
			if (input.platform === "macos" && input.engine === "tauri") {
				objects.set(
					input.updateUrl.replace("https://r2.test/put/", ""),
					updateArchive,
				);
			}
			return { runId: CI_RUN_ID, runUrl: "https://github.com/run/4242" };
		},
		getRun: async () => {
			const run = (runs.length > 1 ? runs.shift() : runs[0]) ?? runs[0];
			return {
				conclusion: run?.conclusion ?? null,
				html_url: "https://github.com/run/4242",
				id: Number(CI_RUN_ID),
				status: run?.status ?? "queued",
			};
		},
		hasFailedSelfTest: async () => options.selfTestFailed ?? false,
	};

	// The sandbox holds the build output and the migrations of the worktree.
	const sandboxes = new FakeSandboxProvider();
	const handle = await sandboxes.getOrCreate(PROJECT_ID, {
		devCommand: "pnpm run dev",
		devPort: 5173,
		env: {},
		framework: "desktop-app",
		organizationId: null,
		ownerUserId: "user-1",
		templateVersion: "desktop-app@1.0.0",
	});
	await handle.writeFiles([
		...Object.entries(distFiles).map(([path, content]) => ({
			content,
			path: `${BUILD_DIR}/dist/${path}`,
		})),
		{ content: initMigration, path: `${BUILD_DIR}/migrations/0001_init.sql` },
		...Object.entries(options.rebuild?.migrations ?? {}).map(
			([name, content]) => ({
				content,
				path: `${BUILD_DIR}-migrations/migrations/${name}`,
			}),
		),
	]);
	sandboxes.respondTo("git", OK); // worktree add
	sandboxes.respondTo("pnpm", OK); // install
	sandboxes.respondTo("pnpm", OK); // build
	sandboxes.respondTo("find", OK); // theme.json: none
	sandboxes.respondTo("find", OK); // symlinks: none
	sandboxes.respondTo("find", {
		...OK,
		stdout: Object.entries(distFiles)
			.map(([path, text]) => `${path}\t${Buffer.byteLength(text)}\n`)
			.join(""),
	});
	sandboxes.respondTo("bash", {
		...OK,
		stdout:
			options.migrationListing ??
			`f\t${initMigration.byteLength}\t0001_init.sql\0`,
	});
	sandboxes.respondTo("git", OK); // worktree remove
	if (options.rebuild !== undefined) {
		sandboxes.respondTo("git", OK); // migrations worktree add
		sandboxes.respondTo("git", OK); // migrations worktree remove
	}

	const shellDir = tempDir();
	writeFileSync(join(shellDir, "tauri.conf.json"), "{}");
	writeFileSync(join(shellDir, "Cargo.toml"), "[package]\n");
	const electronShellDir = tempDir();
	writeFileSync(join(electronShellDir, "package.json"), "{}\n");

	const deps = {
		appSecretsEncryptionKey: RING_TEXT,
		backends: { findByProjectId: async () => null },
		billingDisabled: false,
		builds: {
			findById: async () => state.row,
			findForTask: async () =>
				state.row === null
					? null
					: {
							app: state.projectDeleted ? null : app,
							build: state.row,
							engine: options.engine ?? "tauri",
						},
			findMigrationsCommit: async (_projectId: string, commitSha: string) =>
				options.rebuild?.migrationsCommit ?? commitSha,
			transition: async (_buildId: string, change: DesktopBuildTransition) => {
				transitions.push(change);
				// The repository refuses `ready` for a suspended project.
				if (
					state.row === null ||
					!desktopStatusesThatMayMoveTo(change.to).includes(state.row.status) ||
					(change.to === "ready" && state.suspendedReasonCode !== null)
				) {
					hooks.onTransitionRefused();
					return null;
				}
				state.row = { ...state.row, status: change.to };
				return state.row;
			},
		},
		captureException: () => undefined,
		fetch: async (url: string | URL | Request) => {
			if (options.stagedResponse !== undefined) {
				return options.stagedResponse();
			}
			const object = objects.get(
				String(url).replace("https://r2.test/get/", ""),
			);
			return object === undefined
				? new Response(null, { status: 404 })
				: new Response(object);
		},
		logger: {
			error: () => undefined,
			info: () => undefined,
			warn: () => undefined,
		},
		metering,
		migrations: { listFrozen: async () => options.frozen ?? [] },
		now: () => fakeNow,
		projects: {
			findForTurn: async () =>
				state.projectDeleted
					? null
					: {
							engine: "v2_app" as const,
							framework: "desktop-app",
							languages: ["en"],
							networkAllowedHosts: [],
							organizationId: null,
							suspendedReasonCode: state.suspendedReasonCode,
							templateVersion: "desktop-app@1.0.0",
							userId: "user-1",
						},
		},
		runner,
		sandboxes,
		shellDirs: { electron: electronShellDir, tauri: shellDir },
		sleep: async (ms: number) => {
			fakeNow += ms;
			hooks.onSleep();
		},
		storage,
		updatesUrl: (key: string) => `https://updates.wandit.test/${key}`,
	} satisfies DesktopBuildDeps;

	const run = () =>
		runDesktopBuild(deps, {
			buildId: BUILD_ID,
			projectId: PROJECT_ID,
			triggerRunId: "run_1",
		});
	return {
		app,
		cancels,
		dispatches,
		hooks,
		get inputArchive() {
			return uploads.inputArchive;
		},
		installer,
		metering,
		objects,
		putKeys,
		run,
		sandboxes,
		state,
		transitions,
	};
}

// The random part keeps an installer unknown before `ready` (audit A1). The
// project prefix lets a suspend and a delete remove it.
const INSTALLER_KEY_PATTERN = new RegExp(
	`^desktop/${PROJECT_ID}/builds/${BUILD_ID}-[0-9a-f]{32}/stock-manager-1\\.0\\.3-setup\\.exe$`,
);

describe("runDesktopBuild", () => {
	it.each<[string, SetupOptions, DesktopGateRule, number]>([
		[
			// Installed apps ran another text of 0001: the gate refuses the change.
			"a released migration whose text changed",
			{ frozen: [{ name: "init", sha256: "0".repeat(64), version: 1 }] },
			"migration_released_changed",
			1,
		],
		[
			"a live key in the frontend",
			{
				dist: {
					...DIST_FILES,
					"assets/index.js": `const key = "sk_live_${"Ab3".repeat(8)}";`,
				},
			},
			"secret_in_frontend",
			1,
		],
		// The listing caps apply before any read: the task never reads these files.
		[
			"a symlink in migrations/",
			{ migrationListing: "l\t13\t0001_init.sql\0" },
			"migration_name_invalid",
			0,
		],
		[
			"a migration above the size limit",
			{
				migrationListing: `f\t${DESKTOP_MIGRATION_MAX_BYTES + 1}\t0001_init.sql\0`,
			},
			"migration_too_large",
			0,
		],
		[
			// Saved as Windows-1252: the é is the one byte 0xE9, which is not UTF-8.
			"a migration that is not UTF-8",
			{
				initMigration: Buffer.from(
					"CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT 'caf\u00e9');",
					"latin1",
				),
			},
			"migration_dry_run_failed",
			1,
		],
	])("blocks on %s: the hold is released and CI never starts", async (_label, options, rule, migrationReads) => {
		const ctx = await setup(options);

		const result = await ctx.run();

		expect(result).toEqual({ errorCode: null, outcome: "blocked" });
		expect(ctx.state.row?.status).toBe("blocked");
		expect(
			ctx.transitions.flatMap((change) =>
				change.to === "blocked" ? change.findings.map((f) => f.rule) : [],
			),
		).toEqual([rule]);
		expect(ctx.metering.refundReasons).toEqual(["desktop_build_blocked"]);
		expect(ctx.dispatches).toEqual([]);
		expect(ctx.putKeys).toEqual([]);
		expect(
			ctx.sandboxes.calls.filter(
				(call) =>
					call.method === "readFile" &&
					call.detail?.startsWith(`${BUILD_DIR}/migrations/`),
			),
		).toHaveLength(migrationReads);
	});

	it("signs a verified installer, writes the migrations with ready, and settles the hold", async () => {
		const ctx = await setup({
			runs: [
				{ conclusion: null, status: "in_progress" },
				{ conclusion: "success", status: "completed" },
			],
		});

		const result = await ctx.run();

		expect(result).toEqual({ errorCode: null, outcome: "ready" });
		// CI checks the download with this SHA-256, so it must match the upload.
		expect(ctx.dispatches.map((input) => input.inputSha256)).toEqual([
			createHash("sha256")
				.update(ctx.inputArchive ?? "")
				.digest("hex"),
		]);
		const ready = ctx.transitions.find((change) => change.to === "ready");
		const installerKey = ready?.to === "ready" ? ready.installerKey : "";
		expect(installerKey).toMatch(INSTALLER_KEY_PATTERN);
		expect(ready).toMatchObject({
			installerBytes: ctx.installer.length,
			installerSha256: createHash("sha256").update(ctx.installer).digest("hex"),
			migrations: [
				{ name: "init", sha256: sha256OfMigration(INIT_SQL), version: 1 },
			],
		});
		// The input and the staged file are gone; only the signed installer stays.
		expect([...ctx.objects.keys()]).toEqual([installerKey]);
		const uploaded = join(tempDir(), "installer.exe");
		writeFileSync(uploaded, ctx.objects.get(installerKey) ?? new Uint8Array());
		expect(
			await verifyUpdaterSignature({
				filePath: uploaded,
				publicKey: ctx.app.updaterPublicKey,
				signature: ready?.to === "ready" ? ready.updaterSignature : "",
				version: "1.0.3",
			}),
		).toBe(true);
		expect(ctx.metering.calls).toContain("settle");
		expect(ctx.metering.calls).not.toContain("refund");
	});

	// An installed app refuses a database that ran a file it does not embed.
	// The old commit lacks 0002, which a newer ready build froze.
	it("embeds every frozen migration in a rebuild of an older commit", async () => {
		const notesSql = "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT);";
		const ctx = await setup({
			frozen: [
				{ name: "init", sha256: sha256OfMigration(INIT_SQL), version: 1 },
				{ name: "add_notes", sha256: sha256OfMigration(notesSql), version: 2 },
			],
			migrationListing: `f\t${Buffer.byteLength(INIT_SQL)}\t0001_init.sql\0f\t${Buffer.byteLength(notesSql)}\t0002_add_notes.sql\0`,
			rebuild: {
				migrations: {
					"0001_init.sql": INIT_SQL,
					"0002_add_notes.sql": notesSql,
				},
				migrationsCommit: "c".repeat(40),
			},
		});

		const result = await ctx.run();

		expect(result).toEqual({ errorCode: null, outcome: "ready" });
		const ready = ctx.transitions.find((change) => change.to === "ready");
		expect(
			ready?.to === "ready" ? ready.migrations.map((m) => m.version) : [],
		).toEqual([1, 2]);
	});

	it("fails signing_failed and uploads nothing when the signature does not verify with the app key", async () => {
		const ctx = await setup({
			app: appRow({ updaterPublicKey: OTHER_KEYS.publicKey }),
		});

		const result = await ctx.run();

		expect(result).toEqual({ errorCode: "signing_failed", outcome: "failed" });
		expect(ctx.putKeys.filter((key) => key.includes("/builds/"))).toEqual([]);
		expect(ctx.objects.size).toBe(0);
		expect(ctx.metering.refundReasons).toEqual(["desktop_build_failed"]);
	});

	// A failed self-test fails again on a retry, so the user must not read "Try again".
	it.each([
		["another step", false, "ci_failed"],
		["the self-test step", true, "self_test_failed"],
	] as const)("fails a CI run whose %s failed, releases the hold, and deletes the input", async (_label, selfTestFailed, errorCode) => {
		const ctx = await setup({
			runs: [{ conclusion: "failure", status: "completed" }],
			selfTestFailed,
		});

		const result = await ctx.run();

		expect(result).toEqual({ errorCode, outcome: "failed" });
		expect(ctx.state.row?.status).toBe("failed");
		expect(ctx.metering.refundReasons).toEqual(["desktop_build_failed"]);
		expect(ctx.objects.size).toBe(0);
		expect(ctx.cancels).toEqual([]);
	});

	it.each<
		[
			string,
			(ctx: Awaited<ReturnType<typeof setup>>) => void,
			string[],
			string[],
			DesktopBuildStatus,
		]
	>([
		[
			// The API cancel released the hold, so the run does not.
			"the API cancels the build during building",
			(ctx) => {
				ctx.hooks.onSleep = () => {
					if (ctx.state.row !== null) {
						ctx.state.row = { ...ctx.state.row, status: "canceled" };
					}
				};
			},
			[CI_RUN_ID],
			[],
			"canceled",
		],
		[
			// `failStart` of the API refunded the hold. The run must stop CI at the next poll.
			"the API fails the build start during building",
			(ctx) => {
				ctx.hooks.onSleep = () => {
					if (ctx.state.row !== null) {
						ctx.state.row = { ...ctx.state.row, status: "failed" };
					}
				};
			},
			[CI_RUN_ID],
			[],
			"failed",
		],
		[
			"staff suspend the project during building",
			(ctx) => {
				ctx.hooks.onSleep = () => {
					ctx.state.suspendedReasonCode = "legal_takedown";
				};
			},
			[CI_RUN_ID],
			["desktop_build_canceled"],
			"canceled",
		],
		[
			// The last stop check passed, so only the refused `ready` write shows the takedown.
			"staff suspend the project after the installer upload",
			(ctx) => {
				ctx.hooks.onBuildFileUpload = () => {
					ctx.state.suspendedReasonCode = "legal_takedown";
				};
			},
			[],
			["desktop_build_canceled"],
			"canceled",
		],
		[
			// The stop check then reads no reason, and nobody else ends the row.
			"staff lift a suspension right after it refused the ready write",
			(ctx) => {
				ctx.hooks.onBuildFileUpload = () => {
					ctx.state.suspendedReasonCode = "legal_takedown";
				};
				ctx.hooks.onTransitionRefused = () => {
					ctx.state.suspendedReasonCode = null;
				};
			},
			[],
			["desktop_build_canceled"],
			"canceled",
		],
	])("ends canceled with no object left when %s", async (_label, arm, cancels, refundReasons, status) => {
		const ctx = await setup({
			runs: [
				{ conclusion: null, status: "in_progress" },
				{ conclusion: "success", status: "completed" },
			],
		});
		arm(ctx);

		const result = await ctx.run();

		expect(result).toEqual({ errorCode: null, outcome: "canceled" });
		expect(ctx.state.row?.status).toBe(status);
		expect(ctx.cancels).toEqual(cancels);
		expect(ctx.metering.refundReasons).toEqual(refundReasons);
		expect(ctx.metering.calls).not.toContain("settle");
		// No installer of a canceled or suspended build stays in R2.
		expect(ctx.objects.size).toBe(0);
	});

	// Money check, same rule as the mobile run: with billing on, a build runs only on
	// the hold that the API reserved for its row. Else it runs free or bills the wrong pool.
	it.each<[string, AiUsageEvent | null]>([
		["no hold", null],
		["a hold of another actor", holdEvent("reserved", { userId: "user-2" })],
		[
			"a hold of another operation",
			holdEvent("reserved", { operation: "mobile_build" }),
		],
	])("fails internal on %s and leases, settles, and refunds nothing", async (_label, hold) => {
		const ctx = await setup();
		ctx.metering.hold = hold;

		const result = await ctx.run();

		expect(result).toEqual({ errorCode: "internal", outcome: "failed" });
		expect(ctx.dispatches).toEqual([]);
		expect(ctx.metering.calls).toEqual([]);
	});

	// A member of a shared personal project builds: the row and the hold name the
	// member, and the hold names the owner as payer. The run must accept it.
	it("leases and settles the hold of a member build that the project owner pays", async () => {
		const ctx = await setup({
			runs: [{ conclusion: "success", status: "completed" }],
		});
		if (ctx.state.row === null) {
			throw new Error("The fake has no build row");
		}
		ctx.state.row = { ...ctx.state.row, userId: "member-1" };
		ctx.metering.hold = holdEvent("reserved", {
			payerUserId: "user-1",
			userId: "member-1",
		});

		const result = await ctx.run();

		expect(result).toEqual({ errorCode: null, outcome: "ready" });
		expect(ctx.metering.calls).toEqual(["lease", "settle"]);
	});

	it("cancels a queued build of a deleted project before the sandbox and refunds its hold", async () => {
		const ctx = await setup();
		ctx.state.projectDeleted = true;

		const result = await ctx.run();

		expect(result).toEqual({ errorCode: null, outcome: "canceled" });
		expect(ctx.state.row?.status).toBe("canceled");
		expect(ctx.metering.refundReasons).toEqual(["desktop_build_canceled"]);
		expect(
			ctx.sandboxes.calls.filter((call) => call.method === "exec"),
		).toEqual([]);
	});

	it.each([
		[
			"a staged file without the MZ header",
			{ installer: Buffer.from("XX not an exe") },
		],
		[
			"a staged file above 300 MB",
			{
				stagedResponse: () =>
					new Response(Buffer.from("MZ"), {
						headers: { "content-length": String(300 * 1024 * 1024 + 1) },
					}),
			},
		],
	])("fails artifact_invalid on %s", async (_label, options) => {
		const ctx = await setup(options);

		const result = await ctx.run();

		expect(result).toEqual({
			errorCode: "artifact_invalid",
			outcome: "failed",
		});
		expect(ctx.putKeys.filter((key) => key.includes("/builds/"))).toEqual([]);
		expect(ctx.metering.refundReasons).toEqual(["desktop_build_failed"]);
	});

	// The updater unpacks the archive with no path guard, so the signature must
	// cover the stored server re-pack. Both files share one random folder.
	it("builds macOS: dispatches 2 staging URLs, stores the disk image and the signed archive in one folder", async () => {
		const ctx = await setup({ platform: "macos" });

		const result = await ctx.run();

		expect(result).toEqual({ errorCode: null, outcome: "ready" });
		expect(ctx.dispatches).toEqual([
			expect.objectContaining({
				outputUrl: expect.stringMatching(/\/staging\/.+\.dmg$/),
				platform: "macos",
				updateUrl: expect.stringMatching(/\/staging\/.+\.app\.tar\.gz$/),
			}),
		]);
		const ready = ctx.transitions.find((change) => change.to === "ready");
		if (ready?.to !== "ready" || ready.updateArchiveKey === null) {
			throw new Error("The build did not write ready with an archive key");
		}
		const folder = new RegExp(
			`^desktop/${PROJECT_ID}/builds/${BUILD_ID}-[0-9a-f]{32}/`,
		);
		expect(ready.installerKey).toMatch(folder);
		expect(ready.installerKey.endsWith("/stock-manager-1.0.3.dmg")).toBe(true);
		expect(ready.updateArchiveKey).toBe(
			ready.installerKey.replace(/\.dmg$/, ".app.tar.gz"),
		);
		expect(ready).toMatchObject({
			installerBytes: ctx.installer.length,
			installerSha256: createHash("sha256").update(ctx.installer).digest("hex"),
		});
		// The input and both staged files are gone.
		expect([...ctx.objects.keys()].sort()).toEqual(
			[ready.installerKey, ready.updateArchiveKey].sort(),
		);
		const stored = ctx.objects.get(ready.updateArchiveKey) ?? new Uint8Array();
		// The staged binary has mode 0644. The stored archive has 0755, so it is the re-pack.
		expect(stored).toEqual(packTarGzip(APP_ENTRIES));
		const uploaded = join(tempDir(), "update.app.tar.gz");
		writeFileSync(uploaded, stored);
		expect(
			await verifyUpdaterSignature({
				filePath: uploaded,
				publicKey: ctx.app.updaterPublicKey,
				signature: ready.updaterSignature,
				version: "1.0.3",
			}),
		).toBe(true);
		expect(ctx.metering.calls).toContain("settle");
	});

	// An Electron Mac app installs from the disk image. CI gets no update URL,
	// and the stored signature covers the disk image in the Electron format.
	it("builds Electron macOS: the Electron shell input, 1 staging URL, and a signed disk image without an archive", async () => {
		const ctx = await setup({ engine: "electron", platform: "macos" });

		const result = await ctx.run();

		expect(result).toEqual({ errorCode: null, outcome: "ready" });
		expect(ctx.dispatches).toHaveLength(1);
		expect(ctx.dispatches[0]).toMatchObject({
			engine: "electron",
			outputUrl: expect.stringMatching(/\/staging\/.+\.dmg$/),
			platform: "macos",
		});
		expect(ctx.dispatches[0]).not.toHaveProperty("updateUrl");
		const inputTar = gunzipSync(ctx.inputArchive ?? new Uint8Array()).toString(
			"latin1",
		);
		expect(inputTar).toContain("shell/wandit.desktop.json");
		expect(inputTar).not.toContain("src-tauri/");
		const ready = ctx.transitions.find((change) => change.to === "ready");
		if (ready?.to !== "ready") {
			throw new Error("The build did not write ready");
		}
		expect(ready.updateArchiveKey).toBeNull();
		expect(ready.installerKey.endsWith("/stock-manager-1.0.3.dmg")).toBe(true);
		// The input and the staged disk image are gone.
		expect([...ctx.objects.keys()]).toEqual([ready.installerKey]);
		const uploaded = join(tempDir(), "update.dmg");
		writeFileSync(uploaded, ctx.objects.get(ready.installerKey) ?? "");
		expect(
			await verifyElectronUpdateSignature({
				filePath: uploaded,
				publicKey: ctx.app.updaterPublicKey,
				signature: ready.updaterSignature,
				version: "1.0.3",
			}),
		).toBe(true);
	});

	it.each([
		[
			'an update archive with a ".." entry',
			{
				updateArchive: packTarGzip([
					...APP_ENTRIES,
					{
						content: Buffer.from("evil"),
						path: "stock-manager.app/Contents/../evil",
						type: "file",
					},
				]),
			},
			'has the name part ".."',
		],
		[
			"a disk image without the koly trailer",
			{ installer: Buffer.alloc(4096, 1) },
			"The staged disk image is not a UDIF disk image",
		],
	])("fails a macOS build artifact_invalid on %s and uploads nothing", async (_label, options, reason) => {
		const ctx = await setup({ ...options, platform: "macos" });

		const result = await ctx.run();

		expect(result).toEqual({
			errorCode: "artifact_invalid",
			outcome: "failed",
		});
		const failed = ctx.transitions.find((change) => change.to === "failed");
		expect(failed?.to === "failed" ? failed.errorMessage : "").toContain(
			reason,
		);
		expect(ctx.putKeys.filter((key) => key.includes("/builds/"))).toEqual([]);
		expect(ctx.objects.size).toBe(0);
	});
});

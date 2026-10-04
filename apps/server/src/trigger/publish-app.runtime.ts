/**
 * Publish-app runtime (WANDIT-178): puts one V2 web app live as its user
 * Worker and moves its `app_builds` row to a terminal status.
 * `publish-app.task.ts` calls `runPublishApp`; the spec runs it on fakes.
 * A build from source runs `pnpm run build` in the project sandbox, stores
 * the output in R2, and runs the publish gates. A rollback loads a stored
 * output. Both then upload through the W4P client, write the KV slug
 * pointer, and promote the `deployments` row.
 */
import { gunzipSync, gzipSync } from "node:zlib";

import {
	type AppBuildErrorCode,
	appWorkerConfigSchema,
	appWorkerName,
	DEFAULT_APP_WORKER_LIMITS,
	type HostPointer,
	type StoredAppBuild,
	storedAppBuildSchema,
	supabaseProjectUrl,
	type WorkerBinding,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";

import { publishedAppBuildKey } from "../infrastructure/storage/r2";
import type { ProjectSecretsService } from "../modules/app-builder/application/services/project-secrets.service";
import type {
	PublishGate,
	PublishGateFile,
	PublishGateFinding,
} from "../modules/app-builder/domain/ports/publish-gate";
import type {
	SandboxHandle,
	SandboxLogger,
	SandboxProvider,
} from "../modules/app-builder/domain/ports/sandbox-provider";
import { assetManifest } from "../modules/app-builder/infrastructure/cloudflare/asset-manifest";
import {
	type WorkersForPlatformsApi,
	WorkersForPlatformsError,
} from "../modules/app-builder/infrastructure/cloudflare/workers-for-platforms.client";
import type {
	AppBackendRow,
	AppBackendsRepository,
} from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import type {
	AppBuildRow,
	AppPublishRepository,
	PublishProjectRow,
} from "../modules/app-builder/infrastructure/persistence/app-publish.repository";
import type { ProjectSecretsRepository } from "../modules/app-builder/infrastructure/persistence/project-secrets.repository";
import type { TurnProjectRepository } from "../modules/app-builder/infrastructure/persistence/turn-project.repository";
import { startSandboxWithoutTurn } from "../modules/app-builder/infrastructure/sandbox/sandbox-start";
import { DomainProviderError } from "../modules/domains/domain/errors/domain.errors";
import type { DomainRoutingService } from "../modules/domains/infrastructure/cloudflare/domain-routing.service";
import { SlugTakenError } from "../modules/sites/domain/errors/site.errors";
import { pickFreeSlug } from "../modules/sites/domain/slugify";
import type { DeploymentsRepository } from "../modules/sites/infrastructure/persistence/deployments.repository";

// Outside the project worktree, so a running turn never sees the build
// checkout in `git status` and `git add -A`.
const BUILD_ROOT = "/tmp/wandit-publish";
// The image ships a warm pnpm store, so an offline-first install takes
// seconds. 3 min covers a cold download of a changed lockfile.
const INSTALL_TIMEOUT_MS = 180_000;
// ESTIMATE from WANDIT-178: a template build takes under one minute.
const BUILD_TIMEOUT_MS = 300_000;
// git and find calls inside the sandbox.
const COMMAND_TIMEOUT_MS = 60_000;
// The ceilings of WANDIT-178 (ESTIMATE): 2,000 files and 100 MB per output.
// LIMIT: the whole output sits in task memory twice (bytes and base64).
// Upgrade: stream the files to R2 and to Cloudflare one by one.
const MAX_OUTPUT_FILES = 2_000;
const MAX_OUTPUT_BYTES = 100 * 1024 * 1024;
// Cloudflare refuses a static asset above 25 MiB.
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
// Parallel `readFile` calls; each one is one sandbox API request.
const READ_BATCH_SIZE = 16;
// The tail of a failed command that goes into the row for support.
const STDERR_TAIL_LENGTH = 400;

/** Payload of one `publish-app` run, plus the Trigger run id. */
export type PublishAppInput = {
	/** `app_builds.id`. */
	buildId: string;
	/** Project of the build. The run skips a row of another project. */
	projectId: string;
	/** `ctx.run.id` of this run. The claim writes it to `app_builds.trigger_run_id`. */
	triggerRunId: string;
};

/** Everything `runPublishApp` calls. The task wires the real ones; the spec passes fakes. */
export type PublishAppDeps = {
	/** The `app_builds` row, the app deployment rows, and the project row. */
	publish: Pick<
		AppPublishRepository,
		| "findById"
		| "findLiveDeployment"
		| "findProject"
		| "insertPendingDeployment"
		| "transition"
	>;
	/** The V1 writes both kinds share: the slug check, promote, fail, and unpublish. */
	deployments: Pick<
		DeploymentsRepository,
		"isSlugTakenByOther" | "markFailed" | "promoteToActive" | "unpublishActive"
	>;
	/** Reads the `app_backends` row for the public Supabase values. */
	backends: Pick<AppBackendsRepository, "findByProjectId">;
	/** Lists the names and kinds of the `project_secrets` rows. */
	secretRows: Pick<ProjectSecretsRepository, "listSummaries">;
	/** Decrypts one secret value; null when the row is gone. */
	secretValues: Pick<ProjectSecretsService, "readValue">;
	/**
	 * Reuses a running sandbox, or wakes or creates it. The provider restores
	 * the repository on a rebuild.
	 */
	sandboxes: Pick<
		SandboxProvider,
		"findRunning" | "getOrCreate" | "keepAliveIfRunning"
	>;
	/** Reads the template and the approved egress hosts that the sandbox start needs. */
	projects: Pick<TurnProjectRepository, "findForTurn">;
	/** R2 reads and writes of the stored output. Null when R2 is not configured: the run fails `unconfigured`. */
	storage: {
		put: (key: string, bytes: Uint8Array) => Promise<void>;
		get: (key: string) => Promise<Uint8Array | null>;
	} | null;
	/** The W4P client. Null without the Cloudflare env values: the run fails `unconfigured`. */
	workers: Pick<
		WorkersForPlatformsApi,
		| "createAssetUploadSession"
		| "deleteScript"
		| "deployScript"
		| "uploadAssets"
	> | null;
	/** The KV slug pointer writer. Null when KV is not configured and not allowed off: the run fails `unconfigured`. */
	routing: Pick<DomainRoutingService, "putHostPointer"> | null;
	/** The checks of the build output. Empty today; WANDIT-181 and WANDIT-190 add gates. */
	gates: PublishGate[];
	/** `env.SITES_DOMAIN`: the zone of the `{slug}.{domain}` host. */
	sitesDomain: string;
	/** `Sentry.captureException` with the run tags. */
	captureException: (
		error: unknown,
		tags: { buildId: string; projectId: string; failure: AppBuildErrorCode },
	) => void;
	/** `Sentry.logger` in production; the spec records lines. */
	logger: SandboxLogger;
};

/** Outcome of one run. `skipped`: the run did not claim the row. */
export type PublishAppResult = {
	outcome: "published" | "blocked" | "failed" | "skipped";
	/** The stored error code on `failed`, else null. */
	errorCode: AppBuildErrorCode | null;
};

/** A failure with a known error code. Any other error maps in `errorCodeOf`. */
class PublishFailure extends Error {
	constructor(
		readonly code: AppBuildErrorCode,
		message: string,
	) {
		super(message);
		this.name = "PublishFailure";
	}
}

const SKIPPED: PublishAppResult = { errorCode: null, outcome: "skipped" };

/**
 * Runs one publish attempt. After the claim it never throws: every failure
 * moves the row to `failed` with a code. A database error before the claim
 * throws; the stale heal of the API then ends the row.
 */
export async function runPublishApp(
	deps: PublishAppDeps,
	input: PublishAppInput,
): Promise<PublishAppResult> {
	const fields = { buildId: input.buildId, projectId: input.projectId };
	const row = await deps.publish.findById(input.buildId);
	if (row === null || row.projectId !== input.projectId) {
		deps.logger.warn("publish-app.row-missing", fields);
		return SKIPPED;
	}
	// The claim is a compare-and-set: a replayed run finds the row out of
	// `queued` and does nothing.
	const claimed = await deps.publish.transition(row.id, {
		to: "building",
		triggerRunId: input.triggerRunId,
	});
	if (claimed === null) {
		deps.logger.info("publish-app.not-claimed", fields);
		return SKIPPED;
	}

	try {
		const { publish, routing, storage, workers } = deps;
		if (workers === null || storage === null || routing === null) {
			throw new PublishFailure(
				"unconfigured",
				"Cloudflare W4P, KV, or R2 is not configured on the worker",
			);
		}
		const project = await publish.findProject(row.projectId);
		if (
			project === null ||
			project.deletedAt !== null ||
			project.engine !== "v2_app"
		) {
			throw new PublishFailure(
				"internal",
				"The project is deleted or is not a V2 app",
			);
		}

		let output: StoredAppBuild;
		if (row.sourceBuildId === null) {
			output = await buildInSandbox(deps, row);
			const findings = await runGates(deps.gates, row, output);
			const blocking = findings.filter(
				(finding) => finding.severity === "block",
			);
			if (blocking.length > 0) {
				await publish.transition(row.id, {
					errorMessage: blocking
						.map((finding) => `${finding.path ?? "build"}: ${finding.message}`)
						.join("; "),
					to: "blocked",
				});
				deps.logger.warn("publish-app.blocked", {
					...fields,
					findings: String(blocking.length),
				});
				return { errorCode: "gate_blocked", outcome: "blocked" };
			}
			// The output goes to R2 before the upload, so every live deployment
			// has a stored output that a rollback can upload again.
			await storage.put(
				publishedAppBuildKey(row.projectId, row.id),
				gzipSync(JSON.stringify(output)),
			);
		} else {
			output = await loadStoredOutput(
				storage,
				row.projectId,
				row.sourceBuildId,
			);
		}

		const stats = outputStats(output);
		// The API ends a row that sat 30 min without a change. A run that
		// lost its row this way must not upload.
		if (
			(await publish.transition(row.id, { ...stats, to: "uploading" })) === null
		) {
			deps.logger.warn("publish-app.row-ended-before-upload", fields);
			return SKIPPED;
		}
		await goLive(deps, { output, project, row, routing, workers });
		if ((await publish.transition(row.id, { to: "published" })) === null) {
			deps.logger.error("publish-app.row-ended-after-upload", fields);
		}
		deps.logger.info("publish-app.published", {
			...fields,
			bytes: String(stats.bytes),
			fileCount: String(stats.fileCount),
		});
		return { errorCode: null, outcome: "published" };
	} catch (error) {
		const errorCode = errorCodeOf(error);
		deps.logger.error("publish-app.failed", {
			...fields,
			error: getErrorMessage(error),
			errorCode,
		});
		deps.captureException(error, { ...fields, failure: errorCode });
		try {
			await deps.publish.transition(row.id, {
				errorCode,
				errorMessage: getErrorMessage(error),
				to: "failed",
			});
		} catch (markError) {
			// The API marks a live row older than the stale window as failed,
			// so the slot frees up even when this write fails.
			deps.logger.error("publish-app.mark-failed-failed", {
				...fields,
				error: getErrorMessage(markError),
			});
		}
		return { errorCode, outcome: "failed" };
	}
}

// Builds the commit of the row in its own git worktree of the sandbox and
// reads the output. The worktree pins the output to `row.commitSha`, and a
// running turn neither blocks the build nor changes its files.
async function buildInSandbox(
	deps: PublishAppDeps,
	row: AppBuildRow,
): Promise<StoredAppBuild> {
	// A running sandbox can serve a live turn. A policy push from outside the
	// turn drops the proxy header of the harness session, so the build reuses it.
	const running = await deps.sandboxes.findRunning(row.projectId);
	if (running !== null) {
		// The reader runs no keep-alive, and install plus build take up to 8 min.
		await deps.sandboxes.keepAliveIfRunning(row.projectId);
	}
	// A stopped or lost sandbox starts like a version restore: the start env
	// holds the proxy URL, but no token and no Supabase values. The build
	// command gets its Supabase values in its own env.
	const sandbox =
		running ?? (await startSandboxWithoutTurn(deps, row.projectId));
	const buildEnv = webAppEnvOf(
		await deps.backends.findByProjectId(row.projectId),
	);
	const buildDir = `${BUILD_ROOT}/${row.id}`;
	try {
		await mustExec(
			sandbox,
			"build_failed",
			"git",
			["worktree", "add", "--detach", buildDir, row.commitSha],
			{ cwd: sandbox.workspaceDir, timeoutMs: COMMAND_TIMEOUT_MS },
		);
		await mustExec(
			sandbox,
			"build_failed",
			"pnpm",
			["install", "--frozen-lockfile", "--prefer-offline"],
			{ cwd: buildDir, timeoutMs: INSTALL_TIMEOUT_MS },
		);
		await mustExec(sandbox, "build_failed", "pnpm", ["run", "build"], {
			cwd: buildDir,
			env: buildEnv,
			timeoutMs: BUILD_TIMEOUT_MS,
		});
		return await readOutput(sandbox, `${buildDir}/dist`);
	} finally {
		// Best effort: a left folder costs disk only, and the next sandbox
		// rebuild drops /tmp.
		const removed = await sandbox
			.exec("git", ["worktree", "remove", "--force", buildDir], {
				cwd: sandbox.workspaceDir,
				timeoutMs: COMMAND_TIMEOUT_MS,
			})
			.catch((error: unknown) => ({
				exitCode: -1,
				stderr: getErrorMessage(error),
				stdout: "",
			}));
		if (removed.exitCode !== 0) {
			deps.logger.warn("publish-app.worktree-remove-failed", {
				buildId: row.id,
				error: removed.stderr.slice(-STDERR_TAIL_LENGTH),
				projectId: row.projectId,
			});
		}
	}
}

/**
 * Reads the Cloudflare Vite output under `distDir`: the Worker modules of
 * `server/` (named by `server/wrangler.json`) and the static assets of
 * `client/`. Refuses a symlink, a file outside the limits, and a config
 * without its main module.
 */
async function readOutput(
	sandbox: Pick<SandboxHandle, "exec" | "readFile">,
	distDir: string,
): Promise<StoredAppBuild> {
	// Security: a symlink could make the upload read a file outside the
	// output, for example a file under the home folder.
	const links = await mustExec(
		sandbox,
		"output_invalid",
		"find",
		[distDir, "-type", "l"],
		{ timeoutMs: COMMAND_TIMEOUT_MS },
	);
	const firstLink = links.stdout.split("\n").find((line) => line !== "");
	if (firstLink !== undefined) {
		throw new PublishFailure(
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
	const entries = parseListing(listing.stdout);

	const configBytes = await sandbox.readFile(`${distDir}/server/wrangler.json`);
	if (configBytes === null) {
		throw new PublishFailure(
			"output_invalid",
			"The build output has no server/wrangler.json",
		);
	}
	const config = parseWorkerConfig(configBytes);

	const assetsIgnore = await sandbox.readFile(
		`${distDir}/client/.assetsignore`,
	);
	// LIMIT: only exact paths of `.assetsignore` apply; a glob line is
	// skipped. Upgrade: match the gitignore syntax like wrangler.
	const ignored = new Set(
		new TextDecoder()
			.decode(assetsIgnore ?? new Uint8Array())
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line !== "" && !line.startsWith("#")),
	);
	ignored.add(".assetsignore");

	const modules: { path: string; size: number; type: StoredModuleType }[] = [];
	const assets: { path: string; size: number }[] = [];
	for (const entry of entries) {
		if (entry.path.startsWith("server/")) {
			const path = entry.path.slice("server/".length);
			const type = moduleTypeOf(path);
			// The `.vite` manifest and the CSS copies of the SSR build are not
			// modules; wrangler uploads only the files its module rules match.
			if (type !== null && !path.startsWith(".vite/")) {
				modules.push({ path, size: entry.size, type });
			}
		} else if (entry.path.startsWith("client/")) {
			const path = entry.path.slice("client/".length);
			if (!ignored.has(path)) {
				if (entry.size > MAX_ASSET_BYTES) {
					throw new PublishFailure(
						"output_too_large",
						`The asset ${path} is larger than 25 MiB`,
					);
				}
				assets.push({ path, size: entry.size });
			}
		}
	}
	if (!modules.some((workerModule) => workerModule.path === config.main)) {
		throw new PublishFailure(
			"output_invalid",
			`The main module ${config.main} is not in the build output`,
		);
	}
	const fileCount = modules.length + assets.length;
	const bytes = [...modules, ...assets].reduce(
		(sum, file) => sum + file.size,
		0,
	);
	if (fileCount > MAX_OUTPUT_FILES || bytes > MAX_OUTPUT_BYTES) {
		throw new PublishFailure(
			"output_too_large",
			`The build output has ${fileCount} files and ${bytes} bytes`,
		);
	}

	const moduleFiles = await readStoredFiles(
		sandbox,
		`${distDir}/server`,
		modules,
	);
	const assetFiles = await readStoredFiles(
		sandbox,
		`${distDir}/client`,
		assets,
	);
	return {
		assets: assetFiles.map(({ contentBase64, path }) => ({
			contentBase64,
			path,
		})),
		compatibilityDate: config.compatibility_date,
		compatibilityFlags: config.compatibility_flags,
		formatVersion: 1,
		mainModule: config.main,
		modules: moduleFiles.map(({ contentBase64, path, type }) => ({
			contentBase64,
			path,
			type,
		})),
	};
}

type StoredModuleType = StoredAppBuild["modules"][number]["type"];

// The module rules of the generated wrangler.json: ES modules for `.js`
// and `.mjs`. Wrangler also uploads `.wasm` files as wasm modules.
function moduleTypeOf(path: string): StoredModuleType | null {
	if (path.endsWith(".js") || path.endsWith(".mjs")) {
		return "application/javascript+module";
	}
	if (path.endsWith(".wasm")) {
		return "application/wasm";
	}
	return null;
}

// One line per file: `<path>\t<size>`. A path with a tab or a newline
// breaks the format, so the line is refused, not guessed.
function parseListing(stdout: string): { path: string; size: number }[] {
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
			throw new PublishFailure(
				"output_invalid",
				`The build output has a file name the task cannot read: ${line}`,
			);
		}
		entries.push({ path, size: Number(size) });
	}
	return entries;
}

// The sandbox writes the file, so it is untrusted input like any upload.
function parseWorkerConfig(bytes: Uint8Array) {
	let raw: unknown;
	try {
		raw = JSON.parse(new TextDecoder().decode(bytes));
	} catch (error) {
		throw new PublishFailure(
			"output_invalid",
			`server/wrangler.json is not JSON: ${getErrorMessage(error)}`,
		);
	}
	const parsed = appWorkerConfigSchema.safeParse(raw);
	if (!parsed.success) {
		throw new PublishFailure(
			"output_invalid",
			`server/wrangler.json is not a Worker config: ${parsed.error.message}`,
		);
	}
	return parsed.data;
}

// Reads the files under `folder` in small parallel batches and answers
// each item with its content in base64, in the order of `items`.
async function readStoredFiles<T extends { path: string }>(
	sandbox: Pick<SandboxHandle, "readFile">,
	folder: string,
	items: T[],
): Promise<(T & { contentBase64: string })[]> {
	const files: (T & { contentBase64: string })[] = [];
	for (let start = 0; start < items.length; start += READ_BATCH_SIZE) {
		const batch = await Promise.all(
			items.slice(start, start + READ_BATCH_SIZE).map(async (item) => {
				const content = await sandbox.readFile(`${folder}/${item.path}`);
				if (content === null) {
					throw new PublishFailure(
						"output_invalid",
						`The output file ${item.path} disappeared during the read`,
					);
				}
				return { ...item, contentBase64: toBase64(content) };
			}),
		);
		files.push(...batch);
	}
	return files;
}

async function runGates(
	gates: PublishGate[],
	row: AppBuildRow,
	output: StoredAppBuild,
): Promise<PublishGateFinding[]> {
	if (gates.length === 0) {
		return [];
	}
	const files: PublishGateFile[] = [
		...output.modules.map((file) => ({
			content: fromBase64(file.contentBase64),
			path: `server/${file.path}`,
		})),
		...output.assets.map((file) => ({
			content: fromBase64(file.contentBase64),
			path: `client/${file.path}`,
		})),
	];
	const findings: PublishGateFinding[] = [];
	for (const gate of gates) {
		findings.push(
			...(await gate.run({
				buildId: row.id,
				files,
				projectId: row.projectId,
			})),
		);
	}
	return findings;
}

async function loadStoredOutput(
	storage: NonNullable<PublishAppDeps["storage"]>,
	projectId: string,
	sourceBuildId: string,
): Promise<StoredAppBuild> {
	const stored = await storage.get(
		publishedAppBuildKey(projectId, sourceBuildId),
	);
	if (stored === null) {
		throw new PublishFailure(
			"source_missing",
			`No stored output exists for build ${sourceBuildId}`,
		);
	}
	// R2 is outside this process, so the stored output passes the schema again.
	return storedAppBuildSchema.parse(
		JSON.parse(gunzipSync(stored).toString("utf8")),
	);
}

/**
 * Uploads the output, promotes the pending row, and points the slug at the
 * Worker. A failed upload leaves the previous Worker live: the PUT of the
 * script is the only step that changes it.
 */
async function goLive(
	deps: PublishAppDeps,
	context: {
		output: StoredAppBuild;
		project: PublishProjectRow;
		row: AppBuildRow;
		routing: NonNullable<PublishAppDeps["routing"]>;
		workers: NonNullable<PublishAppDeps["workers"]>;
	},
): Promise<void> {
	const { output, project, routing, row, workers } = context;
	const projectId = row.projectId;
	const live = await deps.publish.findLiveDeployment(projectId);
	// The live slug stays; a first publish takes a free slug of the name
	// with the V1 rules.
	const slug =
		live?.slug ??
		(await pickFreeSlug(project.name, (candidate) =>
			deps.deployments.isSlugTakenByOther(candidate, projectId),
		));
	const pending = await deps.publish.insertPendingDeployment({
		buildId: row.id,
		commitSha: row.commitSha,
		projectId,
		slug,
	});
	let deployed = false;
	try {
		const scope = { projectId, scriptName: appWorkerName(projectId) };
		const { byHash, manifest } = assetManifest(
			projectId,
			output.assets.map((asset) => ({
				content: fromBase64(asset.contentBase64),
				path: asset.path,
			})),
		);
		const session = await workers.createAssetUploadSession(scope, manifest);
		const assetsJwt = await workers.uploadAssets(session, byHash);
		await workers.deployScript(scope, {
			assetsJwt,
			bindings: await workerBindings(deps, projectId),
			compatibilityDate: output.compatibilityDate,
			compatibilityFlags: output.compatibilityFlags,
			limits: DEFAULT_APP_WORKER_LIMITS,
			mainModule: output.mainModule,
			modules: output.modules.map((file) => ({
				content: fromBase64(file.contentBase64),
				path: file.path,
				type: file.type,
			})),
			workspaceId: project.organizationId ?? project.userId,
		});
		deployed = true;
		// The promote comes before the pointer: the unique slug index then
		// holds the slug, so the pointer never overwrites another project.
		await deps.deployments.promoteToActive(pending.id, projectId);
	} catch (error) {
		// A first publish without an active row must not stay live: no
		// unpublish could take it down. A re-publish keeps the new script.
		if (deployed && live === null) {
			await deleteAppWorker(deps, workers, projectId);
		}
		// Best effort: a stale pending row turns `failed` on the next V1 heal.
		await deps.deployments
			.markFailed(pending.id, getErrorMessage(error).slice(0, 180))
			.catch((markError: unknown) => {
				deps.logger.error("publish-app.deployment-mark-failed-failed", {
					buildId: row.id,
					error: getErrorMessage(markError),
					projectId,
				});
			});
		throw error;
	}

	const host = `${slug}.${deps.sitesDomain}`;
	try {
		// LIMIT: one limit for every plan. Upgrade: read the plan limits.
		await routing.putHostPointer(host, {
			kind: "app",
			limits: DEFAULT_APP_WORKER_LIMITS,
			projectId,
			slug,
			source: "slug",
		} satisfies HostPointer);
	} catch (error) {
		// A re-publish keeps its slug, so the stored pointer already names
		// this project and the new script serves. Only a first publish has
		// no pointer: it ends the row and the Worker, so nothing stays half live.
		if (live !== null) {
			deps.logger.error("publish-app.pointer-rewrite-failed", {
				error: getErrorMessage(error),
				host,
				projectId,
			});
			return;
		}
		try {
			await deps.deployments.unpublishActive(projectId);
		} catch (unpublishError) {
			deps.logger.error("publish-app.take-down-row-failed", {
				error: getErrorMessage(unpublishError),
				projectId,
			});
		}
		await deleteAppWorker(deps, workers, projectId);
		throw error;
	}
}

// The compensation of a first publish that cannot stay live. A failure is
// only logged: the caller already throws the first error.
async function deleteAppWorker(
	deps: PublishAppDeps,
	workers: NonNullable<PublishAppDeps["workers"]>,
	projectId: string,
): Promise<void> {
	try {
		await workers.deleteScript({
			projectId,
			scriptName: appWorkerName(projectId),
		});
	} catch (error) {
		deps.logger.error("publish-app.take-down-worker-failed", {
			error: getErrorMessage(error),
			projectId,
		});
	}
}

// The env of the Worker. The public Supabase values go as `plain_text`;
// the user secrets go as `secret_text`, never into a file of the build. A
// user secret with the name of a platform value loses: the app must reach
// its own backend.
async function workerBindings(
	deps: PublishAppDeps,
	projectId: string,
): Promise<WorkerBinding[]> {
	const bindings = new Map<string, WorkerBinding>();
	for (const row of await deps.secretRows.listSummaries(projectId)) {
		// Security: a `system` row is a platform value. The sandbox never
		// gets one, so the Worker of the same code never gets one either.
		if (row.kind !== "user") {
			continue;
		}
		const value = await deps.secretValues.readValue(projectId, row.name);
		// A row deleted between the list and the read has no value to bind.
		if (value !== null) {
			bindings.set(row.name, {
				name: row.name,
				text: value,
				type: "secret_text",
			});
		}
	}
	const appEnv = webAppEnvOf(await deps.backends.findByProjectId(projectId));
	for (const [name, text] of Object.entries(appEnv)) {
		bindings.set(name, { name, text, type: "plain_text" });
	}
	return [...bindings.values()];
}

// D18: a backend that serves the app gives the build and the Worker its
// public URL and anon key. A pause keeps both values, like the mobile build.
// A `creating`, `deleting`, or `error` row gives no backend env.
const APP_ENV_BACKEND_STATUSES: AppBackendRow["status"][] = [
	"active",
	"paused",
	"restoring",
];

// Both values are public: the browser bundle holds them in clear text.
function webAppEnvOf(backend: AppBackendRow | null): Record<string, string> {
	if (
		backend === null ||
		!APP_ENV_BACKEND_STATUSES.includes(backend.status) ||
		backend.ref === null ||
		backend.anonKey === null
	) {
		return {};
	}
	return {
		VITE_SUPABASE_ANON_KEY: backend.anonKey,
		VITE_SUPABASE_URL: supabaseProjectUrl(backend.ref),
	};
}

function outputStats(output: StoredAppBuild): {
	fileCount: number;
	bytes: number;
} {
	const files = [...output.modules, ...output.assets];
	return {
		// Base64 holds 3 bytes in 4 characters, minus the padding.
		bytes: files.reduce(
			(sum, file) => sum + Buffer.byteLength(file.contentBase64, "base64"),
			0,
		),
		fileCount: files.length,
	};
}

// Runs one command in the sandbox; a non-zero exit throws `failure` with
// the tail of stderr.
async function mustExec(
	sandbox: Pick<SandboxHandle, "exec">,
	failure: AppBuildErrorCode,
	command: string,
	args: string[],
	options: { cwd?: string; env?: Record<string, string>; timeoutMs: number },
) {
	const result = await sandbox.exec(command, args, options);
	if (result.exitCode !== 0) {
		const output = result.stderr.trim() === "" ? result.stdout : result.stderr;
		throw new PublishFailure(
			failure,
			`${command} ${args[0] ?? ""} failed (${result.exitCode}): ${output.slice(-STDERR_TAIL_LENGTH)}`,
		);
	}
	return result;
}

function errorCodeOf(error: unknown): AppBuildErrorCode {
	if (error instanceof PublishFailure) {
		return error.code;
	}
	if (error instanceof SlugTakenError) {
		return "slug_taken";
	}
	// The upload, the deploy, and the KV calls are the network steps after
	// the build.
	if (
		error instanceof WorkersForPlatformsError ||
		error instanceof DomainProviderError
	) {
		return "upload_failed";
	}
	return "internal";
}

function toBase64(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString("base64");
}

function fromBase64(text: string): Uint8Array {
	return new Uint8Array(Buffer.from(text, "base64"));
}

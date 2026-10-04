import { gunzipSync, gzipSync } from "node:zlib";

import {
	DEFAULT_APP_WORKER_LIMITS,
	type StoredAppBuild,
	storedAppBuildSchema,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import { publishedAppBuildKey } from "../infrastructure/storage/r2";
import { appBuildStatusesThatMayMoveTo } from "../modules/app-builder/domain/app-build";
import type { PublishGate } from "../modules/app-builder/domain/ports/publish-gate";
import { FakeWorkersForPlatformsClient } from "../modules/app-builder/infrastructure/cloudflare/fake-workers-for-platforms.client";
import { WorkersForPlatformsError } from "../modules/app-builder/infrastructure/cloudflare/workers-for-platforms.client";
import type { AppBackendRow } from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import type {
	AppBuildRow,
	AppBuildTransition,
	AppDeploymentRow,
	PublishProjectRow,
} from "../modules/app-builder/infrastructure/persistence/app-publish.repository";
import type { ProjectSecretSummaryRow } from "../modules/app-builder/infrastructure/persistence/project-secrets.repository";
import { FakeSandboxProvider } from "../modules/app-builder/infrastructure/sandbox/fake-sandbox.provider";
import { DomainProviderError } from "../modules/domains/domain/errors/domain.errors";
import { SlugTakenError } from "../modules/sites/domain/errors/site.errors";
import { type PublishAppDeps, runPublishApp } from "./publish-app.runtime";

const PROJECT_ID = "0f3a9c1b-4e7d-4a2b-9c3d-1e2f3a4b5c6d";
const BUILD_ID = "6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
const SOURCE_BUILD_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const COMMIT_SHA = "a".repeat(40);
const DIST = `/tmp/wandit-publish/${BUILD_ID}/dist`;
const SECRET_VALUE = "sk_test_secret_value";

const OK = { exitCode: 0, stderr: "", stdout: "" };

// The decrypted value of each stored secret name.
const SECRET_VALUES = new Map([
	["STRIPE_SECRET_KEY", SECRET_VALUE],
	["VITE_SUPABASE_URL", "https://evil.example"],
	["SUPABASE_SERVICE_ROLE_KEY", "service-role-value"],
]);

function secretSummary(
	name: string,
	kind: ProjectSecretSummaryRow["kind"],
): ProjectSecretSummaryRow {
	const at = new Date("2026-10-01T09:00:00.000Z");
	return { createdAt: at, kind, name, updatedAt: at };
}

function buildRow(overrides: Partial<AppBuildRow> = {}): AppBuildRow {
	return {
		bytes: null,
		commitSha: COMMIT_SHA,
		completedAt: null,
		createdAt: new Date("2026-10-01T10:00:00.000Z"),
		errorCode: null,
		errorMessage: null,
		fileCount: null,
		id: BUILD_ID,
		organizationId: null,
		projectId: PROJECT_ID,
		requestKey: "9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
		sourceBuildId: null,
		status: "queued",
		triggerRunId: null,
		updatedAt: new Date("2026-10-01T10:00:00.000Z"),
		userId: "user-1",
		...overrides,
	};
}

function deploymentRow(
	overrides: Partial<AppDeploymentRow> = {},
): AppDeploymentRow {
	return {
		buildId: SOURCE_BUILD_ID,
		commitSha: COMMIT_SHA,
		createdAt: new Date("2026-09-30T10:00:00.000Z"),
		error: null,
		id: "deployment-live",
		kind: "app",
		projectId: PROJECT_ID,
		slug: "booking-app",
		status: "active",
		updatedAt: new Date("2026-09-30T10:00:00.000Z"),
		versionId: null,
		...overrides,
	};
}

const PROJECT: PublishProjectRow = {
	deletedAt: null,
	engine: "v2_app",
	framework: "web-app",
	name: "Booking App",
	organizationId: null,
	templateVersion: "web-app@1.0.0",
	userId: "user-1",
};

const BACKEND: AppBackendRow = {
	anonKey: "anon-key-1",
	dbHost: "db.abcdefghijklmnopqrst.supabase.co",
	failureCode: null,
	id: "backend-1",
	orgId: "sb-org",
	organizationId: null,
	projectId: PROJECT_ID,
	ref: "abcdefghijklmnopqrst",
	region: "eu-west-3",
	requestKey: "request-1",
	status: "active",
	triggerRunId: null,
	userId: "user-1",
};

// The Cloudflare Vite output of the template: one server module, a manifest
// and a CSS copy that are no modules, two assets, and the ignore file.
const OUTPUT_FILES: Record<string, string> = {
	"client/.assetsignore": "wrangler.json\n.dev.vars\n",
	"client/assets/app.js": "console.log('client');",
	"client/index.html": "<html></html>",
	"server/.vite/manifest.json": "{}",
	"server/assets/tokens.css": "body{}",
	"server/index.js": "export default { fetch() {} };",
	"server/wrangler.json": JSON.stringify({
		compatibility_date: "2026-09-01",
		compatibility_flags: ["nodejs_compat"],
		main: "index.js",
	}),
};

function listingOf(files: Record<string, string>): string {
	return Object.entries(files)
		.map(
			([path, text]) => `${path}\t${new TextEncoder().encode(text).length}\n`,
		)
		.join("");
}

function storedOutput(): StoredAppBuild {
	return {
		assets: [
			{
				contentBase64: Buffer.from("<html>old</html>").toString("base64"),
				path: "index.html",
			},
		],
		compatibilityDate: "2026-09-01",
		compatibilityFlags: ["nodejs_compat"],
		formatVersion: 1,
		mainModule: "index.js",
		modules: [
			{
				contentBase64: Buffer.from("export default {};").toString("base64"),
				path: "index.js",
				type: "application/javascript+module",
			},
		],
	};
}

async function setup(
	options: {
		row?: AppBuildRow;
		live?: AppDeploymentRow | null;
		files?: Record<string, string>;
		gates?: PublishGate[];
	} = {},
) {
	let row = options.row ?? buildRow();
	const transitions: AppBuildTransition[] = [];
	const deployments: AppDeploymentRow[] = [];
	const stored = new Map<string, Uint8Array>();
	const workers = new FakeWorkersForPlatformsClient();
	const sandboxes = new FakeSandboxProvider();
	const files = options.files ?? OUTPUT_FILES;

	// The build writes its output into the sandbox; the fake holds it ahead.
	const handle = await sandboxes.getOrCreate(PROJECT_ID, {
		devCommand: "pnpm run dev",
		devPort: 5173,
		env: {},
		framework: "web-app",
		organizationId: null,
		ownerUserId: "user-1",
		templateVersion: "web-app@1.0.0",
	});
	await handle.writeFiles(
		Object.entries(files).map(([path, text]) => ({
			content: text,
			path: `${DIST}/${path}`,
		})),
	);
	sandboxes.respondTo("git", OK); // worktree add
	sandboxes.respondTo("pnpm", OK); // install
	sandboxes.respondTo("pnpm", OK); // build
	sandboxes.respondTo("find", OK); // symlinks: none
	sandboxes.respondTo("find", { ...OK, stdout: listingOf(files) });
	sandboxes.respondTo("git", OK); // worktree remove

	const deps = {
		backends: {
			findByProjectId: vi.fn(async () => BACKEND),
			touchActive: vi.fn(async () => undefined),
		},
		captureException: vi.fn(),
		deployments: {
			isSlugTakenByOther: vi.fn(async () => false),
			markFailed: vi.fn(async () => null),
			promoteToActive: vi.fn(async (id: string) => {
				const pending = deployments.find((deployment) => deployment.id === id);
				if (!pending) {
					throw new Error("no pending row");
				}
				pending.status = "active";
				return pending;
			}),
			unpublishActive: vi.fn(async (_projectId: string) => null),
		},
		gates: options.gates ?? [],
		logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
		projects: {
			findForTurn: vi.fn(async () => ({
				...PROJECT,
				languages: ["en"],
				networkAllowedHosts: [],
			})),
		},
		publish: {
			findById: vi.fn(async () => row),
			findLiveDeployment: vi.fn(async () => options.live ?? null),
			findProject: vi.fn(async () => PROJECT),
			insertPendingDeployment: vi.fn(
				async (input: {
					projectId: string;
					slug: string;
					buildId: string;
					commitSha: string;
				}) => {
					const pending = deploymentRow({
						...input,
						id: "deployment-new",
						status: "pending",
					});
					deployments.push(pending);
					return pending;
				},
			),
			// Applies the real status machine to the one row.
			transition: vi.fn(async (_id: string, change: AppBuildTransition) => {
				if (!appBuildStatusesThatMayMoveTo(change.to).includes(row.status)) {
					return null;
				}
				transitions.push(change);
				row = { ...row, status: change.to };
				return row;
			}),
		},
		routing: {
			putHostPointer: vi.fn(
				async (_host: string, _pointer: Record<string, unknown>) => undefined,
			),
		},
		secretRows: {
			listSummaries: vi.fn(async () => [
				secretSummary("STRIPE_SECRET_KEY", "user"),
				// A user value under a platform name never reaches the Worker.
				secretSummary("VITE_SUPABASE_URL", "user"),
				// A platform value never becomes a Worker binding.
				secretSummary("SUPABASE_SERVICE_ROLE_KEY", "system"),
				// Deleted between the list and the read.
				secretSummary("GONE_KEY", "user"),
			]),
		},
		secretValues: {
			readValue: vi.fn(async (_projectId: string, name: string) =>
				name === "GONE_KEY" ? null : (SECRET_VALUES.get(name) ?? null),
			),
		},
		sandboxes,
		sitesDomain: "wandit.app",
		storage: {
			get: vi.fn(async (key: string) => stored.get(key) ?? null),
			put: vi.fn(async (key: string, bytes: Uint8Array) => {
				stored.set(key, bytes);
			}),
		},
		workers,
	} satisfies PublishAppDeps;

	return { deployments, deps, sandboxes, stored, transitions, workers };
}

const INPUT = {
	buildId: BUILD_ID,
	projectId: PROJECT_ID,
	triggerRunId: "run-1",
};

describe("runPublishApp from source", () => {
	it("builds the commit, stores the output, uploads it, and goes live", async () => {
		const { deployments, deps, sandboxes, stored, transitions, workers } =
			await setup();

		const result = await runPublishApp(deps, INPUT);

		expect(result).toEqual({ errorCode: null, outcome: "published" });
		expect(transitions.map((change) => change.to)).toEqual([
			"building",
			"uploading",
			"published",
		]);
		// The build runs on the requested commit in its own worktree.
		const commands = sandboxes.calls
			.filter((call) => call.method === "exec")
			.map((call) => call.detail);
		expect(commands[0]).toBe(
			`git worktree add --detach /tmp/wandit-publish/${BUILD_ID} ${COMMIT_SHA}`,
		);
		expect(commands.at(-1)).toBe(
			`git worktree remove --force /tmp/wandit-publish/${BUILD_ID}`,
		);
		// The build gets the public backend values only.
		expect(sandboxes.execOptions[2]?.env).toEqual({
			VITE_SUPABASE_ANON_KEY: "anon-key-1",
			VITE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
		});

		const script = workers.scripts.get(`app-${PROJECT_ID}`);
		expect(script?.input?.mainModule).toBe("index.js");
		expect(script?.input?.modules.map((file) => file.path)).toEqual([
			"index.js",
		]);
		expect(script?.input?.compatibilityFlags).toEqual(["nodejs_compat"]);
		expect(script?.input?.limits).toEqual(DEFAULT_APP_WORKER_LIMITS);
		expect(script?.input?.bindings).toEqual([
			{ name: "STRIPE_SECRET_KEY", text: SECRET_VALUE, type: "secret_text" },
			{
				name: "VITE_SUPABASE_URL",
				text: "https://abcdefghijklmnopqrst.supabase.co",
				type: "plain_text",
			},
			{
				name: "VITE_SUPABASE_ANON_KEY",
				text: "anon-key-1",
				type: "plain_text",
			},
		]);

		const saved = storedAppBuildSchema.parse(
			JSON.parse(
				gunzipSync(
					stored.get(publishedAppBuildKey(PROJECT_ID, BUILD_ID)) ??
						new Uint8Array(),
				).toString("utf8"),
			),
		);
		expect(saved.assets.map((asset) => asset.path).sort()).toEqual([
			"assets/app.js",
			"index.html",
		]);
		// No secret value is in a file of the upload.
		for (const file of [...saved.assets, ...saved.modules]) {
			expect(
				Buffer.from(file.contentBase64, "base64").toString(),
			).not.toContain(SECRET_VALUE);
		}

		expect(deps.routing.putHostPointer).toHaveBeenCalledWith(
			"booking-app.wandit.app",
			{
				kind: "app",
				limits: DEFAULT_APP_WORKER_LIMITS,
				projectId: PROJECT_ID,
				slug: "booking-app",
				source: "slug",
			},
		);
		expect(deployments).toEqual([
			expect.objectContaining({
				buildId: BUILD_ID,
				commitSha: COMMIT_SHA,
				status: "active",
			}),
		]);
	});

	it("reuses a running sandbox and starts no new one", async () => {
		const { deps, sandboxes } = await setup();
		const startsBefore = sandboxes.createOptions.length;

		const result = await runPublishApp(deps, INPUT);

		expect(result).toEqual({ errorCode: null, outcome: "published" });
		// A start pushes a policy and drops the proxy header of a live turn.
		expect(sandboxes.createOptions).toHaveLength(startsBefore);
		// The reader runs no keep-alive, so the build buys the time once.
		expect(sandboxes.calls.map((call) => call.method)).toContain(
			"keepAliveIfRunning",
		);
	});

	it("keeps the live slug on a second publish", async () => {
		const { deps } = await setup({
			live: deploymentRow({ slug: "my-shop" }),
		});

		await runPublishApp(deps, INPUT);

		expect(deps.deployments.isSlugTakenByOther).not.toHaveBeenCalled();
		expect(deps.publish.insertPendingDeployment).toHaveBeenCalledWith(
			expect.objectContaining({ slug: "my-shop" }),
		);
	});

	it("marks a gate-blocked build blocked and uploads nothing", async () => {
		const gate: PublishGate = {
			id: "fake-block",
			run: vi.fn(async () => [
				{
					message: "phishing form",
					path: "client/index.html",
					severity: "block" as const,
				},
			]),
		};
		const { deps, stored, transitions, workers } = await setup({
			gates: [gate],
		});

		const result = await runPublishApp(deps, INPUT);

		expect(result).toEqual({ errorCode: "gate_blocked", outcome: "blocked" });
		expect(transitions.at(-1)).toEqual({
			errorMessage: "client/index.html: phishing form",
			to: "blocked",
		});
		expect(workers.calls).toEqual([]);
		expect(stored.size).toBe(0);
		expect(deps.publish.insertPendingDeployment).not.toHaveBeenCalled();
	});

	it("fails a broken build with build_failed and removes the worktree", async () => {
		const { deps, sandboxes, workers } = await setup();
		// The second pnpm answer is the build.
		sandboxes.scriptedExec.set("pnpm", [
			OK,
			{ exitCode: 1, stderr: "src/routes/index.tsx: syntax error", stdout: "" },
		]);

		const result = await runPublishApp(deps, INPUT);

		expect(result).toEqual({ errorCode: "build_failed", outcome: "failed" });
		expect(deps.publish.transition).toHaveBeenLastCalledWith(BUILD_ID, {
			errorCode: "build_failed",
			errorMessage: "pnpm run failed (1): src/routes/index.tsx: syntax error",
			to: "failed",
		});
		expect(workers.calls).toEqual([]);
		expect(
			sandboxes.calls.filter((call) => call.method === "exec").at(-1)?.detail,
		).toBe(`git worktree remove --force /tmp/wandit-publish/${BUILD_ID}`);
		expect(deps.captureException).toHaveBeenCalledOnce();
	});

	it("refuses a symlink in the output", async () => {
		const { deps, sandboxes } = await setup();
		sandboxes.scriptedExec.set("find", [
			{ ...OK, stdout: `${DIST}/client/secret -> /etc/passwd\n` },
		]);

		const result = await runPublishApp(deps, INPUT);

		expect(result.errorCode).toBe("output_invalid");
	});

	it("refuses an output above 100 MB before it reads a file", async () => {
		const { deps, sandboxes } = await setup();
		sandboxes.scriptedExec.set("find", [
			OK,
			{
				...OK,
				stdout:
					"server/index.js\t30\nclient/a.bin\t20000000\nclient/b.bin\t20000000\nclient/c.bin\t20000000\nclient/d.bin\t20000000\nclient/e.bin\t20000000\nclient/f.bin\t20000000\n",
			},
		]);

		const result = await runPublishApp(deps, INPUT);

		expect(result.errorCode).toBe("output_too_large");
		expect(
			sandboxes.calls.filter(
				(call) => call.method === "readFile" && call.detail?.endsWith(".bin"),
			),
		).toEqual([]);
	});

	it("refuses a listing line it cannot read", async () => {
		const { deps, sandboxes } = await setup();
		sandboxes.scriptedExec.set("find", [
			OK,
			{ ...OK, stdout: "client/name\twith-tab\t12\n" },
		]);

		const result = await runPublishApp(deps, INPUT);

		expect(result.errorCode).toBe("output_invalid");
	});

	it("refuses a server/wrangler.json that is not JSON", async () => {
		const { deps } = await setup({
			files: { ...OUTPUT_FILES, "server/wrangler.json": "main = index.js" },
		});

		const result = await runPublishApp(deps, INPUT);

		expect(result.errorCode).toBe("output_invalid");
	});

	it("refuses one asset above 25 MiB", async () => {
		const { deps, sandboxes } = await setup();
		sandboxes.scriptedExec.set("find", [
			OK,
			{
				...OK,
				stdout: `${listingOf(OUTPUT_FILES)}client/video.mp4\t${26 * 1024 * 1024}\n`,
			},
		]);

		const result = await runPublishApp(deps, INPUT);

		expect(result.errorCode).toBe("output_too_large");
	});

	it("refuses an output whose main module is missing", async () => {
		const { deps } = await setup({
			files: {
				...OUTPUT_FILES,
				"server/wrangler.json": JSON.stringify({
					compatibility_date: "2026-09-01",
					main: "worker.js",
				}),
			},
		});

		const result = await runPublishApp(deps, INPUT);

		expect(result.errorCode).toBe("output_invalid");
	});
});

describe("runPublishApp failures", () => {
	it("skips a replayed run that finds the row out of queued", async () => {
		const { deps, sandboxes } = await setup({
			row: buildRow({ status: "building" }),
		});
		sandboxes.calls.length = 0;

		expect(await runPublishApp(deps, INPUT)).toEqual({
			errorCode: null,
			outcome: "skipped",
		});
		expect(sandboxes.calls).toEqual([]);
	});

	it("fails unconfigured without the W4P client", async () => {
		const { deps } = await setup();

		const result = await runPublishApp({ ...deps, workers: null }, INPUT);

		expect(result).toEqual({ errorCode: "unconfigured", outcome: "failed" });
	});

	it("keeps the previous Worker and fails the pending row when the deploy fails", async () => {
		const { deps, workers } = await setup({ live: deploymentRow() });
		workers.failNext(
			"deployScript",
			new WorkersForPlatformsError(
				"cloudflare PUT answered 500",
				500,
				"ray-1",
				[],
			),
		);

		const result = await runPublishApp(deps, INPUT);

		expect(result).toEqual({ errorCode: "upload_failed", outcome: "failed" });
		expect(deps.deployments.markFailed).toHaveBeenCalledWith(
			"deployment-new",
			"cloudflare PUT answered 500",
		);
		expect(deps.deployments.promoteToActive).not.toHaveBeenCalled();
		expect(workers.calls.map((call) => call.method)).not.toContain(
			"deleteScript",
		);
	});

	it("deletes a first publish and writes no pointer when another project takes the slug", async () => {
		const { deps, workers } = await setup();
		deps.deployments.promoteToActive.mockRejectedValue(
			new SlugTakenError("booking-app"),
		);

		const result = await runPublishApp(deps, INPUT);

		expect(result).toEqual({ errorCode: "slug_taken", outcome: "failed" });
		// The pointer of the other project stays untouched.
		expect(deps.routing.putHostPointer).not.toHaveBeenCalled();
		expect(workers.scripts.has(`app-${PROJECT_ID}`)).toBe(false);
		expect(deps.deployments.markFailed).toHaveBeenCalledWith(
			"deployment-new",
			"booking-app is already used by another live site",
		);
	});

	it("ends the row and the Worker of a first publish when the pointer write fails", async () => {
		const { deps, workers } = await setup();
		deps.routing.putHostPointer.mockRejectedValue(
			new DomainProviderError("Cloudflare domain routing request failed"),
		);

		const result = await runPublishApp(deps, INPUT);

		expect(result).toEqual({ errorCode: "upload_failed", outcome: "failed" });
		expect(deps.deployments.unpublishActive).toHaveBeenCalledWith(PROJECT_ID);
		expect(workers.scripts.has(`app-${PROJECT_ID}`)).toBe(false);
	});

	it("keeps a re-publish live when the pointer rewrite fails", async () => {
		const { deps, workers } = await setup({ live: deploymentRow() });
		deps.routing.putHostPointer.mockRejectedValue(new Error("kv down"));

		const result = await runPublishApp(deps, INPUT);

		expect(result).toEqual({ errorCode: null, outcome: "published" });
		expect(deps.deployments.unpublishActive).not.toHaveBeenCalled();
		expect(workers.scripts.has(`app-${PROJECT_ID}`)).toBe(true);
		expect(deps.logger.error).toHaveBeenCalledWith(
			"publish-app.pointer-rewrite-failed",
			{
				error: "kv down",
				host: "booking-app.wandit.app",
				projectId: PROJECT_ID,
			},
		);
	});

	it("uploads nothing when the API ended the row before the upload", async () => {
		const { deps, workers } = await setup();
		const machine = deps.publish.transition.getMockImplementation();
		deps.publish.transition.mockImplementation(async (id, change) =>
			change.to === "uploading" ? null : (machine?.(id, change) ?? null),
		);

		const result = await runPublishApp(deps, INPUT);

		expect(result).toEqual({ errorCode: null, outcome: "skipped" });
		expect(workers.calls).toEqual([]);
		expect(deps.publish.insertPendingDeployment).not.toHaveBeenCalled();
	});

	it("fails a deleted project before it wakes the sandbox", async () => {
		const { deps, sandboxes } = await setup();
		deps.publish.findProject.mockResolvedValue({
			...PROJECT,
			deletedAt: new Date("2026-10-01T11:00:00.000Z"),
		});
		sandboxes.calls.length = 0;

		const result = await runPublishApp(deps, INPUT);

		expect(result).toEqual({ errorCode: "internal", outcome: "failed" });
		expect(sandboxes.calls).toEqual([]);
	});
});

describe("runPublishApp rollback", () => {
	it("uploads the stored output of the source build without a sandbox", async () => {
		const { deps, sandboxes, stored, workers } = await setup({
			live: deploymentRow({ slug: "my-shop" }),
			row: buildRow({ sourceBuildId: SOURCE_BUILD_ID }),
		});
		stored.set(
			publishedAppBuildKey(PROJECT_ID, SOURCE_BUILD_ID),
			gzipSync(JSON.stringify(storedOutput())),
		);
		sandboxes.calls.length = 0;

		const result = await runPublishApp(deps, INPUT);

		expect(result).toEqual({ errorCode: null, outcome: "published" });
		expect(sandboxes.calls).toEqual([]);
		expect(deps.storage.put).not.toHaveBeenCalled();
		expect(
			workers.scripts.get(`app-${PROJECT_ID}`)?.input?.modules[0]?.path,
		).toBe("index.js");
		expect(deps.publish.insertPendingDeployment).toHaveBeenCalledWith({
			buildId: BUILD_ID,
			commitSha: COMMIT_SHA,
			projectId: PROJECT_ID,
			slug: "my-shop",
		});
	});

	it("fails source_missing when the stored output is gone", async () => {
		const { deps } = await setup({
			row: buildRow({ sourceBuildId: SOURCE_BUILD_ID }),
		});

		const result = await runPublishApp(deps, INPUT);

		expect(result).toEqual({ errorCode: "source_missing", outcome: "failed" });
	});
});

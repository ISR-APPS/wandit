import { ServiceUnavailableException } from "@nestjs/common";
import { APIError, type NetworkPolicy } from "@vercel/sandbox";
import { describe, expect, it, vi } from "vitest";

import { SandboxForkNotSupportedError } from "../../domain/errors/sandbox-fork-not-supported.error";
import { SandboxNotFoundError } from "../../domain/errors/sandbox-not-found.error";
import { TemplateArchiveMissingError } from "../../domain/errors/template-archive-missing.error";
import type { RepoRestorer } from "../../domain/ports/git-store";
import type {
	SandboxCreateOptions,
	SandboxHandle,
	SandboxLogger,
} from "../../domain/ports/sandbox-provider";
import type { V2EnvSource } from "../env/v2-env";
import { FakeSandboxSessionsRepository } from "../persistence/fake-sandbox-sessions.repository";
import { GLOBAL_ALLOWED_HOSTS, SANDBOX_DENIED_RANGES } from "./network-policy";
import type { TemplateInit } from "./template-init";
import {
	type VercelGetOrCreateParams,
	type VercelGetParams,
	type VercelListSnapshotsParams,
	type VercelSandboxInstance,
	VercelSandboxProvider,
	type VercelSandboxSdk,
	type VercelSnapshotList,
} from "./vercel-sandbox.provider";

const harnessMocks = vi.hoisted(() => ({
	createSession: vi.fn(),
	createVercelSandbox: vi.fn(),
}));

vi.mock("@ai-sdk/sandbox-vercel", () => ({
	createVercelSandbox: harnessMocks.createVercelSandbox,
}));

type FakeRunParams = {
	args?: string[];
	cmd: string;
	cwd?: string;
	detached?: boolean;
	env?: Record<string, string>;
	signal?: AbortSignal;
	timeoutMs?: number;
};

type FakeFinished = {
	readonly exitCode: number;
	stderr(): Promise<string>;
	stdout(): Promise<string>;
};

class FakeVercelSandbox implements VercelSandboxInstance {
	readonly expiresAt: Date;
	readonly routes: { port: number }[];
	readonly commands: FakeRunParams[] = [];
	readonly writtenFiles: { path: string }[] = [];
	readonly updates: Parameters<VercelSandboxInstance["update"]>[0][] = [];
	readonly extensions: number[] = [];
	/** Every policy `updateNetworkPolicy` received, in call order. */
	readonly networkPolicies: NetworkPolicy[] = [];
	stopped = false;
	deleted = false;
	/** When set, `updateNetworkPolicy` rejects with it: the fail-closed path. */
	failWith: Error | null = null;
	/** runCommand and updateNetworkPolicy calls, in order. */
	readonly events: string[] = [];
	readonly fs = {
		readdir: async (_path: string): Promise<string[]> => [],
	};
	/** The policy the vendor reads back with the session; the create policy, then each update. */
	sessionPolicy: NetworkPolicy | undefined;

	get status(): VercelSandboxInstance["status"] {
		return this.stopped ? "stopped" : "running";
	}

	currentSession(): ReturnType<VercelSandboxInstance["currentSession"]> {
		return {
			cwd: "/vercel",
			networkPolicy: this.sessionPolicy,
			// Like the SDK Session: a stopped session fails, it never resumes.
			runCommand: (params: FakeRunParams) => {
				if (this.stopped) {
					return Promise.reject(new Error("sandbox_stopped"));
				}
				this.events.push("sessionRunCommand");
				return this.runCommand(params);
			},
			extendTimeout: (duration: number) => {
				if (this.stopped) {
					return Promise.reject(new Error("sandbox_stopped"));
				}
				return this.extendTimeout(duration);
			},
			readFileToBuffer: (file: { path: string }) => {
				if (this.stopped) {
					return Promise.reject(new Error("sandbox_stopped"));
				}
				return this.readFileToBuffer(file);
			},
			writeFiles: (files: ReadonlyArray<{ path: string }>) => {
				if (this.stopped) {
					return Promise.reject(new Error("sandbox_stopped"));
				}
				return this.writeFiles(files);
			},
			snapshot: (opts: { expiration: number }) => {
				if (this.stopped) {
					return Promise.reject(new Error("sandbox_stopped"));
				}
				// Like the vendor: the snapshot stops the sandbox.
				this.stopped = true;
				this.snapshotExpiration = opts.expiration;
				return Promise.resolve({ snapshotId: `snap-${this.name}` });
			},
		};
	}
	private readonly scripted = new Map<string, FakeFinished[]>();

	constructor(
		readonly name: string,
		timeout: number,
		ports: readonly number[],
		networkPolicy: NetworkPolicy | undefined,
	) {
		this.expiresAt = new Date(Date.now() + timeout);
		this.routes = ports.map((port) => ({ port }));
		this.sessionPolicy = networkPolicy;
	}

	respondTo(cmd: string, result: FakeFinished): void {
		const queue = this.scripted.get(cmd) ?? [];
		queue.push(result);
		this.scripted.set(cmd, queue);
	}

	runCommand(
		params: FakeRunParams & { detached: true },
	): Promise<{ cmdId: string }>;
	runCommand(params: FakeRunParams): Promise<FakeFinished>;
	runCommand(params: FakeRunParams): Promise<{ cmdId: string } | FakeFinished> {
		this.commands.push(params);
		this.events.push("runCommand");
		if (params.detached === true) {
			return Promise.resolve({ cmdId: `cmd-${this.commands.length}` });
		}
		const queue = this.scripted.get(params.cmd) ?? [];
		return Promise.resolve(
			queue.shift() ?? {
				exitCode: 0,
				stderr: () => Promise.resolve(""),
				stdout: () => Promise.resolve(""),
			},
		);
	}

	writeFiles(files: ReadonlyArray<{ path: string }>): Promise<void> {
		this.writtenFiles.push(...files);
		return Promise.resolve();
	}

	readFileToBuffer(_file: { path: string }): Promise<Uint8Array | null> {
		return Promise.resolve(null);
	}

	domain(port: number): string {
		if (!this.routes.some((route) => route.port === port)) {
			throw new Error(`no route for port ${port}`);
		}
		return `https://${this.name}-${port}.vercel.run`;
	}

	update(
		params: Parameters<VercelSandboxInstance["update"]>[0],
	): Promise<void> {
		this.updates.push(params);
		if (params.ports) {
			this.routes.splice(
				0,
				this.routes.length,
				...params.ports.map((port) => ({ port })),
			);
		}
		return Promise.resolve();
	}

	extendTimeout(duration: number): Promise<void> {
		this.extensions.push(duration);
		return Promise.resolve();
	}

	updateNetworkPolicy(policy: NetworkPolicy): Promise<NetworkPolicy> {
		if (this.failWith) {
			return Promise.reject(this.failWith);
		}
		this.networkPolicies.push(policy);
		this.events.push("updateNetworkPolicy");
		this.sessionPolicy = policy;
		return Promise.resolve(policy);
	}

	stop(): Promise<{ status: string }> {
		this.stopped = true;
		return Promise.resolve({ status: "stopped" });
	}

	delete(): Promise<void> {
		this.deleted = true;
		return Promise.resolve();
	}

	/** The `expiration` of the last session `snapshot` call; null before one. */
	snapshotExpiration: number | null = null;
}

class FakeVercelSdk implements VercelSandboxSdk {
	readonly getOrCreateCalls: VercelGetOrCreateParams[] = [];
	readonly instances = new Map<string, FakeVercelSandbox>();
	private readonly gone = new Set<string>();
	/** The snapshot `listSnapshots` answers for every name; null answers none. */
	readySnapshot: VercelSnapshotList["snapshots"][number] | null = null;
	/** Every name `listSnapshots` received, in call order. */
	readonly listedNames: string[] = [];
	/** When set, `listSnapshots` rejects with it: the lookup-failed path. */
	listFailWith: Error | null = null;
	/** When set, a create from a snapshot `source` answers this HTTP status. 404 is a deleted snapshot. */
	rejectSnapshotSourceWith: number | null = null;

	listSnapshots(
		params: VercelListSnapshotsParams,
	): Promise<VercelSnapshotList> {
		this.listedNames.push(params.name);
		if (this.listFailWith) {
			return Promise.reject(this.listFailWith);
		}
		return Promise.resolve({
			snapshots: this.readySnapshot ? [this.readySnapshot] : [],
		});
	}

	/** Simulates the vendor losing the named sandbox. */
	expire(name: string): void {
		this.gone.add(name);
	}

	get(params: VercelGetParams): Promise<VercelSandboxInstance> {
		const instance = params.name ? this.instances.get(params.name) : undefined;
		if (!instance || (params.name && this.gone.has(params.name))) {
			return Promise.reject(
				new APIError(new Response(null, { status: 404 }), {
					message: "not_found",
				}),
			);
		}
		return Promise.resolve(instance);
	}

	async getOrCreate(
		params: VercelGetOrCreateParams,
	): Promise<VercelSandboxInstance> {
		this.getOrCreateCalls.push(params);
		const name = params.name;
		const existing = name ? this.instances.get(name) : undefined;
		if (existing && !existing.deleted && !(name && this.gone.has(name))) {
			if (params.resume && existing.stopped) {
				existing.stopped = false;
				await params.onResume?.(existing);
			}
			return existing;
		}
		if (params.source && this.rejectSnapshotSourceWith !== null) {
			throw new APIError(
				new Response(null, { status: this.rejectSnapshotSourceWith }),
				{ message: "snapshot boot refused" },
			);
		}
		const created = new FakeVercelSandbox(
			name ?? `anon-${this.instances.size}`,
			params.timeout ?? 0,
			params.ports ?? [],
			params.networkPolicy,
		);
		if (name) {
			this.instances.set(name, created);
			this.gone.delete(name);
		}
		await params.onCreate?.(created);
		return created;
	}
}

class FakeTemplateInit implements TemplateInit {
	readonly applied: { framework: string; templateVersion: string }[] = [];
	/** When set, `apply` rejects with it: the upload-failed path. */
	failWith: Error | null = null;
	/** What `contentHash` answers; a spec changes it to change the template files. */
	hash = "content-hash-1";
	/** When set, `contentHash` rejects with it: an archive that is not shipped. */
	hashFailWith: Error | null = null;

	contentHash(): Promise<string> {
		return this.hashFailWith
			? Promise.reject(this.hashFailWith)
			: Promise.resolve(this.hash);
	}

	apply(
		_sandbox: SandboxHandle,
		options: { framework: string; templateVersion: string },
	): Promise<void> {
		if (this.failWith) {
			return Promise.reject(this.failWith);
		}
		this.applied.push(options);
		return Promise.resolve();
	}

	// template-init.spec.ts covers the replace; the real method never throws.
	replaceOldTemplateFiles(): Promise<void> {
		return Promise.resolve();
	}
}

class FakeRepoRestorer implements RepoRestorer {
	readonly restored: string[] = [];

	restore(projectId: string, _sandbox: SandboxHandle): Promise<void> {
		this.restored.push(projectId);
		return Promise.resolve();
	}
}

function fakeLogger() {
	return {
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
	} satisfies SandboxLogger;
}

const ENV_SOURCE: V2EnvSource = {
	V2_HARNESS: "claude-code",
	VERCEL_PROJECT_ID: "vercel-project-1",
	VERCEL_SANDBOX_IMAGE: "registry.test/wandit/sandbox:1",
	VERCEL_TEAM_ID: "team-1",
	VERCEL_SANDBOX_TOKEN: "vercel-token-1",
};

const OPTIONS: SandboxCreateOptions = {
	devCommand: "pnpm dev",
	devPort: 3000,
	backendUrl: "https://project.supabase.co",
	env: {
		ANTHROPIC_AUTH_TOKEN: "run-token",
		ANTHROPIC_BASE_URL: "https://llm-proxy.test",
		ANTHROPIC_API_KEY: "",
	},
	framework: "web-app",
	organizationId: "org-1",
	ownerUserId: "user-1",
	templateVersion: "web-app@1.0.0",
};

function setup(envSource: V2EnvSource = ENV_SOURCE) {
	const sessions = new FakeSandboxSessionsRepository();
	const restorer = new FakeRepoRestorer();
	const templateInit = new FakeTemplateInit();
	const logger = fakeLogger();
	const sdk = new FakeVercelSdk();
	const provider = new VercelSandboxProvider(
		sessions,
		restorer,
		templateInit,
		logger,
		sdk,
		envSource,
	);
	return { logger, provider, restorer, sdk, sessions, templateInit };
}

describe("VercelSandboxProvider.getOrCreate", () => {
	it("creates the sandbox, inserts a creating row, then marks it running", async () => {
		const { provider, sessions, sdk, templateInit, restorer } = setup();

		const handle = await provider.getOrCreate("p1", OPTIONS);

		const params = sdk.getOrCreateCalls[0];
		expect(params?.name).toBe("p1");
		expect(params?.region).toBe("cdg1");
		expect(params?.ports).toEqual([4000, 3000, 8081]);
		expect(params?.resources).toEqual({ vcpus: 2 });
		expect(params?.timeout).toBe(1_800_000);
		expect(params?.persistent).toBe(true);
		expect(params?.image).toBe("registry.test/wandit/sandbox:1");
		expect(params?.token).toBe("vercel-token-1");

		const row = await sessions.findLiveByProjectId("p1");
		expect(row?.status).toBe("running");
		expect(row?.providerSandboxId).toBe("p1");
		expect(row?.previewHost).toBe("p1-3000.vercel.run");
		expect(row?.lastActiveAt).not.toBeNull();

		expect(handle.providerSandboxId).toBe("p1");
		expect(templateInit.applied).toEqual([
			{ framework: "web-app", templateVersion: "web-app@1.0.0" },
		]);
		expect(restorer.restored).toEqual(["p1"]);

		const sandbox = sdk.instances.get("p1");
		expect(
			sandbox?.commands.some(
				(command) =>
					command.detached === true && command.args?.includes("pnpm dev"),
			),
		).toBe(true);
	});

	it("gives the dev command of a mobile-app project EXPO_PACKAGER_PROXY_URL on the Metro host", async () => {
		const { provider, sdk } = setup({
			...ENV_SOURCE,
			PREVIEW_DOMAIN: "preview-domain.test",
		});

		await provider.getOrCreate("p1", {
			...OPTIONS,
			devPort: 8081,
			framework: "mobile-app",
			templateVersion: "mobile-app@1.0.0",
		});
		await provider.getOrCreate("p2", OPTIONS);

		const devCommandOf = (projectId: string) =>
			sdk.instances
				.get(projectId)
				?.commands.find((command) => command.args?.includes("pnpm dev"));
		expect(devCommandOf("p1")?.env?.EXPO_PACKAGER_PROXY_URL).toBe(
			"https://p-p1.preview-domain.test",
		);
		// A web-app project runs Vite; the Expo value stays out of its env.
		expect(devCommandOf("p2")?.env).not.toHaveProperty(
			"EXPO_PACKAGER_PROXY_URL",
		);
	});

	it("reuses the live row and sandbox on a second call", async () => {
		const { provider, sessions, sdk, templateInit } = setup();

		await provider.getOrCreate("p1", OPTIONS);
		await provider.getOrCreate("p1", OPTIONS);

		expect(sdk.getOrCreateCalls).toHaveLength(2);
		expect(templateInit.applied).toHaveLength(1);
		expect(sessions.rows.size).toBe(1);
	});

	it("logs only the network-policy line on a plain reuse of a running sandbox", async () => {
		const { logger, provider } = setup();
		await provider.getOrCreate("p1", OPTIONS);
		logger.info.mockClear();
		logger.warn.mockClear();
		logger.error.mockClear();

		await provider.getOrCreate("p1", OPTIONS);

		expect(logger.info).toHaveBeenCalledTimes(1);
		expect(logger.info).toHaveBeenCalledWith(
			"sandbox.network-policy.unchanged",
			expect.objectContaining({ projectId: "p1" }),
		);
		expect(logger.warn).not.toHaveBeenCalled();
		expect(logger.error).not.toHaveBeenCalled();
	});

	it("calls onWake before the vendor call when the row is stopped", async () => {
		const { provider, sdk } = setup();
		await provider.getOrCreate("p1", OPTIONS);
		await provider.stop("p1");
		/** `sdk.getOrCreateCalls.length` at each `onWake` call. */
		const vendorCallsAtWake: number[] = [];

		await provider.getOrCreate("p1", {
			...OPTIONS,
			onWake: async () => {
				vendorCallsAtWake.push(sdk.getOrCreateCalls.length);
			},
		});

		// One call: the first getOrCreate. The resume call comes after.
		expect(vendorCallsAtWake).toEqual([1]);
	});

	it("does not call onWake on a plain reuse of a running sandbox", async () => {
		const { provider } = setup();
		await provider.getOrCreate("p1", OPTIONS);
		let wakes = 0;

		await provider.getOrCreate("p1", {
			...OPTIONS,
			onWake: async () => {
				wakes += 1;
			},
		});

		expect(wakes).toBe(0);
	});

	it("calls onWake once on a rebuild of a running row", async () => {
		const { provider, sdk } = setup();
		await provider.getOrCreate("p1", OPTIONS);
		sdk.expire("p1");
		/** `sdk.getOrCreateCalls.length` at each `onWake` call. */
		const vendorCallsAtWake: number[] = [];

		await provider.getOrCreate("p1", {
			...OPTIONS,
			onWake: async () => {
				vendorCallsAtWake.push(sdk.getOrCreateCalls.length);
			},
		});

		// The row said running, so the wake is known only after the vendor
		// created a fresh sandbox: two calls are recorded by then.
		expect(vendorCallsAtWake).toEqual([2]);
	});

	it("keeps platform secrets out of the vendor env", async () => {
		const { provider, sdk } = setup();

		await provider.getOrCreate("p1", OPTIONS);

		const env = sdk.getOrCreateCalls[0]?.env ?? {};
		expect(env).not.toHaveProperty("VERCEL_SANDBOX_TOKEN");
		expect(env).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
		expect(env.ANTHROPIC_API_KEY).toBe("");
	});

	it("calls onCreated on a create and a rebuild, not on a resume", async () => {
		const { provider, sdk } = setup();
		let created = 0;
		const options = {
			...OPTIONS,
			onCreated: () => {
				created += 1;
			},
		};

		await provider.getOrCreate("p1", options);
		await provider.stop("p1");
		// A resume keeps the disk and its Claude Code transcript.
		await provider.getOrCreate("p1", options);
		expect(created).toBe(1);

		sdk.expire("p1");
		await provider.getOrCreate("p1", options);
		expect(created).toBe(2);
	});

	it("rebuilds from the template when the vendor lost the sandbox", async () => {
		const { provider, logger, restorer, sdk, sessions, templateInit } = setup();

		await provider.getOrCreate("p1", OPTIONS);
		sdk.expire("p1");
		await provider.getOrCreate("p1", OPTIONS);

		expect(templateInit.applied).toHaveLength(2);
		expect(restorer.restored).toEqual(["p1", "p1"]);
		expect(logger.warn).toHaveBeenCalledWith(
			"sandbox.lifecycle.rebuild",
			expect.objectContaining({ projectId: "p1" }),
		);
		// The rebuild runs on a `running` row: markRunning must still write
		// the new vendor fields — a creating/stopped-only CAS would lose them.
		expect(sessions.rows.get("row-1")?.expiresAt).toBe(
			sdk.instances.get("p1")?.expiresAt,
		);
	});

	it("deletes a fresh sandbox when its setup fails", async () => {
		const { provider, sdk, sessions, templateInit } = setup();
		templateInit.failWith = new Error("upload failed");

		await expect(provider.getOrCreate("p1", OPTIONS)).rejects.toThrow(
			"upload failed",
		);

		// The row is not live any more, so destroy() cannot reach the sandbox:
		// the failure path itself deletes it, or it bills for 30 minutes.
		expect(sdk.instances.get("p1")?.deleted).toBe(true);
		expect(sessions.rows.get("row-1")?.status).toBe("error");
	});

	it("throws ServiceUnavailableException without the Vercel credentials", async () => {
		const sessions = new FakeSandboxSessionsRepository();
		const provider = new VercelSandboxProvider(
			sessions,
			new FakeRepoRestorer(),
			new FakeTemplateInit(),
			fakeLogger(),
			new FakeVercelSdk(),
			{ V2_HARNESS: "claude-code" },
		);

		await expect(provider.getOrCreate("p1", OPTIONS)).rejects.toBeInstanceOf(
			ServiceUnavailableException,
		);
		expect(sessions.rows.size).toBe(0);
	});
});

describe("VercelSandboxProvider template snapshot boot", () => {
	const WITH_KEY: SandboxCreateOptions = {
		...OPTIONS,
		harnessKey: "harness-1",
	};
	const READY = { id: "snap-ready", status: "created" } as const;

	it("boots a new sandbox from the ready snapshot and skips the template init", async () => {
		const { logger, provider, restorer, sdk, sessions, templateInit } = setup();
		sdk.readySnapshot = READY;

		await provider.getOrCreate("p1", WITH_KEY);

		const params = sdk.getOrCreateCalls[0];
		expect(params?.source).toEqual({
			snapshotId: "snap-ready",
			type: "snapshot",
		});
		expect(params?.image).toBeUndefined();
		// The snapshot boot keeps the project egress policy and env of an image boot.
		const imageBoot = setup();
		await imageBoot.provider.getOrCreate("p1", OPTIONS);
		expect(params?.networkPolicy).toBeDefined();
		expect(params?.networkPolicy).toEqual(
			imageBoot.sdk.getOrCreateCalls[0]?.networkPolicy,
		);
		expect(params?.env).toEqual(WITH_KEY.env);
		expect(templateInit.applied).toEqual([]);
		// The restore and the dev server still run: the snapshot holds no project work.
		expect(restorer.restored).toEqual(["p1"]);
		expect(
			sdk.instances
				.get("p1")
				?.commands.some((command) => command.args?.includes("pnpm dev")),
		).toBe(true);
		expect((await sessions.findLiveByProjectId("p1"))?.status).toBe("running");
		expect(logger.info).toHaveBeenCalledWith(
			"sandbox.template-snapshot.boot",
			expect.objectContaining({ snapshotId: "snap-ready" }),
		);
	});

	it("boots from the image and makes no lookup without a harness key", async () => {
		const { provider, sdk, templateInit } = setup();
		sdk.readySnapshot = READY;

		await provider.getOrCreate("p1", OPTIONS);

		expect(sdk.listedNames).toEqual([]);
		expect(sdk.getOrCreateCalls[0]?.image).toBe(
			"registry.test/wandit/sandbox:1",
		);
		expect(templateInit.applied).toHaveLength(1);
	});

	it("boots from the image when no snapshot is ready", async () => {
		const { provider, sdk, templateInit } = setup();
		sdk.readySnapshot = { id: "snap-old", status: "deleted" };

		await provider.getOrCreate("p1", WITH_KEY);

		expect(sdk.getOrCreateCalls[0]?.source).toBeUndefined();
		expect(templateInit.applied).toHaveLength(1);
	});

	it("boots from the image when the snapshot lookup fails", async () => {
		const { logger, provider, sdk, templateInit } = setup();
		sdk.listFailWith = new Error("vendor down");

		await provider.getOrCreate("p1", WITH_KEY);

		expect(sdk.getOrCreateCalls[0]?.source).toBeUndefined();
		expect(templateInit.applied).toHaveLength(1);
		expect(logger.warn).toHaveBeenCalledWith(
			"sandbox.template-snapshot.lookup-failed",
			expect.objectContaining({ error: "vendor down" }),
		);
	});

	it("boots from the image when the vendor refuses the snapshot", async () => {
		const { logger, provider, sdk, templateInit } = setup();
		sdk.readySnapshot = READY;
		sdk.rejectSnapshotSourceWith = 404;

		await provider.getOrCreate("p1", WITH_KEY);

		expect(sdk.getOrCreateCalls.map((call) => call.source?.snapshotId)).toEqual(
			["snap-ready", undefined],
		);
		const retry = sdk.getOrCreateCalls[1];
		expect(retry?.image).toBe("registry.test/wandit/sandbox:1");
		expect(retry?.networkPolicy).toEqual(
			sdk.getOrCreateCalls[0]?.networkPolicy,
		);
		expect(retry?.env).toEqual(WITH_KEY.env);
		expect(templateInit.applied).toHaveLength(1);
		expect(logger.warn).toHaveBeenCalledWith(
			"sandbox.template-snapshot.boot-failed",
			expect.objectContaining({ snapshotId: "snap-ready" }),
		);
	});

	it("rethrows a vendor 5xx on the snapshot boot and makes no image boot", async () => {
		const { provider, sdk, templateInit } = setup();
		sdk.readySnapshot = READY;
		sdk.rejectSnapshotSourceWith = 500;

		await expect(provider.getOrCreate("p1", WITH_KEY)).rejects.toBeInstanceOf(
			APIError,
		);

		expect(sdk.getOrCreateCalls).toHaveLength(1);
		expect(templateInit.applied).toEqual([]);
	});

	it("resumes an older project with no shipped archive and logs no warning", async () => {
		const { logger, provider, templateInit } = setup();
		await provider.getOrCreate("p1", OPTIONS);
		await provider.stop("p1");
		templateInit.hashFailWith = new TemplateArchiveMissingError(
			"/templates/web-app-0.9.0.tar.gz",
			new Error("ENOENT"),
		);
		logger.warn.mockClear();

		await provider.getOrCreate("p1", WITH_KEY);

		expect(logger.warn).not.toHaveBeenCalled();
		expect(templateInit.applied).toHaveLength(1);
	});

	it("makes no lookup on a plain reuse of a running sandbox", async () => {
		const { provider, sdk } = setup();
		sdk.readySnapshot = READY;
		await provider.getOrCreate("p1", WITH_KEY);

		await provider.getOrCreate("p1", WITH_KEY);

		expect(sdk.listedNames).toHaveLength(1);
	});

	it("names the snapshot after the template files, the image, and the harness key", async () => {
		const { provider, sdk, templateInit } = setup();
		const other = setup({ ...ENV_SOURCE, VERCEL_SANDBOX_IMAGE: "other:2" });

		await provider.getOrCreate("p1", WITH_KEY);
		await provider.getOrCreate("p2", { ...WITH_KEY, harnessKey: "harness-2" });
		templateInit.hash = "content-hash-2";
		await provider.getOrCreate("p3", WITH_KEY);
		await other.provider.getOrCreate("p1", WITH_KEY);

		const names = [...sdk.listedNames, ...other.sdk.listedNames];
		expect(names[0]).toMatch(/^wandit-template-web-app-[0-9a-f]{16}$/);
		expect(new Set(names).size).toBe(4);
	});
});

describe("VercelSandboxProvider.ensureTemplateSnapshot", () => {
	const TEMPLATE = { framework: "web-app", templateVersion: "web-app@1.0.0" };

	function harnessFake() {
		const prepared: string[] = [];
		return {
			harness: {
				key: "harness-1",
				prepare: async (sandbox: SandboxHandle) => {
					prepared.push(sandbox.providerSandboxId);
				},
			},
			prepared,
		};
	}

	it("answers exists and builds nothing when a snapshot is ready", async () => {
		const { provider, sdk } = setup();
		sdk.readySnapshot = { id: "snap-ready", status: "created" };

		const outcome = await provider.ensureTemplateSnapshot(
			TEMPLATE,
			harnessFake().harness,
		);

		expect(outcome).toBe("exists");
		expect(sdk.getOrCreateCalls).toEqual([]);
	});

	it("builds the template and the harness in a sandbox with no secret, then snapshots it", async () => {
		const { provider, sdk, templateInit } = setup();
		const { harness, prepared } = harnessFake();

		const outcome = await provider.ensureTemplateSnapshot(TEMPLATE, harness);

		expect(outcome).toBe("built");
		const params = sdk.getOrCreateCalls[0];
		const name = sdk.listedNames[0];
		expect(params?.name).toBe(name);
		// Not persistent: only the explicit snapshot below may exist.
		expect(params?.persistent).toBe(false);
		expect(params?.region).toBe("cdg1");
		expect(params?.image).toBe("registry.test/wandit/sandbox:1");
		expect(params?.env).toBeUndefined();
		expect(params?.networkPolicy).toEqual({
			allow: ["registry.npmjs.org"],
			subnets: { deny: [...SANDBOX_DENIED_RANGES] },
		});
		expect(templateInit.applied).toEqual([TEMPLATE]);
		expect(prepared).toEqual([name]);
		// 30 days after the last boot from it: an unused old snapshot expires.
		expect(sdk.instances.get(name ?? "")?.snapshotExpiration).toBe(
			30 * 24 * 60 * 60 * 1000,
		);
	});

	it("takes no snapshot when the workspace has no template commit", async () => {
		const { provider, sdk } = setup();
		const outcome = provider.ensureTemplateSnapshot(TEMPLATE, {
			key: "harness-1",
			// A lost disk: the session answers that HEAD does not exist.
			prepare: async (sandbox) => {
				sdk.instances.get(sandbox.providerSandboxId)?.respondTo("git", {
					exitCode: 128,
					stderr: () => Promise.resolve("fatal: Needed a single revision"),
					stdout: () => Promise.resolve(""),
				});
			},
		});

		await expect(outcome).rejects.toThrow("no template commit");
		const sandbox = sdk.instances.get(sdk.listedNames[0] ?? "");
		expect(sandbox?.snapshotExpiration).toBeNull();
		expect(sandbox?.deleted).toBe(true);
	});

	it("deletes the sandbox of a crashed build before a new build", async () => {
		const { provider, sdk } = setup();
		const { harness } = harnessFake();
		await provider.ensureTemplateSnapshot(TEMPLATE, harness);
		const name = sdk.listedNames[0] ?? "";
		const crashed = sdk.instances.get(name);

		const outcome = await provider.ensureTemplateSnapshot(TEMPLATE, harness);

		expect(outcome).toBe("built");
		expect(crashed?.deleted).toBe(true);
		expect(sdk.instances.get(name)).not.toBe(crashed);
	});

	it("deletes the sandbox and takes no snapshot when a build step fails", async () => {
		const { provider, sdk, templateInit } = setup();
		templateInit.failWith = new Error("install failed");

		await expect(
			provider.ensureTemplateSnapshot(TEMPLATE, harnessFake().harness),
		).rejects.toThrow("install failed");

		const sandbox = sdk.instances.get(sdk.listedNames[0] ?? "");
		expect(sandbox?.deleted).toBe(true);
		expect(sandbox?.snapshotExpiration).toBeNull();
	});
});

describe("VercelSandboxProvider resume/stop/destroy", () => {
	it("resumes a stopped sandbox and re-runs the dev command", async () => {
		const { provider, sdk, sessions } = setup();
		await provider.getOrCreate("p1", OPTIONS);
		await provider.stop("p1");
		const before = sdk.instances.get("p1")?.commands.length ?? 0;

		await provider.resume("p1", OPTIONS);

		const sandbox = sdk.instances.get("p1");
		const newCommands = sandbox?.commands.slice(before) ?? [];
		expect(
			newCommands.some(
				(command) =>
					command.detached === true && command.args?.includes("pnpm dev"),
			),
		).toBe(true);
		expect(sandbox?.stopped).toBe(false);
		expect(sessions.rows.get("row-1")?.status).toBe("running");
	});

	it("resume throws SandboxNotFoundError without a live row", async () => {
		const { provider } = setup();

		await expect(provider.resume("p1", OPTIONS)).rejects.toBeInstanceOf(
			SandboxNotFoundError,
		);
	});

	it("stop stops the sandbox and marks the row", async () => {
		const { provider, sdk, sessions } = setup();
		await provider.getOrCreate("p1", OPTIONS);

		await provider.stop("p1");

		const sandbox = sdk.instances.get("p1");
		expect(sandbox?.stopped).toBe(true);
		expect(sessions.rows.get("row-1")?.status).toBe("stopped");
		expect(sessions.rows.get("row-1")?.lastSnapshotAt).not.toBeNull();
	});

	it("destroy deletes the sandbox and marks the row destroyed", async () => {
		const { provider, sdk, sessions } = setup();
		await provider.getOrCreate("p1", OPTIONS);

		await provider.destroy("p1");

		expect(sdk.instances.get("p1")?.deleted).toBe(true);
		expect(sessions.rows.get("row-1")?.status).toBe("destroyed");
	});

	it("destroy marks the row destroyed when the vendor sandbox is gone", async () => {
		const { provider, sessions } = setup();
		const row = await sessions.insertCreating({
			organizationId: null,
			projectId: "p1",
			provider: "vercel",
			userId: "user-1",
		});
		await sessions.markRunning(row.id, {
			expiresAt: null,
			image: "img",
			previewHost: "host",
			providerSandboxId: "p1",
		});

		await provider.destroy("p1");

		expect(row.status).toBe("destroyed");
	});
});

describe("VercelSandboxProvider.findRunning", () => {
	// A running row whose vendor sandbox the provider never cached, like the
	// API process sees a sandbox the builder-turn task started.
	async function runningRow(sessions: FakeSandboxSessionsRepository) {
		const row = await sessions.insertCreating({
			organizationId: null,
			projectId: "p1",
			provider: "vercel",
			userId: "user-1",
		});
		await sessions.markRunning(row.id, {
			expiresAt: null,
			image: "img",
			previewHost: "host",
			providerSandboxId: "p1",
		});
	}

	it("answers a reader that runs commands on the session and changes nothing", async () => {
		const { provider, sdk } = setup();
		await provider.getOrCreate("p1", OPTIONS);
		const sandbox = sdk.instances.get("p1");
		const policiesBefore = sandbox?.networkPolicies.length;

		const reader = await provider.findRunning("p1");
		const result = await reader?.exec("git", ["status"], {
			cwd: reader.workspaceDir,
		});

		expect(reader?.workspaceDir).toBe("/vercel/workspace");
		expect(result?.exitCode).toBe(0);
		expect(sandbox?.events.at(-2)).toBe("sessionRunCommand");
		expect(sandbox?.commands.at(-1)).toMatchObject({
			args: ["status"],
			cmd: "git",
			cwd: "/vercel/workspace",
		});
		expect(sdk.getOrCreateCalls).toHaveLength(1);
		expect(sandbox?.networkPolicies.length).toBe(policiesBefore);
		expect(sandbox?.extensions).toEqual([]);
	});

	it("asks the vendor, not the cache, so an old cached status never counts", async () => {
		const { provider, sdk } = setup();
		// The provider caches this instance; its status stays "running".
		await provider.getOrCreate("p1", OPTIONS);
		// The vendor timeout stopped the sandbox; a fresh get sees it.
		const fresh = new FakeVercelSandbox("p1", 0, [], undefined);
		fresh.stopped = true;
		sdk.instances.set("p1", fresh);

		expect(await provider.findRunning("p1")).toBeNull();
		expect(fresh.stopped).toBe(true);
	});

	it("fails a command or a file write after a stop and does not resume the sandbox", async () => {
		const { provider, sdk } = setup();
		await provider.getOrCreate("p1", OPTIONS);
		const reader = await provider.findRunning("p1");
		const sandbox = sdk.instances.get("p1");
		if (sandbox) {
			sandbox.stopped = true;
		}

		await expect(reader?.exec("git", ["status"])).rejects.toThrow(
			"sandbox_stopped",
		);
		// provision-backend writes `.env` through the reader: a stopped sandbox stays stopped.
		await expect(
			reader?.writeFiles([
				{ content: "A=1\n", path: "/vercel/workspace/.env" },
			]),
		).rejects.toThrow("sandbox_stopped");
		expect(sandbox?.stopped).toBe(true);
		expect(sdk.getOrCreateCalls).toHaveLength(1);
	});

	it("answers null without a live row", async () => {
		const { provider, sdk } = setup();

		expect(await provider.findRunning("p1")).toBeNull();
		expect(sdk.getOrCreateCalls).toHaveLength(0);
	});

	it("answers null for a stopped row and does not wake the sandbox", async () => {
		const { provider, sdk } = setup();
		await provider.getOrCreate("p1", OPTIONS);
		await provider.stop("p1");

		expect(await provider.findRunning("p1")).toBeNull();
		expect(sdk.instances.get("p1")?.stopped).toBe(true);
		expect(sdk.getOrCreateCalls).toHaveLength(1);
	});

	it("answers null when the vendor lost the sandbox of a running row", async () => {
		const { provider, sessions, sdk } = setup();
		await runningRow(sessions);

		expect(await provider.findRunning("p1")).toBeNull();
		expect(sdk.getOrCreateCalls).toHaveLength(0);
	});

	it("answers null when the vendor stopped the sandbox of a running row", async () => {
		const { provider, sessions, sdk } = setup();
		await runningRow(sessions);
		const stopped = new FakeVercelSandbox("p1", 0, [], undefined);
		stopped.stopped = true;
		sdk.instances.set("p1", stopped);

		expect(await provider.findRunning("p1")).toBeNull();
		expect(stopped.stopped).toBe(true);
		expect(sdk.getOrCreateCalls).toHaveLength(0);
	});
});

describe("VercelSandboxProvider.keepAliveIfRunning", () => {
	// WANDIT-164: an open preview buys time for a running sandbox only. A
	// stopped one must stay stopped, or it bills with no dev server.
	it.each([
		{ extensions: [600_000], state: "running", stopped: false },
		{ extensions: [], state: "stopped", stopped: true },
	])("gives a $state sandbox the extensions $extensions and keeps its state", async ({
		extensions,
		stopped,
	}) => {
		vi.useFakeTimers();
		try {
			const { provider, sdk } = setup();
			await provider.getOrCreate("p1", OPTIONS);
			const sandbox = sdk.instances.get("p1");
			if (sandbox) {
				sandbox.stopped = stopped;
			}
			// Ten minutes in, the deadline sits 20 minutes out.
			vi.setSystemTime(Date.now() + 10 * 60_000);

			await provider.keepAliveIfRunning("p1");

			expect(sandbox?.extensions).toEqual(extensions);
			expect(sandbox?.stopped).toBe(stopped);
			expect(sdk.getOrCreateCalls).toHaveLength(1);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("VercelSandboxHandle", () => {
	it("returns the vendor domain for previewUrl", async () => {
		const { provider } = setup();
		const handle = await provider.getOrCreate("p1", OPTIONS);

		await expect(handle.previewUrl(3000)).resolves.toBe(
			"https://p1-3000.vercel.run",
		);
	});

	it("delegates harnessSession to the adapter around the same sandbox", async () => {
		const { provider, sdk } = setup();
		const fakeSession = { id: "session-1" };
		harnessMocks.createVercelSandbox.mockReturnValue({
			createSession: harnessMocks.createSession.mockResolvedValue(fakeSession),
		});
		const handle = await provider.getOrCreate("p1", OPTIONS);

		const session = await handle.harnessSession();

		expect(harnessMocks.createVercelSandbox).toHaveBeenCalledWith({
			sandbox: sdk.instances.get("p1"),
		});
		expect(session).toBe(fakeSession);
	});

	it("extends the vendor timeout by the gap to a full timeout", async () => {
		vi.useFakeTimers();
		try {
			const { provider, sdk } = setup();
			const handle = await provider.getOrCreate("p1", OPTIONS);
			const sandbox = sdk.instances.get("p1");

			vi.setSystemTime(Date.now() + 10 * 60_000);
			await handle.exec("ls", []);
			// Same tick: the deadline already sits at the cap — no vendor call.
			await handle.exec("ls", []);
			expect(sandbox?.extensions).toEqual([600_000]);

			vi.setSystemTime(Date.now() + 60_000);
			await handle.exec("ls", []);

			// A second quick call adds the elapsed minute, not a flat 30 — a
			// full SANDBOX_TIMEOUT_MS each time would outlive the plan cap.
			expect(sandbox?.extensions).toEqual([600_000, 60_000]);
		} finally {
			vi.useRealTimers();
		}
	});

	it("keepAlive extends the vendor deadline by the elapsed gap", async () => {
		vi.useFakeTimers();
		try {
			const { provider, sdk } = setup();
			const handle = await provider.getOrCreate("p1", OPTIONS);
			const sandbox = sdk.instances.get("p1");

			// Ten minutes in, the deadline sits 20 minutes out; the call
			// adds the elapsed gap back to a full timeout.
			vi.setSystemTime(Date.now() + 10 * 60_000);
			await handle.keepAlive();

			expect(sandbox?.extensions).toEqual([600_000]);
		} finally {
			vi.useRealTimers();
		}
	});

	it("skips the vendor call when the gap is under one minute", async () => {
		vi.useFakeTimers();
		try {
			const { provider, sdk } = setup();
			const handle = await provider.getOrCreate("p1", OPTIONS);
			const sandbox = sdk.instances.get("p1");

			// The template upload runs right after create. The vendor rejects
			// a duration under 1000 ms, so a 500 ms gap must not reach it.
			vi.setSystemTime(Date.now() + 500);
			await handle.writeFiles([{ content: "x", path: "a" }]);
			expect(sandbox?.extensions).toEqual([]);

			vi.setSystemTime(Date.now() + 59_500);
			await handle.writeFiles([{ content: "y", path: "b" }]);
			expect(sandbox?.extensions).toEqual([60_000]);
		} finally {
			vi.useRealTimers();
		}
	});

	it("fork rejects with SandboxForkNotSupportedError", async () => {
		const { provider } = setup();

		await expect(provider.fork("p1")).rejects.toBeInstanceOf(
			SandboxForkNotSupportedError,
		);
	});
});

describe("VercelSandboxProvider egress policy", () => {
	const STRICT_ALLOW = [
		...GLOBAL_ALLOWED_HOSTS,
		"llm-proxy.test",
		"project.supabase.co",
	].sort();
	// OPTIONS without backendUrl: a project with no active backend.
	const { backendUrl: _backendUrl, ...OPTIONS_WITHOUT_BACKEND } = OPTIONS;
	// The vendor type is a union; the provider always sends `allow` as a list.
	const supabaseHosts = (policy: NetworkPolicy | undefined): string[] =>
		typeof policy === "object" && Array.isArray(policy.allow)
			? policy.allow.filter((host) => host.endsWith("supabase.co"))
			: [];

	it("creates with a deny-by-default policy built from the env", async () => {
		const { provider, sdk } = setup();

		await provider.getOrCreate("p1", OPTIONS);

		expect(sdk.getOrCreateCalls[0]?.networkPolicy).toEqual({
			allow: STRICT_ALLOW,
			subnets: { deny: [...SANDBOX_DENIED_RANGES] },
		});
		// A fresh sandbox gets the policy at create; no live update runs.
		expect(sdk.instances.get("p1")?.networkPolicies).toEqual([]);
	});

	it("pushes the policy to a resumed sandbox through a live update", async () => {
		const { provider, sdk } = setup();
		await provider.getOrCreate("p1", OPTIONS);
		await provider.stop("p1");

		await provider.resume("p1", OPTIONS);

		expect(sdk.instances.get("p1")?.networkPolicies).toEqual([
			sdk.getOrCreateCalls[0]?.networkPolicy,
		]);
	});

	it("applies the policy update before the dev command on a resume", async () => {
		const { provider, sdk } = setup();
		await provider.getOrCreate("p1", OPTIONS);
		await provider.stop("p1");
		const sandbox = sdk.instances.get("p1");
		const before = sandbox?.events.length ?? 0;

		await provider.resume("p1", OPTIONS);

		const events = sandbox?.events.slice(before) ?? [];
		// The dev command must not boot under the stored policy.
		expect(events[0]).toBe("updateNetworkPolicy");
		expect(events).toContain("runCommand");
	});

	it("skips the policy update on a plain reuse with the same allow list", async () => {
		const { provider, sdk, sessions } = setup();
		await provider.getOrCreate("p1", OPTIONS);
		const hashAfterCreate = sessions.rows.get("row-1")?.networkPolicyHash;

		await provider.getOrCreate("p1", OPTIONS);

		// The create call carried the policy; the reuse needs no vendor update.
		expect(sdk.instances.get("p1")?.networkPolicies).toEqual([]);
		expect(typeof hashAfterCreate).toBe("string");
		expect(sessions.rows.get("row-1")?.networkPolicyHash).toBe(hashAfterCreate);
	});

	it("pushes the policy on a reuse when the vendor read back no policy", async () => {
		const { provider, sdk } = setup();
		await provider.getOrCreate("p1", OPTIONS);
		const sandbox = sdk.instances.get("p1");
		if (!sandbox) {
			throw new Error("the first getOrCreate created no sandbox");
		}
		// The harness session would read a missing policy as allow-all.
		sandbox.sessionPolicy = undefined;

		await provider.getOrCreate("p1", OPTIONS);

		expect(sandbox.networkPolicies).toEqual([
			sdk.getOrCreateCalls[0]?.networkPolicy,
		]);
	});

	it("allows exactly the project's own Supabase host with an active backend", async () => {
		const { provider, sdk } = setup();

		await provider.getOrCreate("p1", OPTIONS);

		expect(supabaseHosts(sdk.getOrCreateCalls[0]?.networkPolicy)).toEqual([
			"project.supabase.co",
		]);
	});

	it("allows no Supabase host without an active backend", async () => {
		const { provider, sdk } = setup();

		await provider.getOrCreate("p1", OPTIONS_WITHOUT_BACKEND);

		expect(supabaseHosts(sdk.getOrCreateCalls[0]?.networkPolicy)).toEqual([]);
	});

	it("allows no Supabase host when backendUrl is not a URL", async () => {
		const { provider, sdk } = setup();

		await provider.getOrCreate("p1", { ...OPTIONS, backendUrl: "not a url" });

		expect(supabaseHosts(sdk.getOrCreateCalls[0]?.networkPolicy)).toEqual([]);
	});

	it("pushes the backend host on the next turn when the backend becomes active, with no restart", async () => {
		const { provider, sdk } = setup();
		await provider.getOrCreate("p1", OPTIONS_WITHOUT_BACKEND);
		const sandbox = sdk.instances.get("p1");

		await provider.getOrCreate("p1", OPTIONS);

		const pushed = sandbox?.networkPolicies ?? [];
		expect(pushed).toHaveLength(1);
		expect(supabaseHosts(pushed[0])).toEqual(["project.supabase.co"]);
		// The second turn reuses the running sandbox: no second create, no stop.
		expect(sdk.getOrCreateCalls).toHaveLength(2);
		expect(sdk.instances.get("p1")).toBe(sandbox);
		expect(sandbox?.stopped).toBe(false);
	});

	it("pushes the policy on a reuse when the project hosts changed", async () => {
		const { provider, sdk, sessions } = setup();
		await provider.getOrCreate("p1", OPTIONS);
		const hashAfterCreate = sessions.rows.get("row-1")?.networkPolicyHash;

		await provider.getOrCreate("p1", {
			...OPTIONS,
			networkAllowedHosts: ["api.example.com"],
		});

		const pushed = sdk.instances.get("p1")?.networkPolicies ?? [];
		expect(pushed).toHaveLength(1);
		expect(pushed[0]).toEqual(
			expect.objectContaining({
				allow: expect.arrayContaining(["api.example.com"]),
			}),
		);
		expect(sessions.rows.get("row-1")?.networkPolicyHash).not.toBe(
			hashAfterCreate,
		);
	});

	it("stops the sandbox and marks the row error when the policy update fails on reuse", async () => {
		const { provider, sdk, sessions } = setup();
		await provider.getOrCreate("p1", OPTIONS);
		const sandbox = sdk.instances.get("p1");
		if (!sandbox) {
			throw new Error("the first getOrCreate created no sandbox");
		}
		const failure = new Error("policy update failed");
		sandbox.failWith = failure;

		// A new host forces the update; an unchanged list would skip it.
		await expect(
			provider.getOrCreate("p1", {
				...OPTIONS,
				networkAllowedHosts: ["api.example.com"],
			}),
		).rejects.toBe(failure);

		// The policy update fails closed: a reuse that cannot apply the
		// policy must not leave the sandbox running under the stored one.
		expect(sandbox.stopped).toBe(true);
		expect(sessions.rows.get("row-1")?.status).toBe("error");
	});

	it("open mode allows every host, keeps the deny ranges, and logs a warn", async () => {
		const { logger, provider, sdk } = setup({
			...ENV_SOURCE,
			V2_SANDBOX_EGRESS_MODE: "open",
		});

		await provider.getOrCreate("p1", OPTIONS);

		expect(sdk.getOrCreateCalls[0]?.networkPolicy).toEqual({
			allow: ["*"],
			subnets: { deny: [...SANDBOX_DENIED_RANGES] },
		});
		expect(logger.warn).toHaveBeenCalledWith(
			"sandbox.network-policy.applied",
			expect.objectContaining({ mode: "open", projectId: "p1" }),
		);
	});

	it("throws before the vendor call when strict mode lacks the proxy host", async () => {
		const { provider, sdk } = setup();
		const env = { ...OPTIONS.env };
		delete env.ANTHROPIC_BASE_URL;

		await expect(
			provider.getOrCreate("p1", { ...OPTIONS, env }),
		).rejects.toThrow("ANTHROPIC_BASE_URL");

		expect(sdk.getOrCreateCalls).toHaveLength(0);
	});

	it("an explicit options.networkPolicy wins and logs mode override", async () => {
		const { logger, provider, sdk } = setup();

		await provider.getOrCreate("p1", {
			...OPTIONS,
			env: {},
			networkPolicy: { allowedHosts: ["only.example.com"], deniedRanges: [] },
		});

		expect(sdk.getOrCreateCalls[0]?.networkPolicy).toEqual({
			allow: ["only.example.com"],
			subnets: undefined,
		});
		expect(logger.info).toHaveBeenCalledWith(
			"sandbox.network-policy.applied",
			expect.objectContaining({ mode: "override", projectId: "p1" }),
		);
	});

	it("rejects an options.networkPolicy with an empty allow list before the vendor call", async () => {
		const { provider, sdk } = setup();

		await expect(
			provider.getOrCreate("p1", {
				...OPTIONS,
				networkPolicy: { allowedHosts: [], deniedRanges: ["10.0.0.0/8"] },
			}),
		).rejects.toThrow(/empty allowedHosts/);

		expect(sdk.getOrCreateCalls).toHaveLength(0);
	});

	it("adds the git host and the asset host when the env carries them", async () => {
		const { provider, sdk } = setup({
			...ENV_SOURCE,
			CODE_STORAGE_ORG: "acme",
			R2_PUBLIC_BASE_URL: "https://assets.example.com",
		});

		await provider.getOrCreate("p1", OPTIONS);

		expect(sdk.getOrCreateCalls[0]?.networkPolicy).toEqual({
			allow: [
				...STRICT_ALLOW,
				"acme.code.storage",
				"assets.example.com",
			].sort(),
			subnets: { deny: [...SANDBOX_DENIED_RANGES] },
		});
	});

	it("adds valid per-project hosts and drops invalid ones", async () => {
		const { provider, sdk } = setup();

		await provider.getOrCreate("p1", {
			...OPTIONS,
			// One valid host joins the allow list; the IP literal is dropped.
			networkAllowedHosts: ["extra.example.com", "10.0.0.1"],
		});

		expect(sdk.getOrCreateCalls[0]?.networkPolicy).toEqual({
			allow: [...STRICT_ALLOW, "extra.example.com"].sort(),
			subnets: { deny: [...SANDBOX_DENIED_RANGES] },
		});
	});

	it("handle.allowHost merges the host into the applied policy and forwards it", async () => {
		const { provider, sdk } = setup();
		const handle = await provider.getOrCreate("p1", OPTIONS);

		await handle.allowHost("new.example.com");

		// No harness session exists yet, so the update goes to the raw vendor
		// policy: the create-time allow list plus the new host, deny ranges kept.
		expect(sdk.instances.get("p1")?.networkPolicies).toEqual([
			{
				allow: [...STRICT_ALLOW, "new.example.com"].sort(),
				subnets: { deny: [...SANDBOX_DENIED_RANGES] },
			},
		]);
	});

	it("handle.allowHost routes through the live harness session as a custom policy", async () => {
		const { provider, sdk } = setup();
		const setNetworkPolicy = vi.fn(async () => {});
		harnessMocks.createVercelSandbox.mockReturnValue({
			createSession: harnessMocks.createSession.mockResolvedValue({
				id: "s1",
				setNetworkPolicy,
			}),
		});
		const handle = await provider.getOrCreate("p1", OPTIONS);
		// A harness session now owns the sandbox egress; `allowHost` must go
		// through it, or it would drop the proxy auth transform.
		await handle.harnessSession();

		await handle.allowHost("new.example.com");

		expect(setNetworkPolicy).toHaveBeenCalledWith({
			allowedHosts: [...STRICT_ALLOW, "new.example.com"].sort(),
			deniedCIDRs: [...SANDBOX_DENIED_RANGES],
			mode: "custom",
		});
		// The raw `updateNetworkPolicy` path stays unused.
		expect(sdk.instances.get("p1")?.networkPolicies).toEqual([]);
	});

	it("handle.allowHost keeps the list deduped across two grants", async () => {
		const { provider, sdk } = setup();
		const handle = await provider.getOrCreate("p1", OPTIONS);

		await handle.allowHost("new.example.com");
		await handle.allowHost("new.example.com");

		const policies = sdk.instances.get("p1")?.networkPolicies ?? [];
		expect(policies).toHaveLength(2);
		expect(policies[1]).toEqual({
			allow: [...STRICT_ALLOW, "new.example.com"].sort(),
			subnets: { deny: [...SANDBOX_DENIED_RANGES] },
		});
	});

	it("handle.allowHost keeps both hosts of two grants that overlap", async () => {
		const { provider, sdk } = setup();
		const handle = await provider.getOrCreate("p1", OPTIONS);

		// The keep-alive tick and the request_network_host tool, at once.
		await Promise.all([
			handle.allowHost("first.example.com"),
			handle.allowHost("second.example.com"),
		]);

		const policies = sdk.instances.get("p1")?.networkPolicies ?? [];
		expect(policies.at(-1)).toEqual({
			allow: [
				...STRICT_ALLOW,
				"first.example.com",
				"second.example.com",
			].sort(),
			subnets: { deny: [...SANDBOX_DENIED_RANGES] },
		});
	});

	it("handle.setNetworkPolicy maps the port policy and forwards it", async () => {
		const { provider, sdk } = setup();
		const handle = await provider.getOrCreate("p1", OPTIONS);

		await handle.setNetworkPolicy({
			allowedHosts: ["new.example.com"],
			deniedRanges: ["10.0.0.0/8"],
		});

		expect(sdk.instances.get("p1")?.networkPolicies).toEqual([
			{ allow: ["new.example.com"], subnets: { deny: ["10.0.0.0/8"] } },
		]);
	});

	it("handle.setNetworkPolicy rejects an empty allow list", async () => {
		const { provider } = setup();
		const handle = await provider.getOrCreate("p1", OPTIONS);

		await expect(
			handle.setNetworkPolicy({
				allowedHosts: [],
				deniedRanges: ["10.0.0.0/8"],
			}),
		).rejects.toThrow(/empty allowedHosts/);
	});
});

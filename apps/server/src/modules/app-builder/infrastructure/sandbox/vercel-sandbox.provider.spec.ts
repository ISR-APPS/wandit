import { ServiceUnavailableException } from "@nestjs/common";
import { APIError } from "@vercel/sandbox";
import { describe, expect, it, vi } from "vitest";

import { SandboxForkNotSupportedError } from "../../domain/errors/sandbox-fork-not-supported.error";
import { SandboxNotFoundError } from "../../domain/errors/sandbox-not-found.error";
import type { RepoRestorer } from "../../domain/ports/git-store";
import type {
	SandboxCreateOptions,
	SandboxHandle,
	SandboxLogger,
} from "../../domain/ports/sandbox-provider";
import type { V2EnvSource } from "../env/v2-env";
import { FakeSandboxSessionsRepository } from "../persistence/fake-sandbox-sessions.repository";
import type { TemplateInit } from "./template-init";
import {
	type VercelGetOrCreateParams,
	type VercelGetParams,
	type VercelSandboxInstance,
	VercelSandboxProvider,
	type VercelSandboxSdk,
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
	stopped = false;
	deleted = false;
	readonly fs = {
		readdir: async (_path: string) => [] as string[],
	};

	currentSession(): { readonly cwd: string } {
		return { cwd: "/vercel" };
	}
	private readonly scripted = new Map<string, FakeFinished[]>();

	constructor(
		readonly name: string,
		timeout: number,
		ports: readonly number[],
	) {
		this.expiresAt = new Date(Date.now() + timeout);
		this.routes = ports.map((port) => ({ port }));
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

	stop(): Promise<{ status: string }> {
		this.stopped = true;
		return Promise.resolve({ status: "stopped" });
	}

	delete(): Promise<void> {
		this.deleted = true;
		return Promise.resolve();
	}
}

class FakeVercelSdk implements VercelSandboxSdk {
	readonly getOrCreateCalls: VercelGetOrCreateParams[] = [];
	readonly instances = new Map<string, FakeVercelSandbox>();
	private readonly gone = new Set<string>();

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
		if (existing && !(name && this.gone.has(name))) {
			if (params.resume && existing.stopped) {
				existing.stopped = false;
				await params.onResume?.(existing);
			}
			return existing;
		}
		const created = new FakeVercelSandbox(
			name ?? `anon-${this.instances.size}`,
			params.timeout ?? 0,
			params.ports ?? [],
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
	env: {
		ANTHROPIC_AUTH_TOKEN: "run-token",
		ANTHROPIC_BASE_URL: "https://llm-proxy.test",
		ANTHROPIC_API_KEY: "",
		VITE_SUPABASE_ANON_KEY: "anon",
		VITE_SUPABASE_URL: "https://project.supabase.co",
	},
	framework: "web-app",
	organizationId: "org-1",
	ownerUserId: "user-1",
	templateVersion: "web-app@1.0.0",
};

function setup() {
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
		ENV_SOURCE,
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

	it("reuses the live row and sandbox on a second call", async () => {
		const { provider, sessions, sdk, templateInit } = setup();

		await provider.getOrCreate("p1", OPTIONS);
		await provider.getOrCreate("p1", OPTIONS);

		expect(sdk.getOrCreateCalls).toHaveLength(2);
		expect(templateInit.applied).toHaveLength(1);
		expect(sessions.rows.size).toBe(1);
	});

	it("logs nothing on a plain reuse of a running sandbox", async () => {
		const { logger, provider } = setup();
		await provider.getOrCreate("p1", OPTIONS);
		logger.info.mockClear();
		logger.warn.mockClear();
		logger.error.mockClear();

		await provider.getOrCreate("p1", OPTIONS);

		expect(logger.info).not.toHaveBeenCalled();
		expect(logger.warn).not.toHaveBeenCalled();
		expect(logger.error).not.toHaveBeenCalled();
	});

	it("keeps platform secrets out of the vendor env", async () => {
		const { provider, sdk } = setup();

		await provider.getOrCreate("p1", OPTIONS);

		const env = sdk.getOrCreateCalls[0]?.env ?? {};
		expect(env).not.toHaveProperty("VERCEL_SANDBOX_TOKEN");
		expect(env).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
		expect(env.ANTHROPIC_API_KEY).toBe("");
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

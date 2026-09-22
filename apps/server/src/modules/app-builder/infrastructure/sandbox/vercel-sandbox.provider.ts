/**
 * `SandboxProvider` on Vercel Sandbox (D1): one persistent named sandbox
 * per project in `cdg1`, resumed from its snapshot and rebuilt from the
 * template when the vendor lost it. The builder-turn task and the idle
 * sweep call it. All `@vercel/sandbox` / `@ai-sdk/sandbox-vercel` imports
 * in the codebase live in this folder — vendor isolation is a rule.
 */
import { createHash } from "node:crypto";
import { posix } from "node:path";
import type { HarnessV1NetworkPolicy } from "@ai-sdk/harness";
import { createVercelSandbox } from "@ai-sdk/sandbox-vercel";
import { Inject, Injectable, Optional } from "@nestjs/common";
import {
	APIError,
	type NetworkPolicy,
	Sandbox,
	type SandboxRegion,
} from "@vercel/sandbox";
import { env } from "@wandit/env/server";
import { Sentry } from "@wandit/observability/node";

import { SandboxForkNotSupportedError } from "../../domain/errors/sandbox-fork-not-supported.error";
import { SandboxNotFoundError } from "../../domain/errors/sandbox-not-found.error";
import type { RepoRestorer } from "../../domain/ports/git-store";
import { REPO_RESTORER } from "../../domain/ports/git-store";
import type {
	HarnessSandboxSession,
	SandboxCreateOptions,
	SandboxExecOptions,
	SandboxExecResult,
	SandboxFile,
	SandboxHandle,
	SandboxLogger,
	SandboxNetworkPolicy,
	SandboxProvider,
} from "../../domain/ports/sandbox-provider";
import {
	HARNESS_BRIDGE_PORT,
	HARNESS_WORK_DIR,
} from "../../domain/ports/sandbox-provider";
import { requireV2Env, V2_ENV, type V2EnvSource } from "../env/v2-env";
import {
	type SandboxSessionRow,
	SandboxSessionsRepository,
	type SandboxSessionsStore,
} from "../persistence/sandbox-sessions.repository";
import { buildNetworkPolicy } from "./network-policy";
import { TEMPLATE_INIT, type TemplateInit } from "./template-init";

/**
 * 30 minutes after the session start. The vendor timeout is absolute,
 * not idle; `keepAlive` moves it.
 */
const SANDBOX_TIMEOUT_MS = 1_800_000;

/**
 * Smallest gap worth a vendor call, 1 minute. The vendor rejects a
 * `duration` under 1000 ms, and a call per file write would flood the API.
 */
const EXTEND_MIN_GAP_MS = 60_000;

/** Reserved for the Metro dev server (WANDIT-193). */
const METRO_PORT = 8081;

/** Pilot size: 2 vCPU / 4 GB, per the issue. */
const SANDBOX_VCPUS = 2;

/** Vendor managed image when `VERCEL_SANDBOX_IMAGE` is unset. */
const DEFAULT_IMAGE = "vercel/sandbox/node:22";

/**
 * The slice of `@vercel/sandbox` `Sandbox` this provider calls. Structural
 * so specs can fake it; the real `Sandbox` class satisfies it.
 */
export type VercelSandboxInstance = {
	readonly name: string;
	/**
	 * The vendor session; `cwd` is the default working directory of the
	 * image. `networkPolicy` is the policy the vendor read back with the
	 * session, or undefined when the answer carried none.
	 */
	currentSession(): {
		readonly cwd: string;
		readonly networkPolicy: NetworkPolicy | undefined;
	};
	readonly expiresAt: Date | undefined;
	readonly routes: ReadonlyArray<{ readonly port: number }>;
	readonly fs: {
		readdir(path: string): Promise<string[]>;
	};
	runCommand(params: {
		args?: string[];
		cmd: string;
		cwd?: string;
		detached: true;
		env?: Record<string, string>;
		signal?: AbortSignal;
		timeoutMs?: number;
	}): Promise<{ readonly cmdId: string }>;
	runCommand(params: {
		args?: string[];
		cmd: string;
		cwd?: string;
		env?: Record<string, string>;
		signal?: AbortSignal;
		timeoutMs?: number;
	}): Promise<{
		readonly exitCode: number;
		stderr(): Promise<string>;
		stdout(): Promise<string>;
	}>;
	writeFiles(
		files: ReadonlyArray<{
			content: string | Uint8Array;
			mode?: number;
			path: string;
		}>,
	): Promise<void>;
	readFileToBuffer(file: { path: string }): Promise<Uint8Array | null>;
	domain(port: number): string;
	update(params: {
		keepLastSnapshots?: {
			count: number;
			deleteEvicted?: boolean;
			expiration?: number;
		} | null;
		ports?: number[];
	}): Promise<void>;
	extendTimeout(duration: number): Promise<void>;
	/**
	 * The SDK marks this `@deprecated` in favor of `Sandbox.update`, but its
	 * implementation is `session.update({ networkPolicy })` on the live
	 * session — no restart — while `Sandbox.update` writes the sandbox
	 * config through `updateSandbox`.
	 */
	updateNetworkPolicy(policy: NetworkPolicy): Promise<NetworkPolicy>;
	/** The real SDK resolves to the final session state; we read none of it. */
	stop(): Promise<{ readonly status: string }>;
	delete(opts?: { deleteOrphanSnapshots?: boolean }): Promise<void>;
};

/** Vercel API credentials; read from env at call time, never stored. */
export type VercelCredentials = {
	projectId: string;
	teamId: string;
	token: string;
};

/**
 * Parameters the provider passes to `Sandbox.getOrCreate`. Hooks are typed
 * on `VercelSandboxInstance`, not the vendor class, so spec fakes can call
 * them without a cast.
 */
export type VercelGetOrCreateParams = VercelCredentials & {
	name?: string;
	region: SandboxRegion;
	image?: string;
	env?: Record<string, string>;
	persistent?: boolean;
	ports?: number[];
	resources?: { vcpus: number };
	timeout?: number;
	resume?: boolean;
	keepLastSnapshots?: {
		count: number;
		deleteEvicted?: boolean;
		expiration?: number;
	};
	networkPolicy?: NetworkPolicy;
	/** Fires when the call created a fresh sandbox. */
	onCreate?: (sandbox: VercelSandboxInstance) => Promise<void>;
	/** Fires when the call resumed a stopped sandbox. */
	onResume?: (sandbox: VercelSandboxInstance) => Promise<void>;
};

/** Parameters the provider passes to `Sandbox.get`. */
export type VercelGetParams = VercelCredentials & {
	name: string;
	resume?: boolean;
};

/**
 * Wraps the two static `Sandbox` entry points the provider uses. The
 * default is the real SDK; specs inject a fake through the constructor.
 */
export type VercelSandboxSdk = {
	get(params: VercelGetParams): Promise<VercelSandboxInstance>;
	getOrCreate(params: VercelGetOrCreateParams): Promise<VercelSandboxInstance>;
};

/** The live binding; a spec replaces it through the constructor. */
const vercelSandboxSdk: VercelSandboxSdk = {
	get: (params) => Sandbox.get(params),
	getOrCreate: (params) => Sandbox.getOrCreate(params),
};

/** The project root: the harness work dir under the vendor default cwd. */
function workspaceDirOf(sandbox: VercelSandboxInstance): string {
	return posix.join(sandbox.currentSession().cwd, HARNESS_WORK_DIR);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** The vendor answers 404 when the named sandbox is gone. */
function isSandboxNotFound(error: unknown): boolean {
	return error instanceof APIError && error.response.status === 404;
}

/** `SandboxHandle` over one live vendor sandbox. */
class VercelSandboxHandle implements SandboxHandle {
	/**
	 * Ports currently exposed. `update({ports})` replaces the full set, so
	 * this cache tracks what the sandbox opened beyond its create ports.
	 */
	private readonly openedPorts: Set<number>;

	/**
	 * Vendor expiry deadline in ms. `extendTimeout` adds to the current
	 * deadline, so each activity requests only the gap back to a full
	 * timeout — a flat `SANDBOX_TIMEOUT_MS` per call would outgrow the cap.
	 */
	private deadlineMs: number;

	/**
	 * The egress policy now applied to the live sandbox. `allowHost` merges a
	 * new host into it and re-applies. `start` seeds it with the create-time
	 * policy.
	 */
	private appliedPolicy: SandboxNetworkPolicy;

	/**
	 * The live harness session, once `harnessSession` created one. `allowHost`
	 * routes through it so the proxy auth transformation survives; null before
	 * a session exists.
	 */
	private liveHarnessSession: HarnessSandboxSession | null = null;

	readonly workspaceDir: string;

	constructor(
		readonly projectId: string,
		private readonly sandbox: VercelSandboxInstance,
		appliedPolicy: SandboxNetworkPolicy,
	) {
		this.workspaceDir = workspaceDirOf(sandbox);
		this.openedPorts = new Set(sandbox.routes.map((route) => route.port));
		this.deadlineMs =
			sandbox.expiresAt?.getTime() ?? Date.now() + SANDBOX_TIMEOUT_MS;
		this.appliedPolicy = appliedPolicy;
	}

	get providerSandboxId(): string {
		return this.sandbox.name;
	}

	async exec(
		command: string,
		args: string[],
		options?: SandboxExecOptions,
	): Promise<SandboxExecResult> {
		await this.keepAlive();
		const finished = await this.sandbox.runCommand({
			args,
			cmd: command,
			cwd: options?.cwd,
			env: options?.env,
			signal: options?.signal,
			timeoutMs: options?.timeoutMs,
		});
		return {
			exitCode: finished.exitCode,
			stderr: await finished.stderr(),
			stdout: await finished.stdout(),
		};
	}

	async writeFiles(files: SandboxFile[]): Promise<void> {
		await this.keepAlive();
		await this.sandbox.writeFiles(files);
	}

	async readFile(path: string): Promise<Uint8Array | null> {
		const buffer = await this.sandbox.readFileToBuffer({ path });
		return buffer === null ? null : new Uint8Array(buffer);
	}

	async listFiles(directory: string): Promise<string[]> {
		const names = await this.sandbox.fs.readdir(directory);
		return names.map((name) => posix.join(directory, name));
	}

	async openPort(port: number): Promise<void> {
		if (this.openedPorts.has(port)) {
			return;
		}
		this.openedPorts.add(port);
		await this.sandbox.update({ ports: [...this.openedPorts] });
	}

	async previewUrl(port: number): Promise<string> {
		// The vendor builds the URL; callers must never assemble one.
		return this.sandbox.domain(port);
	}

	/** Tops the vendor timeout back up to `SANDBOX_TIMEOUT_MS` from now. */
	async keepAlive(): Promise<void> {
		const now = Date.now();
		const extension = SANDBOX_TIMEOUT_MS - (this.deadlineMs - now);
		// A gap under one minute is not worth a call; the vendor rejects tiny ones.
		if (extension < EXTEND_MIN_GAP_MS) {
			return;
		}
		await this.sandbox.extendTimeout(extension);
		this.deadlineMs = now + SANDBOX_TIMEOUT_MS;
	}

	async setNetworkPolicy(policy: SandboxNetworkPolicy): Promise<void> {
		await this.applyPolicy(policy);
	}

	async allowHost(host: string): Promise<void> {
		// Merge the host into the current allow list, deduped and sorted, and
		// keep the deny ranges. A repeated grant maps to the same policy.
		const allowedHosts = [
			...new Set([...this.appliedPolicy.allowedHosts, host]),
		].sort();
		await this.applyPolicy({
			allowedHosts,
			deniedRanges: this.appliedPolicy.deniedRanges,
		});
	}

	/**
	 * Applies `policy` to the live sandbox and remembers it. It prefers the
	 * harness session's `setNetworkPolicy`, which keeps the proxy auth
	 * transformation the session added. Before a session exists it writes the
	 * raw vendor policy directly.
	 */
	private async applyPolicy(policy: SandboxNetworkPolicy): Promise<void> {
		const session = this.liveHarnessSession;
		if (session?.setNetworkPolicy !== undefined) {
			// Call as a method so the session stays the receiver.
			await session.setNetworkPolicy(toHarnessNetworkPolicy(policy));
		} else {
			await this.sandbox.updateNetworkPolicy(toVendorNetworkPolicy(policy));
		}
		this.appliedPolicy = policy;
	}

	async harnessSession(): Promise<HarnessSandboxSession> {
		// `{ sandbox }` wraps this sandbox; a sessionId/identity settings path
		// would let the adapter create a second sandbox of its own.
		// SAFETY: vercelSandboxSdk returns real Sandbox instances; the spec
		// that injects a fake also mocks createVercelSandbox.
		const provider = createVercelSandbox({
			sandbox: this.sandbox as Sandbox,
		});
		const session = await provider.createSession();
		// `allowHost` mid-turn routes policy updates through this session, so
		// the proxy auth transformation the SDK adds next stays in place.
		this.liveHarnessSession = session;
		return session;
	}
}

/**
 * Vercel-backed `SandboxProvider`. Persists every transition in
 * `sandbox_sessions`; the vendor snapshot is only a disk cache — the git
 * copy restored by `RepoRestorer` is the source of truth.
 */
@Injectable()
export class VercelSandboxProvider implements SandboxProvider {
	readonly providerId = "vercel";

	/** Project → live vendor sandbox, to skip a vendor `get` on stop/destroy. */
	// LIMIT: one cache per process; a stale entry costs one failed vendor
	// call. Upgrade: drop the map and always call Sandbox.get.
	private readonly live = new Map<string, VercelSandboxInstance>();

	constructor(
		// The Pick type, not the class: specs pass the fake without a cast.
		@Inject(SandboxSessionsRepository)
		private readonly sessions: SandboxSessionsStore,
		@Inject(REPO_RESTORER) private readonly repoRestorer: RepoRestorer,
		@Inject(TEMPLATE_INIT) private readonly templateInit: TemplateInit,
		@Optional() private readonly logger: SandboxLogger = Sentry.logger,
		@Optional() private readonly sdk: VercelSandboxSdk = vercelSandboxSdk,
		@Inject(V2_ENV) private readonly envSource: V2EnvSource = env,
	) {}

	async getOrCreate(
		projectId: string,
		options: SandboxCreateOptions,
	): Promise<SandboxHandle> {
		const credentials = this.credentials();
		const existing = await this.sessions.findLiveByProjectId(projectId);
		const row = existing ?? (await this.insertCreating(projectId, options));
		return this.start(projectId, options, row, credentials, {
			hadLiveRow: existing !== null,
		});
	}

	async resume(
		projectId: string,
		options: SandboxCreateOptions,
	): Promise<SandboxHandle> {
		const credentials = this.credentials();
		const row = await this.sessions.findLiveByProjectId(projectId);
		if (!row) {
			throw new SandboxNotFoundError(projectId);
		}
		return this.start(projectId, options, row, credentials, {
			hadLiveRow: true,
		});
	}

	async stop(projectId: string): Promise<void> {
		const row = await this.sessions.findLiveByProjectId(projectId);
		if (!row || row.status === "stopped") {
			return;
		}
		const sandbox = await this.findSandbox(projectId);
		if (!sandbox) {
			// The vendor lost the sandbox: mark the row error; the next
			// getOrCreate starts a new row.
			await this.sessions.markError(row.id, "vendor sandbox missing at stop");
			this.logger.warn("sandbox.lifecycle.missing-at-stop", {
				projectId,
				sandboxId: row.providerSandboxId ?? "",
			});
			return;
		}
		try {
			await sandbox.stop();
			await this.sessions.markStopped(row.id, new Date());
			this.logLifecycle("stop", projectId, sandbox.name);
		} catch (error) {
			await this.sessions.markError(row.id, errorMessage(error));
			throw error;
		}
		this.live.delete(projectId);
	}

	async destroy(projectId: string): Promise<void> {
		const row = await this.sessions.findLiveByProjectId(projectId);
		if (!row) {
			return;
		}
		const sandbox = await this.findSandbox(projectId);
		try {
			if (sandbox) {
				await sandbox.delete({ deleteOrphanSnapshots: true });
			}
			await this.sessions.markDestroyed(row.id);
			this.logLifecycle(
				"destroy",
				projectId,
				sandbox?.name ?? row.providerSandboxId ?? projectId,
			);
		} catch (error) {
			await this.sessions.markError(row.id, errorMessage(error));
			throw error;
		}
		this.live.delete(projectId);
	}

	/** Not built before P6 (D13). */
	fork(_projectId: string): Promise<SandboxHandle> {
		return Promise.reject(new SandboxForkNotSupportedError());
	}

	/**
	 * The shared get/resume flow: the vendor `getOrCreate` resumes a stopped
	 * sandbox, no-ops on a live one, and creates — firing `onCreate` — when
	 * the named sandbox is gone (`not_found` or an expired snapshot).
	 */
	private async start(
		projectId: string,
		options: SandboxCreateOptions,
		row: SandboxSessionRow,
		credentials: VercelCredentials,
		context: { hadLiveRow: boolean },
	): Promise<SandboxHandle> {
		const image = this.envSource.VERCEL_SANDBOX_IMAGE ?? DEFAULT_IMAGE;
		// Specs pass a subset of the env; the zod default sets it in production.
		const mode = this.envSource.V2_SANDBOX_EGRESS_MODE ?? "strict";
		const org = this.envSource.CODE_STORAGE_ORG ?? null;
		const assetHost = this.envSource.R2_PUBLIC_BASE_URL
			? new URL(this.envSource.R2_PUBLIC_BASE_URL).hostname
			: null;
		if (
			mode === "strict" &&
			options.networkPolicy === undefined &&
			!options.env.ANTHROPIC_BASE_URL
		) {
			// A sandbox with no reachable proxy can never run a turn.
			throw new Error(
				"Sandbox env lacks ANTHROPIC_BASE_URL; the egress policy needs the proxy host",
			);
		}
		const built: ReturnType<typeof buildNetworkPolicy> = options.networkPolicy
			? { policy: options.networkPolicy, rejected: [] }
			: buildNetworkPolicy({
					assetHost,
					connectorHosts: [],
					gitHost: org ? `${org}.code.storage` : null,
					mode,
					// Layer 3: the project's approved hosts. `buildNetworkPolicy`
					// drops any that fail validation into `rejected`.
					projectHosts: options.networkAllowedHosts ?? [],
					proxyBaseUrl: options.env.ANTHROPIC_BASE_URL ?? "",
				});
		const vendorPolicy = toVendorNetworkPolicy(built.policy);
		const policyHash = hashNetworkPolicy(built.policy);
		// A new or stopped row boots for sure: report it before the vendor
		// call, so the progress card moves at once. A running row reports
		// only when the vendor created or resumed anyway (below).
		let wakeReported = false;
		const reportWake = async () => {
			if (!wakeReported) {
				wakeReported = true;
				await options.onWake?.();
			}
		};
		if (row.status !== "running") {
			await reportWake();
		}
		let created = false;
		let resumed = false;
		const sandbox = await this.sdk.getOrCreate({
			...credentials,
			env: options.env,
			image,
			keepLastSnapshots: { count: 1 },
			name: projectId,
			networkPolicy: vendorPolicy,
			persistent: true,
			// The builder-turn task passes `HARNESS_BRIDGE_PORT` to the
			// adapter as `port`; the create call only opens it.
			ports: [...new Set([HARNESS_BRIDGE_PORT, options.devPort, METRO_PORT])],
			region: "cdg1",
			resources: { vcpus: SANDBOX_VCPUS },
			resume: true,
			timeout: SANDBOX_TIMEOUT_MS,
			onCreate: async () => {
				created = true;
			},
			onResume: async () => {
				resumed = true;
			},
		});
		this.live.set(projectId, sandbox);
		const handle = new VercelSandboxHandle(projectId, sandbox, built.policy);
		// The row keeps the digest of the policy last pushed to the vendor. A
		// plain reuse with the same digest skips the update: one vendor round
		// trip less per warm turn. A resume always pushes, because the vendor
		// may keep the policy of the snapshot. The harness session composes
		// its policy from the vendor read-back and reads a missing one as
		// allow-all, so a read-back without a policy also gets the push.
		const policyApplied =
			created ||
			resumed ||
			row.networkPolicyHash !== policyHash ||
			sandbox.currentSession().networkPolicy === undefined;
		try {
			if (created) {
				await reportWake();
				// A live row means the vendor lost the sandbox — this is a rebuild.
				this.logLifecycle(
					context.hadLiveRow ? "rebuild" : "create",
					projectId,
					sandbox.name,
					context.hadLiveRow ? "warn" : "info",
				);
				await this.templateInit.apply(handle, {
					framework: options.framework,
					templateVersion: options.templateVersion,
				});
				await this.repoRestorer.restore(projectId, handle);
				await this.bootServices(sandbox, options);
			} else {
				if (policyApplied) {
					// A changed allow list reaches a live sandbox only through an
					// update call, and it needs no restart. It runs before
					// bootServices, or the dev command starts under the stored
					// policy.
					await sandbox.updateNetworkPolicy(vendorPolicy);
				}
				if (resumed) {
					await reportWake();
					this.logLifecycle("resume", projectId, sandbox.name);
					await this.bootServices(sandbox, options);
				}
			}
			this.logger[
				options.networkPolicy === undefined && mode === "open" ? "warn" : "info"
			](
				policyApplied
					? "sandbox.network-policy.applied"
					: "sandbox.network-policy.unchanged",
				{
					projectId,
					sandboxId: sandbox.name,
					mode: options.networkPolicy === undefined ? mode : "override",
					allowedHosts: String(built.policy.allowedHosts.length),
					rejected: built.rejected.join(","),
				},
			);
			if (policyApplied) {
				await this.sessions.markNetworkPolicyHash(row.id, policyHash);
			}
			// A plain reuse reports neither hook: the row already carries the
			// vendor fields, so writing again would only add log noise.
			if (created || resumed) {
				const marked = await this.sessions.markRunning(row.id, {
					expiresAt: sandbox.expiresAt ?? null,
					image,
					previewHost: this.previewHost(sandbox, options.devPort),
					providerSandboxId: sandbox.name,
				});
				if (!marked) {
					// The row left the live set between the read and this
					// write — a destroy or an error won; the new sandbox runs
					// untracked.
					this.logger.warn("sandbox.lifecycle.row-not-live", {
						projectId,
						sandboxId: sandbox.name,
					});
				}
			}
			return handle;
		} catch (error) {
			// After markError the row is not live, so destroy() skips this
			// sandbox and it bills until the vendor timeout. A fresh one holds
			// no user work and is deleted; a resumed one keeps its snapshot.
			await (created
				? sandbox.delete({ deleteOrphanSnapshots: true })
				: sandbox.stop()
			).catch((releaseFailure: unknown) => {
				this.logger.error("sandbox.lifecycle.release-failed", {
					error: errorMessage(releaseFailure),
					projectId,
					sandboxId: sandbox.name,
				});
			});
			this.live.delete(projectId);
			// The failure itself must reach the row; a failed mark only logs.
			await this.sessions
				.markError(row.id, errorMessage(error))
				.catch((markErrorFailure: unknown) => {
					this.logger.error("sandbox.lifecycle.mark-error-failed", {
						error: errorMessage(markErrorFailure),
						projectId,
						sandboxId: sandbox.name,
					});
				});
			throw error;
		}
	}

	/**
	 * The onResume steps: the dev server on its fixed port, the Playwright
	 * service when the image carries one, and the caller env on each command.
	 */
	private async bootServices(
		sandbox: VercelSandboxInstance,
		options: SandboxCreateOptions,
	): Promise<void> {
		// The dev server must bind 0.0.0.0 for the vendor route to reach it;
		// the preview host env is refreshed so a rebuilt sandbox serves its
		// new vendor host, not a stale one.
		const commandEnv = {
			...options.env,
			HOST: "0.0.0.0",
			WANDIT_PREVIEW_HOST: this.previewHost(sandbox, options.devPort),
		};
		await sandbox.runCommand({
			args: ["-c", options.devCommand],
			cmd: "bash",
			cwd: workspaceDirOf(sandbox),
			detached: true,
			env: commandEnv,
		});
		// WANDIT-180 fills PLAYWRIGHT_SERVICE with the launch command; the
		// image recipe installs the browser but leaves the variable unset.
		const probe = await sandbox.runCommand({
			args: ["PLAYWRIGHT_SERVICE"],
			cmd: "printenv",
			cwd: workspaceDirOf(sandbox),
			env: commandEnv,
		});
		if (probe.exitCode === 0) {
			const command = (await probe.stdout()).trim();
			if (command.length > 0) {
				await sandbox.runCommand({
					args: ["-c", command],
					cmd: "bash",
					cwd: workspaceDirOf(sandbox),
					detached: true,
					env: commandEnv,
				});
			}
		}
	}

	/** The public preview host of the dev port, from the vendor route. */
	private previewHost(sandbox: VercelSandboxInstance, devPort: number): string {
		return new URL(sandbox.domain(devPort)).host;
	}

	private async insertCreating(
		projectId: string,
		options: SandboxCreateOptions,
	): Promise<SandboxSessionRow> {
		try {
			return await this.sessions.insertCreating({
				organizationId: options.organizationId,
				projectId,
				provider: this.providerId,
				userId: options.ownerUserId,
			});
		} catch (error) {
			// The partial unique index rejects a concurrent create; the winner's
			// live row is the one to use. Any other failure has no row — rethrow.
			const concurrent = await this.sessions.findLiveByProjectId(projectId);
			if (!concurrent) {
				throw error;
			}
			return concurrent;
		}
	}

	private async findSandbox(
		projectId: string,
	): Promise<VercelSandboxInstance | null> {
		const cached = this.live.get(projectId);
		if (cached) {
			return cached;
		}
		try {
			return await this.sdk.get({
				...this.credentials(),
				name: projectId,
				resume: false,
			});
		} catch (error) {
			if (isSandboxNotFound(error)) {
				return null;
			}
			throw error;
		}
	}

	private logLifecycle(
		step: string,
		projectId: string,
		sandboxId: string,
		level: "info" | "warn" = "info",
	): void {
		this.logger[level](`sandbox.lifecycle.${step}`, {
			projectId,
			sandboxId,
		});
		Sentry.addBreadcrumb({
			category: "sandbox.lifecycle",
			data: { projectId, sandboxId },
			level: level === "warn" ? "warning" : "info",
			message: step,
		});
	}

	private credentials(): VercelCredentials {
		return {
			projectId: requireV2Env("VERCEL_PROJECT_ID", this.envSource),
			teamId: requireV2Env("VERCEL_TEAM_ID", this.envSource),
			token: requireV2Env("VERCEL_SANDBOX_TOKEN", this.envSource),
		};
	}
}

/**
 * SHA-256 hex digest of a policy, stored in `sandbox_sessions.networkPolicyHash`.
 * `buildNetworkPolicy` sorts the hosts, so the same allow list always hashes
 * the same; a different host order counts as a change and only costs one
 * extra vendor update.
 */
function hashNetworkPolicy(policy: SandboxNetworkPolicy): string {
	return createHash("sha256")
		.update(JSON.stringify([policy.allowedHosts, policy.deniedRanges]))
		.digest("hex");
}

/**
 * Translates our port policy into the vendor shape. `["*"]` allows every
 * host (open mode). An empty `allowedHosts` is a caller bug that `start`
 * and `setNetworkPolicy` reject.
 */
function toVendorNetworkPolicy(policy: SandboxNetworkPolicy): NetworkPolicy {
	// An empty list must fail closed: mapping it to `["*"]` opens every host.
	if (policy.allowedHosts.length === 0) {
		throw new Error("Sandbox egress: an empty allowedHosts is a caller bug");
	}
	return {
		allow: policy.allowedHosts,
		subnets:
			policy.deniedRanges.length > 0
				? { deny: policy.deniedRanges }
				: undefined,
	};
}

/**
 * Maps our policy into the harness session's `custom` policy. The session
 * manager recomposes the vendor policy from this access policy plus the
 * request transformations it already holds, so the proxy auth survives.
 * An empty allow list is the same caller bug `toVendorNetworkPolicy` rejects.
 */
function toHarnessNetworkPolicy(
	policy: SandboxNetworkPolicy,
): HarnessV1NetworkPolicy {
	if (policy.allowedHosts.length === 0) {
		throw new Error("Sandbox egress: an empty allowedHosts is a caller bug");
	}
	return {
		mode: "custom",
		allowedHosts: policy.allowedHosts,
		deniedCIDRs: policy.deniedRanges,
	};
}

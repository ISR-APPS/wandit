/**
 * Port: the sandbox that hosts one V2 app project.
 * The builder-turn task, the preview route, and the project-create flow
 * call it; WANDIT-164 implements it on Vercel Sandbox (D1).
 * Vendor packages stay out of this file — the harness session type comes
 * from `@ai-sdk/harness` only.
 */
import type { HarnessV1NetworkSandboxSession } from "@ai-sdk/harness";

/** Nest token for the `SandboxProvider` implementation. */
export const SANDBOX_PROVIDER = Symbol.for("app-builder.sandbox-provider");

/**
 * The relative `sandboxConfig.workDir` the builder-turn task passes to
 * `HarnessAgent`. The harness runs Claude Code in `<vendor cwd>/<workDir>`,
 * so the project root is `SandboxHandle.workspaceDir`, the same path. The
 * vendor cwd differs per image (`/vercel` on the node:22 image), so no
 * absolute path is hardcoded.
 */
export const HARNESS_WORK_DIR = "workspace";

/**
 * The port the claude-code bridge listens on. The builder-turn task
 * passes it to `createClaudeCode({ port })`; the provider opens it at
 * create.
 */
export const HARNESS_BRIDGE_PORT = 4000;

/**
 * The session the HarnessAgent attaches to. Alias of the network sandbox
 * session type that `HarnessV1SandboxProvider.createSession` returns in
 * `@ai-sdk/harness`.
 */
export type HarnessSandboxSession = HarnessV1NetworkSandboxSession;

/**
 * Hosts a sandbox may reach. `["*"]` means every host (open mode); an empty
 * `allowedHosts` is a caller bug that `start` and `setNetworkPolicy` reject.
 */
export type SandboxNetworkPolicy = {
	allowedHosts: string[];
	/** CIDR blocks the sandbox must not reach, for example "10.0.0.0/8". */
	deniedRanges: string[];
};

/** What a sandbox needs to boot a project. */
export type SandboxCreateOptions = {
	/** Template id, for example "web-app". Comes from the projects row. */
	framework: string;
	/** Template version, for example "web-app@1.0.0". Comes from the projects row. */
	templateVersion: string;
	/** The dev server command of the template, run on every resume. */
	devCommand: string;
	/** The fixed dev server port of the template. */
	devPort: number;
	/**
	 * Values for the sandbox process env. Only per-run tokens and public
	 * keys; never a platform secret.
	 */
	env: Record<string, string>;
	/**
	 * `user.id` of the project owner. The provider writes it on the
	 * `sandbox_sessions` row it creates; it reads no other table.
	 */
	ownerUserId: string;
	/**
	 * Org workspace of the project, or null for a personal project. Stored
	 * on the `sandbox_sessions` row.
	 */
	organizationId: string | null;
	/**
	 * Override for specs and tools. When absent the provider builds the
	 * default policy from the env and the sandbox env.
	 */
	networkPolicy?: SandboxNetworkPolicy;
};

/** How one `exec` runs inside the sandbox. */
export type SandboxExecOptions = {
	cwd?: string;
	env?: Record<string, string>;
	timeoutMs?: number;
	signal?: AbortSignal;
};

/** One finished `exec`. */
export type SandboxExecResult = {
	exitCode: number;
	stdout: string;
	stderr: string;
};

/** One file write; `content` is text or raw bytes. */
export type SandboxFile = { path: string; content: string | Uint8Array };

/** A live sandbox for one project. */
export interface SandboxHandle {
	readonly projectId: string;
	/**
	 * The project root inside the sandbox: `<vendor cwd>/HARNESS_WORK_DIR`.
	 * The template, git, and Claude Code all work in this folder.
	 */
	readonly workspaceDir: string;
	/** The vendor id of the sandbox. Logged with every lifecycle step. */
	readonly providerSandboxId: string;
	exec(
		command: string,
		args: string[],
		options?: SandboxExecOptions,
	): Promise<SandboxExecResult>;
	writeFiles(files: SandboxFile[]): Promise<void>;
	/** File contents, or null when the path does not exist. */
	readFile(path: string): Promise<Uint8Array | null>;
	listFiles(directory: string): Promise<string[]>;
	openPort(port: number): Promise<void>;
	/** The vendor URL of one port. Callers never build this URL themselves. */
	previewUrl(port: number): Promise<string>;
	/**
	 * Moves the vendor deadline back to a full timeout from now. The
	 * builder-turn task calls it every 60 s during a turn because the
	 * vendor timeout is absolute, not idle.
	 */
	keepAlive(): Promise<void>;
	/**
	 * Replaces the whole vendor network policy on the live sandbox — no
	 * restart. Round 2's `request_network_host` tool and the integration
	 * spec call it. A caller that runs during a harness session must first
	 * merge the current session policy (round 2 work).
	 */
	setNetworkPolicy(policy: SandboxNetworkPolicy): Promise<void>;
	/** The session the HarnessAgent attaches to. */
	harnessSession(): Promise<HarnessSandboxSession>;
}

/**
 * Lifecycle of the per-project sandbox. `getOrCreate` is idempotent:
 * a second call for a live project returns the same handle.
 */
export interface SandboxProvider {
	readonly providerId: "vercel" | "fake";
	getOrCreate(
		projectId: string,
		options: SandboxCreateOptions,
	): Promise<SandboxHandle>;
	/**
	 * Wake the project's existing sandbox. Throws when none exists.
	 * Takes the same options as `getOrCreate`: a resume re-runs the dev
	 * command with the caller's current env.
	 */
	resume(
		projectId: string,
		options: SandboxCreateOptions,
	): Promise<SandboxHandle>;
	stop(projectId: string): Promise<void>;
	destroy(projectId: string): Promise<void>;
	/**
	 * Not built before P6 (D13). Every implementation throws
	 * `SandboxForkNotSupportedError`.
	 */
	fork(projectId: string): Promise<SandboxHandle>;
}

/**
 * The narrow logger the sandbox lifecycle writes to. `Sentry.logger` and
 * the Trigger.dev `logger` both satisfy it; specs pass a fake.
 */
export type SandboxLogger = {
	error(message: string, fields: Record<string, string>): void;
	info(message: string, fields: Record<string, string>): void;
	warn(message: string, fields: Record<string, string>): void;
};

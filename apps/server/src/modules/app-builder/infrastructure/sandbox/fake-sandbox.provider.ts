/**
 * In-memory `SandboxProvider` for domain and application specs.
 * Specs build it directly — no network, no vendor SDK. `exec` answers
 * come from a scripted list the spec sets with `respondTo`.
 */
import { SandboxForkNotSupportedError } from "../../domain/errors/sandbox-fork-not-supported.error";
import type {
	HarnessSandboxSession,
	SandboxCreateOptions,
	SandboxExecOptions,
	SandboxExecResult,
	SandboxFile,
	SandboxHandle,
	SandboxNetworkPolicy,
	SandboxProvider,
} from "../../domain/ports/sandbox-provider";

/** One recorded call, on the provider or on a handle. */
export type FakeSandboxCall = {
	/** Method that ran, for example "exec" or "getOrCreate". */
	method: string;
	/** Short context, for example the exec command line or a file path. */
	detail?: string;
};

type FakeProjectState = {
	handle: FakeSandboxHandle;
	stopped: boolean;
};

/** The project root every fake handle reports; the node:22 image's real one. */
export const FAKE_WORKSPACE_DIR = "/vercel/workspace";

class FakeSandboxHandle implements SandboxHandle {
	readonly providerSandboxId: string;
	readonly workspaceDir = FAKE_WORKSPACE_DIR;

	constructor(
		readonly projectId: string,
		private readonly provider: FakeSandboxProvider,
		private readonly files: Map<string, Uint8Array>,
	) {
		this.providerSandboxId = `fake-${projectId}`;
	}

	async exec(
		command: string,
		args: string[],
		_options?: SandboxExecOptions,
	): Promise<SandboxExecResult> {
		const commandLine = [command, ...args].join(" ");
		this.provider.calls.push({ detail: commandLine, method: "exec" });
		const queue = this.provider.scriptedExec.get(command) ?? [];
		const result = queue.shift();
		if (result === undefined) {
			throw new Error(
				`FakeSandboxProvider: no scripted exec result for "${command}"`,
			);
		}
		return result;
	}

	async writeFiles(files: SandboxFile[]): Promise<void> {
		this.provider.calls.push({
			detail: `${files.length} files`,
			method: "writeFiles",
		});
		for (const file of files) {
			const bytes =
				typeof file.content === "string"
					? new TextEncoder().encode(file.content)
					: file.content;
			this.files.set(file.path, bytes);
		}
	}

	async readFile(path: string): Promise<Uint8Array | null> {
		this.provider.calls.push({ detail: path, method: "readFile" });
		return this.files.get(path) ?? null;
	}

	async listFiles(directory: string): Promise<string[]> {
		this.provider.calls.push({ detail: directory, method: "listFiles" });
		const prefix = directory.endsWith("/") ? directory : `${directory}/`;
		return [...this.files.keys()].filter((path) => path.startsWith(prefix));
	}

	async openPort(port: number): Promise<void> {
		this.provider.calls.push({ detail: String(port), method: "openPort" });
	}

	async previewUrl(port: number): Promise<string> {
		this.provider.calls.push({ detail: String(port), method: "previewUrl" });
		return `https://fake-sandbox.local/${this.projectId}/${port}`;
	}

	async keepAlive(): Promise<void> {
		this.provider.keepAliveCalls += 1;
	}

	async setNetworkPolicy(policy: SandboxNetworkPolicy): Promise<void> {
		this.provider.calls.push({ method: "setNetworkPolicy" });
		this.provider.networkPolicies.push(policy);
	}

	async allowHost(host: string): Promise<void> {
		this.provider.calls.push({ detail: host, method: "allowHost" });
		this.provider.allowedHosts.push(host);
	}

	harnessSession(): Promise<HarnessSandboxSession> {
		// The fake never attaches a real harness; the harness fake never
		// calls this.
		return Promise.reject(
			new Error("FakeSandboxProvider has no harness session"),
		);
	}
}

/**
 * `SandboxProvider` fake. `getOrCreate` is idempotent per project like the
 * real contract; `destroy` forgets everything about the project.
 */
export class FakeSandboxProvider implements SandboxProvider {
	readonly providerId = "fake";
	readonly calls: FakeSandboxCall[] = [];
	/** Sandboxes actually created — a repeated `getOrCreate` adds none. */
	createdCount = 0;
	/** `handle.keepAlive()` calls across every project handle. */
	keepAliveCalls = 0;
	/** Every policy `handle.setNetworkPolicy` received, across all handles. */
	readonly networkPolicies: SandboxNetworkPolicy[] = [];
	/** Every host `handle.allowHost` received, across all handles, in order. */
	readonly allowedHosts: string[] = [];
	readonly scriptedExec = new Map<string, SandboxExecResult[]>();
	private readonly projects = new Map<string, FakeProjectState>();

	/** Queue one `exec` answer for the given command. */
	respondTo(command: string, result: SandboxExecResult): void {
		const queue = this.scriptedExec.get(command) ?? [];
		queue.push(result);
		this.scriptedExec.set(command, queue);
	}

	async getOrCreate(
		projectId: string,
		_options: SandboxCreateOptions,
	): Promise<SandboxHandle> {
		this.calls.push({ detail: projectId, method: "getOrCreate" });
		const existing = this.projects.get(projectId);
		if (existing) {
			existing.stopped = false;
			return existing.handle;
		}
		const files = new Map<string, Uint8Array>();
		const handle = new FakeSandboxHandle(projectId, this, files);
		this.projects.set(projectId, { handle, stopped: false });
		this.createdCount += 1;
		return handle;
	}

	async resume(
		projectId: string,
		_options: SandboxCreateOptions,
	): Promise<SandboxHandle> {
		this.calls.push({ detail: projectId, method: "resume" });
		const state = this.projects.get(projectId);
		if (!state) {
			throw new Error(`FakeSandboxProvider: no sandbox for ${projectId}`);
		}
		state.stopped = false;
		return state.handle;
	}

	async stop(projectId: string): Promise<void> {
		this.calls.push({ detail: projectId, method: "stop" });
		const state = this.projects.get(projectId);
		if (state) {
			state.stopped = true;
		}
	}

	async destroy(projectId: string): Promise<void> {
		this.calls.push({ detail: projectId, method: "destroy" });
		this.projects.delete(projectId);
	}

	fork(projectId: string): Promise<SandboxHandle> {
		this.calls.push({ detail: projectId, method: "fork" });
		return Promise.reject(new SandboxForkNotSupportedError());
	}
}

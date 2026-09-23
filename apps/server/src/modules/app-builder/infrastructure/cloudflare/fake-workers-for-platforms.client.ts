/**
 * In-memory `WorkersForPlatformsApi` for the specs of the delete runtime,
 * the orphan sweep, and the publish task (WANDIT-178). No network. It
 * keeps the scripts in a map, records every call, and enforces the same
 * ownership rule as `WorkersForPlatformsClient`.
 */
import {
	type AssetManifest,
	type AssetUploadSession,
	appWorkerTags,
	type WorkerDeployInput,
} from "@wandit/contracts";

import type { AssetFile } from "./asset-manifest";
import {
	type AppWorkerScope,
	type AppWorkerScript,
	isAppWorkerOf,
	type WorkersForPlatformsApi,
	WorkersForPlatformsError,
} from "./workers-for-platforms.client";

/** Session jwt the fake answers; a publish spec can check that `uploadAssets` gets it back. */
export const FAKE_SESSION_JWT = "fake-session-jwt";
/** Completion jwt the fake answers; a publish spec can check that `deployScript` gets it. */
export const FAKE_COMPLETION_JWT = "fake-completion-jwt";

/** One script the fake holds. */
export type FakeAppWorker = {
	/** Tags from `appWorkerTags`, or the tags a spec seeded. */
	tags: string[];
	/** `fake-etag-<n>` after a deploy, `fake-etag-seed` for a seeded script. */
	etag: string;
	/** ISO 8601 creation time. */
	createdOn: string;
	/** The last deploy input; null for a seeded script. */
	input: WorkerDeployInput | null;
};

/** One recorded call. */
export type FakeWorkersForPlatformsCall = {
	/** Name of the public method that ran. */
	method: keyof WorkersForPlatformsApi;
	/** Script of the scope; null for the calls without a scope. */
	scriptName: string | null;
};

const FAKE_CREATED_ON = "2026-01-01T00:00:00.000Z";

/** The in-memory client; specs build it directly and read `scripts` and `calls`. */
export class FakeWorkersForPlatformsClient implements WorkersForPlatformsApi {
	/** Deployed or seeded scripts, by script name. */
	readonly scripts = new Map<string, FakeAppWorker>();
	/** Every call in order, a failed one included. */
	readonly calls: FakeWorkersForPlatformsCall[] = [];
	private readonly failures = new Map<keyof WorkersForPlatformsApi, Error>();
	private deploys = 0;

	/** Makes the next call of `method` throw `error`, like a network failure. */
	failNext(method: keyof WorkersForPlatformsApi, error: Error): void {
		this.failures.set(method, error);
	}

	/** Puts a script into the namespace without a deploy, for sweep specs. */
	seed(scriptName: string, tags: string[], createdOn = FAKE_CREATED_ON): void {
		this.scripts.set(scriptName, {
			createdOn,
			etag: "fake-etag-seed",
			input: null,
			tags,
		});
	}

	/** Answers every distinct manifest hash in one bucket; an empty manifest gives no bucket. */
	async createAssetUploadSession(
		scope: AppWorkerScope,
		manifest: AssetManifest,
	): Promise<AssetUploadSession> {
		this.begin("createAssetUploadSession", scope);
		const hashes = [
			...new Set(Object.values(manifest).map((entry) => entry.hash)),
		];
		return {
			buckets: hashes.length === 0 ? [] : [hashes],
			jwt: FAKE_SESSION_JWT,
		};
	}

	/** Throws for a bucket hash that `byHash` does not hold, like the real client. */
	async uploadAssets(
		session: AssetUploadSession,
		byHash: Map<string, AssetFile>,
	): Promise<string> {
		this.begin("uploadAssets", null);
		const missing = session.buckets.flat().find((hash) => !byHash.has(hash));
		if (missing !== undefined) {
			throw new WorkersForPlatformsError(
				`the upload session asks for hash ${missing}, which the caller does not hold`,
				null,
				null,
				[],
			);
		}
		return FAKE_COMPLETION_JWT;
	}

	/** Stores the script with the real tag rule and a new etag. */
	async deployScript(
		scope: AppWorkerScope,
		input: WorkerDeployInput,
	): Promise<{ scriptName: string; etag: string }> {
		this.begin("deployScript", scope);
		if (
			!input.modules.some(
				(workerModule) => workerModule.path === input.mainModule,
			)
		) {
			throw new WorkersForPlatformsError(
				`main module ${input.mainModule} is not one of the modules`,
				null,
				null,
				[],
			);
		}
		this.deploys += 1;
		const etag = `fake-etag-${this.deploys}`;
		this.scripts.set(scope.scriptName, {
			createdOn:
				this.scripts.get(scope.scriptName)?.createdOn ?? FAKE_CREATED_ON,
			etag,
			input,
			tags: appWorkerTags(scope.projectId, input.workspaceId),
		});
		return { etag, scriptName: scope.scriptName };
	}

	/** Answers the held scripts; `tag` keeps the scripts that carry that exact tag. */
	async listScripts(tag?: string): Promise<AppWorkerScript[]> {
		this.begin("listScripts", null);
		return [...this.scripts]
			.filter(([, script]) => tag === undefined || script.tags.includes(tag))
			.map(([scriptName, script]) => ({
				createdOn: script.createdOn,
				scriptName,
				tags: script.tags,
			}));
	}

	/** Answers "missing" when the fake holds no such script. */
	async deleteScript(scope: AppWorkerScope): Promise<"deleted" | "missing"> {
		this.begin("deleteScript", scope);
		return this.scripts.delete(scope.scriptName) ? "deleted" : "missing";
	}

	// Records the call, checks ownership like the real client, then throws
	// an armed failure.
	private begin(
		method: keyof WorkersForPlatformsApi,
		scope: AppWorkerScope | null,
	): void {
		this.calls.push({ method, scriptName: scope?.scriptName ?? null });
		if (scope !== null && !isAppWorkerOf(scope.projectId, scope.scriptName)) {
			throw new WorkersForPlatformsError(
				`script ${scope.scriptName} does not belong to project ${scope.projectId}`,
				null,
				null,
				[],
			);
		}
		const failure = this.failures.get(method);
		if (failure !== undefined) {
			this.failures.delete(method);
			throw failure;
		}
	}
}

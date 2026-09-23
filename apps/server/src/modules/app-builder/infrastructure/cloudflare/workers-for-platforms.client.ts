/**
 * Typed client for the Workers for Platforms (W4P) REST API (WANDIT-200).
 * The Nest provider in `app-builder.module.ts`, the `delete-app-project` and
 * `w4p-orphan-sweep` runtimes, and the publish task (WANDIT-178) compose it
 * with `workersForPlatformsClientFromEnv`. It calls the Cloudflare API over
 * `fetch` and checks `ownsScript` before every project call.
 */
/*
 * Cloudflare facts, verified 2026-09-23 in the OpenAPI file
 * https://raw.githubusercontent.com/cloudflare/api-schemas/main/openapi.json
 * (operations `namespace-worker-*`, `worker-assets-upload`) and in the docs
 * https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/static-assets/
 * and https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/:
 * - POST .../dispatch/namespaces/{ns}/scripts/{script}/assets-upload-session:
 *   JSON `{ manifest }` in, `{ jwt, buckets }` out. The jwt lives one hour.
 * - POST .../workers/assets/upload?base64=true: the session jwt is the bearer,
 *   one base64 part per hash. 202 per bucket, 201 with the completion jwt.
 * - PUT .../dispatch/namespaces/{ns}/scripts/{script}: multipart `metadata`
 *   (bindings, tags, limits, `assets.jwt`) plus one part per module.
 * - GET .../dispatch/namespaces/{ns}/scripts?tags=<tag>:yes: no page parameters.
 * - DELETE .../dispatch/namespaces/{ns}/scripts/{script}?force=true: 404 with
 *   code 10007 ("Resource not found") when the script is missing.
 * The namespace API has no versions endpoints.
 * LIMIT: no version list and no version pruning; each PUT replaces the one
 * script of a project, so no old version stays. Upgrade: add listVersions,
 * deleteVersion, and pruneVersions when the namespace API exposes versions.
 */
import {
	type AssetManifest,
	type AssetUploadSession,
	appWorkerName,
	appWorkerTags,
	assetUploadResultSchema,
	assetUploadSessionResultSchema,
	type CloudflareApiError,
	cloudflareEnvelopeSchema,
	cloudflareErrorBodySchema,
	namespaceScriptSchema,
	type WorkerDeployInput,
	workerScriptUploadResultSchema,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";
import { z } from "zod";

import { contentTypeFor } from "../../../../infrastructure/storage/r2";
import type { SandboxLogger } from "../../domain/ports/sandbox-provider";
import type { V2EnvSource } from "../env/v2-env";
import type { AssetFile } from "./asset-manifest";

/**
 * Nest token of the client for the API process. The module factory
 * answers null when one of the three Cloudflare env values is unset.
 */
export const WORKERS_FOR_PLATFORMS_CLIENT = Symbol.for(
	"app-builder.workers-for-platforms-client",
);

const CLOUDFLARE_API_BASE_URL = "https://api.cloudflare.com/client/v4";
// At most 5 fetch attempts per call: one try plus four retries.
const MAX_ATTEMPTS = 5;
// One JSON round trip gets 30 s, like the Supabase client.
const REQUEST_TIMEOUT_MS = 30_000;
// A multipart call carries up to 50 MiB, so it gets more time.
const UPLOAD_TIMEOUT_MS = 120_000;
// One 429 never stalls a call for more than 60 s.
const MAX_RETRY_AFTER_MS = 60_000;
// The API body limit is 100 MB on the Free and Pro plans. Half of it
// leaves room for the multipart framing and bounds the memory. One asset
// is at most 25 MiB, so at most 34 MiB in base64: one file always fits.
const MAX_UPLOAD_REQUEST_BYTES = 50 * 1024 * 1024;
// Cloudflare code 10007, "Resource not found" in the OpenAPI error list. A
// 404 with another code is a failure, not a finished delete. UNVERIFIED:
// the code of a missing namespace; the live checklist of WANDIT-200 checks it.
const SCRIPT_NOT_FOUND_CODE = 10007;

const namespaceScriptListSchema = z.array(namespaceScriptSchema);

/**
 * One failed W4P call. The message never carries the token, a jwt, or a
 * binding value.
 */
export class WorkersForPlatformsError extends Error {
	constructor(
		message: string,
		/** HTTP status, or null for a network failure or a call the client refused. */
		readonly status: number | null,
		/** The `cf-ray` response header, when present. */
		readonly requestId: string | null,
		/** The `errors` of the Cloudflare answer; empty when the body has none. */
		readonly errors: CloudflareApiError[],
	) {
		super(message);
		this.name = "WorkersForPlatformsError";
	}
}

/** The scope of a call on the user Worker of one project. */
export type AppWorkerScope = {
	/** `projects.id` of the wandit project the call runs for. */
	projectId: string;
	/** Script name in the namespace; always `appWorkerName(projectId)`. */
	scriptName: string;
};

/** One script of the namespace, as `listScripts` answers it. */
export type AppWorkerScript = {
	/** Script name, for example `app-<projectId>`. */
	scriptName: string;
	/** Tags of the script; empty when Cloudflare answers null. */
	tags: string[];
	/** Creation time, ISO 8601 text from Cloudflare. */
	createdOn: string;
};

/** Dependencies of `WorkersForPlatformsClient`; `workersForPlatformsClientFromEnv` composes them. */
export type WorkersForPlatformsClientDeps = {
	/** Cloudflare account id. From `CLOUDFLARE_ACCOUNT_ID`. */
	accountId: string;
	/** Dispatch namespace name. From `CLOUDFLARE_W4P_NAMESPACE`. */
	namespace: string;
	/** Bearer token with "Workers Scripts: Edit". From `CLOUDFLARE_V2_DEPLOY_TOKEN`. Never logged. */
	token: string;
	/** `globalThis.fetch` in production; the spec passes a scripted fake. */
	fetch: typeof globalThis.fetch;
	/** `Sentry.logger` in production; the spec passes a recording fake. */
	logger: SandboxLogger;
	/** A `setTimeout` sleep in production; the spec records and resolves. */
	sleep: (ms: number) => Promise<void>;
	/** Answers whether `scriptName` is the Worker of `projectId`. Backs the check before each project call. */
	ownsScript: (projectId: string, scriptName: string) => boolean;
};

/**
 * The only `ownsScript` in production: a project may touch only its own
 * Worker, `appWorkerName(projectId)`.
 */
export function isAppWorkerOf(projectId: string, scriptName: string): boolean {
	return scriptName === appWorkerName(projectId);
}

/** One API call that `request` sends. */
type RequestPlan<T> = {
	/** HTTP method of the call. */
	method: "GET" | "POST" | "PUT" | "DELETE";
	/** Path under the base URL, with the query. Also names the call in errors and logs. */
	path: string;
	/** The deploy token, or the session jwt of the asset upload. Never logged. */
	bearer: string;
	/** JSON body of the session call. At most one of `json` and `form` is set. */
	json?: { manifest: AssetManifest };
	/** Multipart body. Fetch sets the content type with the boundary. */
	form?: FormData;
	/** Schema of `result` in the envelope. It decides whether a null result is valid. */
	schema: z.ZodType<T>;
	/** Fetch timeout in milliseconds. */
	timeoutMs: number;
};

/** The files of one asset upload request. */
type UploadPart = {
	/** Manifest hash; also the multipart field name. */
	hash: string;
	/** The file with that hash. */
	file: AssetFile;
};

/**
 * The W4P client. It carries no Nest decorators: the Trigger worker
 * composes it by hand, like the Supabase client.
 */
export class WorkersForPlatformsClient {
	constructor(private readonly deps: WorkersForPlatformsClientDeps) {}

	/** Sends the manifest and answers the jwt plus the buckets Cloudflare still needs. */
	async createAssetUploadSession(
		scope: AppWorkerScope,
		manifest: AssetManifest,
	): Promise<AssetUploadSession> {
		this.requireOwnedScript(scope);
		return this.request({
			method: "POST",
			path: `${this.scriptPath(scope.scriptName)}/assets-upload-session`,
			bearer: this.deps.token,
			json: { manifest },
			schema: assetUploadSessionResultSchema,
			timeoutMs: REQUEST_TIMEOUT_MS,
		});
	}

	/**
	 * Uploads the files the session asks for, bucket by bucket, and answers
	 * the completion jwt. Throws before any fetch when a bucket names a hash
	 * that `byHash` does not hold.
	 */
	async uploadAssets(
		session: AssetUploadSession,
		byHash: Map<string, AssetFile>,
	): Promise<string> {
		const requests = uploadRequests(session.buckets, byHash);
		// No bucket means Cloudflare has every file: the session jwt is
		// already the completion token.
		if (requests.length === 0) {
			return session.jwt;
		}
		let completionJwt: string | undefined;
		for (const parts of requests) {
			const form = new FormData();
			for (const { file, hash } of parts) {
				// The part type becomes the Content-Type of the asset answer.
				form.append(
					hash,
					new Blob([Buffer.from(file.content).toString("base64")], {
						type: contentTypeFor(file.path),
					}),
					hash,
				);
			}
			const result = await this.request({
				method: "POST",
				path: `/accounts/${encodeURIComponent(this.deps.accountId)}/workers/assets/upload?base64=true`,
				bearer: session.jwt,
				form,
				schema: assetUploadResultSchema,
				timeoutMs: UPLOAD_TIMEOUT_MS,
			});
			completionJwt = result.jwt ?? completionJwt;
		}
		if (completionJwt === undefined) {
			throw new WorkersForPlatformsError(
				"cloudflare asset upload ended without a completion jwt",
				null,
				null,
				[],
			);
		}
		return completionJwt;
	}

	/**
	 * Uploads the Worker code with its bindings, tags, limits, and assets.
	 * The upload replaces the live script at once. Answers the script name
	 * and the content hash (`etag`); the namespace API has no version id.
	 */
	async deployScript(
		scope: AppWorkerScope,
		input: WorkerDeployInput,
	): Promise<{ scriptName: string; etag: string }> {
		this.requireOwnedScript(scope);
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
		const metadata = {
			main_module: input.mainModule,
			compatibility_date: input.compatibilityDate,
			compatibility_flags: input.compatibilityFlags,
			bindings: input.bindings,
			tags: appWorkerTags(scope.projectId, input.workspaceId),
			// The API names differ from the camelCase `AppWorkerLimits` fields.
			limits: {
				cpu_ms: input.limits.cpuMs,
				subrequests: input.limits.subRequests,
			},
			assets: { jwt: input.assetsJwt },
		};
		const form = new FormData();
		form.append(
			"metadata",
			new Blob([JSON.stringify(metadata)], { type: "application/json" }),
		);
		for (const workerModule of input.modules) {
			form.append(
				workerModule.path,
				new Blob([workerModule.content], { type: workerModule.type }),
				workerModule.path,
			);
		}
		const script = await this.request({
			method: "PUT",
			path: this.scriptPath(scope.scriptName),
			bearer: this.deps.token,
			form,
			schema: workerScriptUploadResultSchema,
			timeoutMs: UPLOAD_TIMEOUT_MS,
		});
		return { etag: script.etag, scriptName: script.id };
	}

	// LIMIT: one list call answers every script of the namespace; the API
	// has no page parameters. Upgrade: page when the API adds page
	// parameters, or list one tag shard per call.
	/** Lists the scripts of the namespace; `tag` keeps only the scripts that carry that exact tag. */
	async listScripts(tag?: string): Promise<AppWorkerScript[]> {
		const query =
			tag === undefined ? "" : `?tags=${encodeURIComponent(`${tag}:yes`)}`;
		const scripts = await this.request({
			method: "GET",
			path: `${this.namespacePath()}/scripts${query}`,
			bearer: this.deps.token,
			schema: namespaceScriptListSchema,
			timeoutMs: REQUEST_TIMEOUT_MS,
		});
		return scripts.map((item) => ({
			createdOn: item.created_on,
			scriptName: item.script.id,
			tags: item.script.tags ?? [],
		}));
	}

	/** Deletes the Worker of one project. Answers "missing" on a 404 with the script-not-found code. */
	async deleteScript(scope: AppWorkerScope): Promise<"deleted" | "missing"> {
		this.requireOwnedScript(scope);
		try {
			await this.request({
				method: "DELETE",
				// force also removes the bindings that would block the delete.
				path: `${this.scriptPath(scope.scriptName)}?force=true`,
				bearer: this.deps.token,
				schema: z.null(),
				timeoutMs: REQUEST_TIMEOUT_MS,
			});
			return "deleted";
		} catch (error) {
			// A missing script is the goal of a delete, not a failure.
			if (
				error instanceof WorkersForPlatformsError &&
				error.status === 404 &&
				error.errors.some((entry) => entry.code === SCRIPT_NOT_FOUND_CODE)
			) {
				return "missing";
			}
			throw error;
		}
	}

	// Security check before each project call: a caller may touch only the
	// Worker of the project it names.
	private requireOwnedScript(scope: AppWorkerScope): void {
		if (!this.deps.ownsScript(scope.projectId, scope.scriptName)) {
			throw new WorkersForPlatformsError(
				`script ${scope.scriptName} does not belong to project ${scope.projectId}`,
				null,
				null,
				[],
			);
		}
	}

	private namespacePath(): string {
		return `/accounts/${encodeURIComponent(this.deps.accountId)}/workers/dispatch/namespaces/${encodeURIComponent(this.deps.namespace)}`;
	}

	private scriptPath(scriptName: string): string {
		return `${this.namespacePath()}/scripts/${encodeURIComponent(scriptName)}`;
	}

	/**
	 * One API call with at most MAX_ATTEMPTS fetches. A 429 waits
	 * `Retry-After`; a 5xx or a thrown fetch backs off 1 s, 2 s, 4 s, 8 s.
	 * Another 4xx throws at once.
	 */
	private async request<T>(plan: RequestPlan<T>): Promise<T> {
		const url = `${CLOUDFLARE_API_BASE_URL}${plan.path}`;
		for (let attempt = 1; ; attempt += 1) {
			let response: Response;
			try {
				response = await this.deps.fetch(url, {
					method: plan.method,
					headers: {
						accept: "application/json",
						authorization: `Bearer ${plan.bearer}`,
						...(plan.json === undefined
							? {}
							: { "content-type": "application/json" }),
					},
					body:
						plan.form ??
						(plan.json === undefined ? undefined : JSON.stringify(plan.json)),
					signal: AbortSignal.timeout(plan.timeoutMs),
				});
			} catch (error) {
				// A network failure or a timeout retries like a 5xx.
				if (attempt === MAX_ATTEMPTS) {
					throw new WorkersForPlatformsError(
						`cloudflare ${plan.method} ${plan.path} failed: ${getErrorMessage(error)}`,
						null,
						null,
						[],
					);
				}
				this.logRetry(null, attempt, plan.path);
				await this.deps.sleep(retryBackoffMs(attempt));
				continue;
			}
			if (response.ok) {
				return this.parseResult(response, plan);
			}
			// A 429 and a 5xx are retryable; another 4xx is a final answer.
			const retryable = response.status === 429 || response.status >= 500;
			if (!retryable || attempt === MAX_ATTEMPTS) {
				throw new WorkersForPlatformsError(
					`cloudflare ${plan.method} ${plan.path} answered ${response.status}`,
					response.status,
					response.headers.get("cf-ray"),
					await readErrors(response),
				);
			}
			this.logRetry(response.status, attempt, plan.path);
			// An unread body holds the socket until garbage collection.
			await response.body?.cancel();
			await this.deps.sleep(
				response.status === 429
					? (retryAfterMs(response) ?? retryBackoffMs(attempt))
					: retryBackoffMs(attempt),
			);
		}
	}

	private async parseResult<T>(
		response: Response,
		plan: RequestPlan<T>,
	): Promise<T> {
		const requestId = response.headers.get("cf-ray");
		const text = await response.text();
		// The OpenAPI file says the delete answers 200 with no body. An empty
		// body counts as a null result; the check below decides if it is valid.
		if (text !== "") {
			let body: unknown;
			try {
				body = JSON.parse(text);
			} catch {
				// A non-JSON body fails the envelope schema below.
				body = null;
			}
			const parsed = cloudflareEnvelopeSchema(plan.schema).safeParse(body);
			if (!parsed.success) {
				throw new WorkersForPlatformsError(
					`cloudflare ${plan.method} ${plan.path} returned an unexpected body`,
					response.status,
					requestId,
					[],
				);
			}
			if (!parsed.data.success) {
				throw new WorkersForPlatformsError(
					`cloudflare ${plan.method} ${plan.path} answered success: false`,
					response.status,
					requestId,
					parsed.data.errors,
				);
			}
			if (parsed.data.result !== null) {
				return parsed.data.result;
			}
		}
		// A null result is valid only when the plan schema accepts null (the delete).
		const nullResult = plan.schema.safeParse(null);
		if (!nullResult.success) {
			throw new WorkersForPlatformsError(
				`cloudflare ${plan.method} ${plan.path} answered no result`,
				response.status,
				requestId,
				[],
			);
		}
		return nullResult.data;
	}

	private logRetry(status: number | null, attempt: number, path: string): void {
		this.deps.logger.warn("w4p.retry", {
			attempt: String(attempt),
			path,
			status: String(status),
		});
	}
}

/**
 * The surface the runtimes and the publish task depend on.
 * `FakeWorkersForPlatformsClient` implements it for the specs.
 */
export type WorkersForPlatformsApi = Pick<
	WorkersForPlatformsClient,
	| "createAssetUploadSession"
	| "uploadAssets"
	| "deployScript"
	| "listScripts"
	| "deleteScript"
>;

/**
 * Composes the client from the env values, or answers null when
 * `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_W4P_NAMESPACE`, or
 * `CLOUDFLARE_V2_DEPLOY_TOKEN` is unset. The Nest factory and the Trigger runtimes call it.
 */
export function workersForPlatformsClientFromEnv(
	source: V2EnvSource,
	logger: SandboxLogger,
): WorkersForPlatformsClient | null {
	const accountId = source.CLOUDFLARE_ACCOUNT_ID;
	const namespace = source.CLOUDFLARE_W4P_NAMESPACE;
	const token = source.CLOUDFLARE_V2_DEPLOY_TOKEN;
	if (
		accountId === undefined ||
		namespace === undefined ||
		token === undefined
	) {
		return null;
	}
	return new WorkersForPlatformsClient({
		accountId,
		fetch: globalThis.fetch,
		logger,
		namespace,
		ownsScript: isAppWorkerOf,
		sleep: (ms) =>
			new Promise((resolvePromise) => setTimeout(resolvePromise, ms)),
		token,
	});
}

// Groups the files of each bucket into upload requests. A bucket goes out
// as one request, as the docs say. Only a bucket whose base64 total passes
// MAX_UPLOAD_REQUEST_BYTES splits, because the API refuses a larger body.
// Every hash is checked here, before the first fetch.
function uploadRequests(
	buckets: string[][],
	byHash: Map<string, AssetFile>,
): UploadPart[][] {
	const requests: UploadPart[][] = [];
	for (const bucket of buckets) {
		let current: UploadPart[] = [];
		let currentBytes = 0;
		for (const hash of bucket) {
			const file = byHash.get(hash);
			if (file === undefined) {
				throw new WorkersForPlatformsError(
					`the upload session asks for hash ${hash}, which the caller does not hold`,
					null,
					null,
					[],
				);
			}
			// Base64 writes 4 characters for each 3 bytes.
			const base64Bytes = Math.ceil(file.content.byteLength / 3) * 4;
			if (
				current.length > 0 &&
				currentBytes + base64Bytes > MAX_UPLOAD_REQUEST_BYTES
			) {
				requests.push(current);
				current = [];
				currentBytes = 0;
			}
			current.push({ file, hash });
			currentBytes += base64Bytes;
		}
		if (current.length > 0) {
			requests.push(current);
		}
	}
	return requests;
}

// The error list of a non-2xx answer. A body that is not the Cloudflare
// envelope (for example an HTML 502 page) carries no errors.
async function readErrors(response: Response): Promise<CloudflareApiError[]> {
	try {
		const parsed = cloudflareErrorBodySchema.safeParse(await response.json());
		return parsed.success ? parsed.data.errors : [];
	} catch {
		// A non-JSON body: the status and the cf-ray still identify the failure.
		return [];
	}
}

// Cloudflare sends `Retry-After` in seconds. Null when absent or not a
// number; the caller then uses the backoff.
function retryAfterMs(response: Response): number | null {
	const seconds = Number.parseInt(
		response.headers.get("retry-after") ?? "",
		10,
	);
	if (Number.isNaN(seconds) || seconds < 0) {
		return null;
	}
	return Math.min(seconds * 1_000, MAX_RETRY_AFTER_MS);
}

// The backoff after a 5xx or a thrown fetch: 1 s, 2 s, 4 s, 8 s.
function retryBackoffMs(attempt: number): number {
	return 1_000 * 2 ** (attempt - 1);
}

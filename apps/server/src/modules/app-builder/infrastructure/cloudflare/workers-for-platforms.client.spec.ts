import type { CloudflareApiError, WorkerDeployInput } from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { SandboxLogger } from "../../domain/ports/sandbox-provider";
import {
	jsonResponse,
	type RecordedRequest,
	scriptedFetch,
} from "../supabase/fake-supabase-fetch";
import { assetManifest } from "./asset-manifest";
import {
	isAppWorkerOf,
	WorkersForPlatformsClient,
	WorkersForPlatformsError,
	workersForPlatformsClientFromEnv,
} from "./workers-for-platforms.client";

const ACCOUNT_ID = "acc_1";
const NAMESPACE = "production";
const TOKEN = "cf_deploy_token_do_not_log";
const SECRET = "sb_secret_value_do_not_log";
const PROJECT_ID = "2b8e1d7c-4f7a-4a51-9f4e-0f7d6c1b2a3e";
const SCRIPT = `app-${PROJECT_ID}`;
const SCOPE = { projectId: PROJECT_ID, scriptName: SCRIPT };
const WORKERS_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers`;
const SCRIPTS_URL = `${WORKERS_URL}/dispatch/namespaces/${NAMESPACE}/scripts`;
const SCRIPT_URL = `${SCRIPTS_URL}/${SCRIPT}`;
const UPLOAD_URL = `${WORKERS_URL}/assets/upload?base64=true`;

const bytes = (text: string) => new TextEncoder().encode(text);

// A Cloudflare success envelope around `result`.
function ok<T extends object | null>(
	result: T,
	status = 200,
	headers?: Record<string, string>,
): Response {
	return jsonResponse(
		status,
		JSON.stringify({ errors: [], messages: [], result, success: true }),
		headers,
	);
}

// A Cloudflare failure envelope with `errors`.
function failure(
	status: number,
	errors: CloudflareApiError[],
	headers?: Record<string, string>,
): Response {
	return jsonResponse(
		status,
		JSON.stringify({ errors, messages: [], result: null, success: false }),
		headers,
	);
}

function makeClient(
	answers: (Response | Error)[],
	ownsScript: (
		projectId: string,
		scriptName: string,
	) => boolean = isAppWorkerOf,
) {
	const requests: RecordedRequest[] = [];
	const sleeps: number[] = [];
	const logLines: string[] = [];
	const record = (message: string, fields: Record<string, string>) => {
		logLines.push(`${message} ${JSON.stringify(fields)}`);
	};
	const logger: SandboxLogger = { error: record, info: record, warn: record };
	const client = new WorkersForPlatformsClient({
		accountId: ACCOUNT_ID,
		fetch: scriptedFetch(answers, requests),
		logger,
		namespace: NAMESPACE,
		ownsScript,
		sleep: (ms) => {
			sleeps.push(ms);
			return Promise.resolve();
		},
		token: TOKEN,
	});
	return { client, logLines, requests, sleeps };
}

// Reads one multipart part the client appended as a Blob.
function formPart(request: RecordedRequest | undefined, name: string): File {
	const part = request?.form?.get(name);
	if (!(part instanceof File)) {
		throw new Error(`the request has no file part "${name}"`);
	}
	return part;
}

// Awaits a call that must fail and answers its WorkersForPlatformsError.
async function rejection<T extends object>(
	call: Promise<T>,
): Promise<WorkersForPlatformsError> {
	const outcome = await call.then(
		() => null,
		(caught: unknown) => caught,
	);
	if (!(outcome instanceof WorkersForPlatformsError)) {
		throw new Error("expected a WorkersForPlatformsError");
	}
	return outcome;
}

function deployInput(
	overrides: Partial<WorkerDeployInput> = {},
): WorkerDeployInput {
	return {
		assetsJwt: "completion-jwt",
		bindings: [
			{
				name: "PUBLIC_SITE_URL",
				text: "https://acme.wandit.app",
				type: "plain_text",
			},
			{ name: "SUPABASE_SECRET_KEY", text: SECRET, type: "secret_text" },
			{ name: "ASSETS", type: "assets" },
		],
		compatibilityDate: "2025-10-11",
		compatibilityFlags: ["nodejs_compat"],
		limits: { cpuMs: 100, subRequests: 50 },
		mainModule: "index.js",
		modules: [
			{
				content: bytes("export default { fetch: () => new Response('ok') };"),
				path: "index.js",
				type: "application/javascript+module",
			},
			{
				content: bytes("{}"),
				path: "index.js.map",
				type: "application/source-map",
			},
		],
		workspaceId: "org_1",
		...overrides,
	};
}

describe("WorkersForPlatformsClient.createAssetUploadSession", () => {
	it("sends the manifest with the deploy token and answers the buckets", async () => {
		const { manifest } = assetManifest(PROJECT_ID, [
			{ content: bytes("<h1>hi</h1>"), path: "/index.html" },
		]);
		const hash = manifest["/index.html"]?.hash ?? "";
		const { client, requests } = makeClient([
			ok({ buckets: [[hash]], jwt: "session-jwt" }),
		]);

		const session = await client.createAssetUploadSession(SCOPE, manifest);

		expect(session).toEqual({ buckets: [[hash]], jwt: "session-jwt" });
		expect(requests[0]?.url).toBe(`${SCRIPT_URL}/assets-upload-session`);
		expect(requests[0]?.method).toBe("POST");
		expect(requests[0]?.headers.authorization).toBe(`Bearer ${TOKEN}`);
		expect(requests[0]?.headers["content-type"]).toBe("application/json");
		expect(JSON.parse(requests[0]?.body ?? "")).toEqual({ manifest });
	});
});

describe("WorkersForPlatformsClient.uploadAssets", () => {
	const files = [
		{ content: bytes("body { color: red }"), path: "/app.css" },
		{ content: bytes("console.log(1)"), path: "/app.js" },
		{ content: bytes("not asked for"), path: "/logo.txt" },
	];
	const { byHash, manifest } = assetManifest(PROJECT_ID, files);
	const cssHash = manifest["/app.css"]?.hash ?? "";
	const jsHash = manifest["/app.js"]?.hash ?? "";
	const txtHash = manifest["/logo.txt"]?.hash ?? "";

	it("sends each bucket with the session jwt and only the asked hashes", async () => {
		const { client, requests } = makeClient([
			ok({}, 202),
			ok({ jwt: "completion-jwt" }, 201),
		]);

		const jwt = await client.uploadAssets(
			{ buckets: [[cssHash], [jsHash]], jwt: "session-jwt" },
			byHash,
		);

		expect(jwt).toBe("completion-jwt");
		expect(requests.map((request) => request.url)).toEqual([
			UPLOAD_URL,
			UPLOAD_URL,
		]);
		expect(requests[0]?.headers.authorization).toBe("Bearer session-jwt");
		expect([...(requests[0]?.form?.keys() ?? [])]).toEqual([cssHash]);
		expect([...(requests[1]?.form?.keys() ?? [])]).toEqual([jsHash]);
		expect(
			requests.some((request) => request.form?.has(txtHash) === true),
		).toBe(false);
		const cssPart = formPart(requests[0], cssHash);
		expect(cssPart.type).toBe("text/css; charset=utf-8");
		expect(await cssPart.text()).toBe(
			Buffer.from("body { color: red }").toString("base64"),
		);
	});

	it("sends the files of one bucket in one request", async () => {
		const { client, requests } = makeClient([
			ok({ jwt: "completion-jwt" }, 201),
		]);

		await client.uploadAssets(
			{ buckets: [[cssHash, jsHash]], jwt: "session-jwt" },
			byHash,
		);

		expect(requests).toHaveLength(1);
		expect([...(requests[0]?.form?.keys() ?? [])]).toEqual([cssHash, jsHash]);
	});

	it("answers the session jwt and sends nothing when no bucket remains", async () => {
		const { client, requests } = makeClient([]);

		const jwt = await client.uploadAssets(
			{ buckets: [], jwt: "already-complete-jwt" },
			byHash,
		);

		expect(jwt).toBe("already-complete-jwt");
		expect(requests).toEqual([]);
	});

	it("refuses a hash it does not hold before the first request", async () => {
		const { client, requests } = makeClient([ok({}, 202)]);

		await expect(
			client.uploadAssets(
				{ buckets: [[cssHash], ["f".repeat(32)]], jwt: "session-jwt" },
				byHash,
			),
		).rejects.toBeInstanceOf(WorkersForPlatformsError);
		expect(requests).toEqual([]);
	});

	it("throws when the last answer carries no completion jwt", async () => {
		const { client } = makeClient([ok({}, 202)]);

		await expect(
			client.uploadAssets({ buckets: [[cssHash]], jwt: "session-jwt" }, byHash),
		).rejects.toThrow("without a completion jwt");
	});

	it("splits a bucket whose base64 total passes 50 MiB", async () => {
		const big = assetManifest(PROJECT_ID, [
			{ content: new Uint8Array(20 * 1024 * 1024), path: "/a.bin" },
			{ content: new Uint8Array(20 * 1024 * 1024).fill(1), path: "/b.bin" },
		]);
		const aHash = big.manifest["/a.bin"]?.hash ?? "";
		const bHash = big.manifest["/b.bin"]?.hash ?? "";
		const { client, requests } = makeClient([
			ok({}, 202),
			ok({ jwt: "completion-jwt" }, 201),
		]);

		await client.uploadAssets(
			{ buckets: [[aHash, bHash]], jwt: "session-jwt" },
			big.byHash,
		);

		expect(
			requests.map((request) => [...(request.form?.keys() ?? [])]),
		).toEqual([[aHash], [bHash]]);
	});
});

describe("WorkersForPlatformsClient.deployScript", () => {
	it("sends the metadata part and one part per module", async () => {
		const { client, requests } = makeClient([
			ok({
				etag: "etag-1",
				id: SCRIPT,
				startup_time_ms: 10,
				tags: [`project:${PROJECT_ID}`, "customer:org_1"],
			}),
		]);

		const result = await client.deployScript(SCOPE, deployInput());

		expect(result).toEqual({ etag: "etag-1", scriptName: SCRIPT });
		expect(requests[0]?.method).toBe("PUT");
		expect(requests[0]?.url).toBe(SCRIPT_URL);
		expect(requests[0]?.headers.authorization).toBe(`Bearer ${TOKEN}`);
		const metadata = formPart(requests[0], "metadata");
		expect(metadata.type).toBe("application/json");
		expect(JSON.parse(await metadata.text())).toEqual({
			assets: { jwt: "completion-jwt" },
			bindings: [
				{
					name: "PUBLIC_SITE_URL",
					text: "https://acme.wandit.app",
					type: "plain_text",
				},
				{ name: "SUPABASE_SECRET_KEY", text: SECRET, type: "secret_text" },
				{ name: "ASSETS", type: "assets" },
			],
			compatibility_date: "2025-10-11",
			compatibility_flags: ["nodejs_compat"],
			limits: { cpu_ms: 100, subrequests: 50 },
			main_module: "index.js",
			tags: [`project:${PROJECT_ID}`, "customer:org_1"],
		});
		const entry = formPart(requests[0], "index.js");
		expect(entry.name).toBe("index.js");
		expect(entry.type).toBe("application/javascript+module");
		expect(await entry.text()).toContain("new Response('ok')");
		expect(formPart(requests[0], "index.js.map").type).toBe(
			"application/source-map",
		);
	});

	it("keeps the secret value in the request body only", async () => {
		const retried = makeClient([
			failure(503, [{ code: 10013, message: "service unavailable" }]),
			ok({ etag: "etag-2", id: SCRIPT, startup_time_ms: 10, tags: null }),
		]);
		await retried.client.deployScript(SCOPE, deployInput());
		const failed = makeClient([
			failure(400, [{ code: 10021, message: "script failed validation" }]),
		]);
		const error = await rejection(
			failed.client.deployScript(SCOPE, deployInput()),
		);

		expect(await formPart(retried.requests[1], "metadata").text()).toContain(
			SECRET,
		);
		expect(retried.logLines).toHaveLength(1);
		expect(retried.logLines.join("\n")).not.toContain(SECRET);
		expect(error.message).not.toContain(SECRET);
		expect(JSON.stringify(error)).not.toContain(SECRET);
	});

	it("refuses a main module that is not one of the modules, before any fetch", async () => {
		const { client, requests } = makeClient([]);

		await expect(
			client.deployScript(SCOPE, deployInput({ mainModule: "server.js" })),
		).rejects.toThrow("main module server.js");
		expect(requests).toEqual([]);
	});
});

describe("WorkersForPlatformsClient ownership", () => {
	it("refuses a script of another project before any fetch", async () => {
		const { client, requests } = makeClient([], () => false);
		const { manifest } = assetManifest(PROJECT_ID, []);

		await expect(
			client.createAssetUploadSession(SCOPE, manifest),
		).rejects.toThrow("does not belong to project");
		await expect(client.deployScript(SCOPE, deployInput())).rejects.toThrow(
			"does not belong to project",
		);
		await expect(client.deleteScript(SCOPE)).rejects.toThrow(
			"does not belong to project",
		);
		expect(requests).toEqual([]);
	});

	it("ties a project only to its app Worker name", () => {
		expect(isAppWorkerOf(PROJECT_ID, SCRIPT)).toBe(true);
		expect(isAppWorkerOf(PROJECT_ID, "app-another-project")).toBe(false);
	});
});

describe("WorkersForPlatformsClient retries", () => {
	it("waits Retry-After on a 429 and retries", async () => {
		const { client, requests, sleeps } = makeClient([
			failure(429, [{ code: 971, message: "rate limited" }], {
				"retry-after": "3",
			}),
			ok([]),
		]);

		await expect(client.listScripts()).resolves.toEqual([]);
		expect(requests).toHaveLength(2);
		expect(sleeps).toEqual([3_000]);
	});

	it("caps a long Retry-After at 60 s", async () => {
		const { client, sleeps } = makeClient([
			failure(429, [], { "retry-after": "120" }),
			ok([]),
		]);

		await client.listScripts();

		expect(sleeps).toEqual([60_000]);
	});

	it("backs off on a 429 without Retry-After", async () => {
		const { client, sleeps } = makeClient([failure(429, []), ok([])]);

		await client.listScripts();

		expect(sleeps).toEqual([1_000]);
	});

	it("backs off 1, 2, 4, 8 s on a 5xx and stops after 5 attempts", async () => {
		const unavailable = () => failure(503, []);
		const { client, logLines, requests, sleeps } = makeClient([
			unavailable(),
			unavailable(),
			unavailable(),
			unavailable(),
			unavailable(),
		]);

		await expect(client.listScripts()).rejects.toMatchObject({
			status: 503,
		});
		expect(requests).toHaveLength(5);
		expect(sleeps).toEqual([1_000, 2_000, 4_000, 8_000]);
		expect(logLines).toHaveLength(4);
		expect(logLines.join("\n")).not.toContain(TOKEN);
	});

	it("retries a thrown fetch like a 5xx", async () => {
		const { client, sleeps } = makeClient([
			new Error("socket hang up"),
			ok([]),
		]);

		await expect(client.listScripts()).resolves.toEqual([]);
		expect(sleeps).toEqual([1_000]);
	});

	it("does not retry a 403 and keeps the ray id and the errors", async () => {
		const errors = [{ code: 10000, message: "Authentication error" }];
		const { client, requests, sleeps } = makeClient([
			failure(403, errors, { "cf-ray": "8c1a2b3c4d5e6f70-FRA" }),
		]);

		const error = await rejection(client.listScripts());

		expect(error).toMatchObject({
			errors,
			requestId: "8c1a2b3c4d5e6f70-FRA",
			status: 403,
		});
		expect(error.message).not.toContain(TOKEN);
		expect(requests).toHaveLength(1);
		expect(sleeps).toEqual([]);
	});
});

describe("WorkersForPlatformsClient answer parsing", () => {
	it("throws the errors of a 200 with success: false", async () => {
		const errors = [{ code: 10007, message: "script not found" }];
		const { client } = makeClient([failure(200, errors)]);

		await expect(client.listScripts()).rejects.toMatchObject({
			errors,
			status: 200,
		});
	});

	it("throws on a body that is not the envelope", async () => {
		const { client } = makeClient([jsonResponse(200, "<html>oops</html>")]);

		await expect(client.listScripts()).rejects.toThrow(
			"returned an unexpected body",
		);
	});

	it("throws on a null result where the call needs one", async () => {
		const { client } = makeClient([ok(null)]);

		await expect(client.listScripts()).rejects.toThrow("answered no result");
	});

	it("throws on an empty body where the call needs a result", async () => {
		const { client } = makeClient([new Response(null, { status: 200 })]);

		await expect(client.listScripts()).rejects.toThrow("answered no result");
	});
});

describe("WorkersForPlatformsClient.deleteScript", () => {
	it("deletes with force and answers deleted", async () => {
		const { client, requests } = makeClient([ok(null)]);

		await expect(client.deleteScript(SCOPE)).resolves.toBe("deleted");
		expect(requests[0]?.method).toBe("DELETE");
		expect(requests[0]?.url).toBe(`${SCRIPT_URL}?force=true`);
	});

	it("answers deleted on a 200 with no body", async () => {
		const { client } = makeClient([new Response(null, { status: 200 })]);

		await expect(client.deleteScript(SCOPE)).resolves.toBe("deleted");
	});

	it("throws on a 404 with another code than script not found", async () => {
		const { client } = makeClient([
			failure(404, [{ code: 10092, message: "dispatch namespace not found" }]),
		]);

		await expect(client.deleteScript(SCOPE)).rejects.toMatchObject({
			status: 404,
		});
	});

	it("answers missing on a 404", async () => {
		const { client, sleeps } = makeClient([
			failure(404, [{ code: 10007, message: "script not found" }]),
		]);

		await expect(client.deleteScript(SCOPE)).resolves.toBe("missing");
		expect(sleeps).toEqual([]);
	});
});

describe("WorkersForPlatformsClient.listScripts", () => {
	it("filters by one tag and maps null tags to an empty list", async () => {
		const { client, requests } = makeClient([
			ok([
				{
					created_on: "2026-09-20T10:00:00Z",
					dispatch_namespace: NAMESPACE,
					modified_on: "2026-09-21T10:00:00Z",
					script: { id: SCRIPT, tags: null },
				},
			]),
		]);

		const scripts = await client.listScripts(`project:${PROJECT_ID}`);

		expect(requests[0]?.url).toBe(
			`${SCRIPTS_URL}?tags=project%3A${PROJECT_ID}%3Ayes`,
		);
		expect(scripts).toEqual([
			{ createdOn: "2026-09-20T10:00:00Z", scriptName: SCRIPT, tags: [] },
		]);
	});

	it("sends no query without a tag", async () => {
		const { client, requests } = makeClient([ok([])]);

		await client.listScripts();

		expect(requests[0]?.url).toBe(SCRIPTS_URL);
	});
});

describe("workersForPlatformsClientFromEnv", () => {
	const logger: SandboxLogger = {
		error: () => undefined,
		info: () => undefined,
		warn: () => undefined,
	};
	const complete = {
		CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
		CLOUDFLARE_V2_DEPLOY_TOKEN: TOKEN,
		CLOUDFLARE_W4P_NAMESPACE: NAMESPACE,
		V2_HARNESS: "claude-code",
	} as const;

	it.each([
		"CLOUDFLARE_ACCOUNT_ID",
		"CLOUDFLARE_V2_DEPLOY_TOKEN",
		"CLOUDFLARE_W4P_NAMESPACE",
	] as const)("answers null without %s", (name) => {
		expect(
			workersForPlatformsClientFromEnv(
				{ ...complete, [name]: undefined },
				logger,
			),
		).toBeNull();
	});

	it("answers a client when the three values are set", () => {
		expect(workersForPlatformsClientFromEnv(complete, logger)).toBeInstanceOf(
			WorkersForPlatformsClient,
		);
	});
});

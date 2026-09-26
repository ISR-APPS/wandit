import { generateKeyPairSync } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { importSPKI, jwtVerify } from "jose";
import { afterEach, describe, expect, it } from "vitest";

import type { V2EnvSource } from "../env/v2-env";
import { CodeStorageGitStore, GitStoreError } from "./code-storage.git-store";

const { privateKey, publicKey } = generateKeyPairSync("ec", {
	namedCurve: "P-256",
});
const privateKeyPem = privateKey
	.export({ format: "pem", type: "pkcs8" })
	.toString();
const publicKeyPem = publicKey
	.export({ format: "pem", type: "spki" })
	.toString();

const ENV: V2EnvSource = {
	V2_HARNESS: "claude-code",
	CODE_STORAGE_ORG: "wandit",
	CODE_STORAGE_PRIVATE_KEY: privateKeyPem,
};

type RecordedRequest = {
	method: string;
	path: string;
	authorization: string | null;
	body: string;
};

type Answer = {
	status: number;
	body: Record<string, string | number>;
	/** Raw `Retry-After` header value the answer carries, when set. */
	retryAfter?: string;
};

let server: Server;
let baseUrl: string;
let requests: RecordedRequest[];
let answers: Answer[];
// Milliseconds the store waited between retries, in call order.
let sleeps: number[];

async function startServer(): Promise<void> {
	requests = [];
	answers = [];
	sleeps = [];
	server = createServer((request, response) => {
		const chunks: Buffer[] = [];
		request.on("data", (chunk: Buffer) => chunks.push(chunk));
		request.on("end", () => {
			requests.push({
				method: request.method ?? "",
				path: request.url ?? "",
				authorization: request.headers.authorization ?? null,
				body: Buffer.concat(chunks).toString("utf8"),
			});
			const answer = answers.shift() ?? {
				status: 200,
				body: { message: "ok" },
			};
			const headers: Record<string, string> = {
				"content-type": "application/problem+json",
			};
			if (answer.retryAfter !== undefined) {
				headers["retry-after"] = answer.retryAfter;
			}
			response.writeHead(answer.status, headers);
			response.end(JSON.stringify(answer.body));
		});
	});
	await new Promise<void>((resolve) => {
		server.listen(0, "127.0.0.1", () => resolve());
	});
	const address = server.address();
	// SAFETY: listen() on a bound server always returns an AddressInfo here.
	const port = (address as AddressInfo).port;
	baseUrl = `http://127.0.0.1:${port}/api/v1`;
}

function makeStore(): CodeStorageGitStore {
	return new CodeStorageGitStore(ENV, {
		apiBaseUrl: baseUrl,
		sleep: (ms) => {
			sleeps.push(ms);
			return Promise.resolve();
		},
	});
}

async function tokenClaims(authorization: string | null) {
	expect(authorization).toMatch(/^Bearer /);
	// SAFETY: the regex above proves the Bearer prefix exists.
	const token = (authorization ?? "").slice("Bearer ".length);
	const key = await importSPKI(publicKeyPem, "ES256");
	const { payload } = await jwtVerify(token, key);
	return payload;
}

afterEach(async () => {
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("CodeStorageGitStore.ensureRepository", () => {
	it("posts /api/v1/repos with a repo:write JWT and returns the plain remote URL", async () => {
		await startServer();
		answers.push({ status: 201, body: { message: "created", repo_id: "r1" } });
		const store = makeStore();

		const result = await store.ensureRepository("project-1");

		expect(result).toEqual({
			remoteUrl: "https://wandit.code.storage/wandit/project-1.git",
		});
		expect(requests).toHaveLength(1);
		expect(requests[0]?.method).toBe("POST");
		expect(requests[0]?.path).toBe("/api/v1/repos");
		expect(JSON.parse(requests[0]?.body ?? "{}")).toEqual({
			default_branch: "main",
		});
		const claims = await tokenClaims(requests[0]?.authorization ?? null);
		expect(claims.iss).toBe("wandit");
		expect(claims.sub).toBe("wandit-api");
		expect(claims.repo).toBe("wandit/project-1");
		expect(claims.scopes).toEqual(["repo:write"]);
	});

	it("treats a 409 as an already-created repository", async () => {
		await startServer();
		answers.push({
			status: 409,
			body: { detail: "repository wandit/project-1 already exists" },
		});
		const store = makeStore();

		await expect(store.ensureRepository("project-1")).resolves.toEqual({
			remoteUrl: "https://wandit.code.storage/wandit/project-1.git",
		});
	});

	it("treats a 4xx 'already exists' detail as an existing repository", async () => {
		await startServer();
		answers.push({
			status: 422,
			body: { detail: "repository wandit/project-1 already exists" },
		});
		const store = makeStore();

		await expect(store.ensureRepository("project-1")).resolves.toEqual({
			remoteUrl: "https://wandit.code.storage/wandit/project-1.git",
		});
	});

	it("never treats a 5xx 'already exists' detail as success", async () => {
		await startServer();
		for (let i = 0; i < 4; i += 1) {
			answers.push({
				status: 500,
				body: { detail: "repository already exists in index" },
			});
		}
		const store = makeStore();

		const failure = await store
			.ensureRepository("project-1")
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(GitStoreError);
		// SAFETY: toBeInstanceOf above proves the type.
		expect((failure as GitStoreError).status).toBe(500);
		expect(requests).toHaveLength(4);
	});
});

describe("CodeStorageGitStore.issueCredential", () => {
	it("mints a git:read+git:write JWT without an API call", async () => {
		await startServer();
		const store = makeStore();

		const credential = await store.issueCredential("project-1", 600);

		expect(requests).toHaveLength(0);
		expect(credential.username).toBe("t");
		expect(credential.remoteUrl).toBe(
			"https://wandit.code.storage/wandit/project-1.git",
		);
		expect(credential.expiresAt.getTime()).toBeGreaterThan(Date.now());
		const key = await importSPKI(publicKeyPem, "ES256");
		const { payload } = await jwtVerify(credential.password, key);
		expect(payload.repo).toBe("wandit/project-1");
		expect(payload.scopes).toEqual(["git:read", "git:write"]);
		expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(600);
	});

	it("mints a git:read JWT only for read access", async () => {
		await startServer();
		const store = makeStore();

		const credential = await store.issueCredential("project-1", 600, "read");

		expect(requests).toHaveLength(0);
		const key = await importSPKI(publicKeyPem, "ES256");
		const { payload } = await jwtVerify(credential.password, key);
		expect(payload.repo).toBe("wandit/project-1");
		expect(payload.scopes).toEqual(["git:read"]);
	});
});

describe("CodeStorageGitStore.deleteRepository", () => {
	it("deletes the repository named by the JWT through the fixed delete path", async () => {
		await startServer();
		answers.push({ status: 200, body: { message: "deleted" } });
		const store = makeStore();

		await store.deleteRepository("project-1");

		expect(requests).toHaveLength(1);
		expect(requests[0]?.method).toBe("DELETE");
		expect(requests[0]?.path).toBe("/api/v1/repos/delete");
	});

	it("accepts 404 and 409 as done", async () => {
		await startServer();
		const store = makeStore();

		answers.push({ status: 404, body: { detail: "not found" } });
		await expect(store.deleteRepository("p-1")).resolves.toBeUndefined();
		answers.push({ status: 409, body: { detail: "already deleted" } });
		await expect(store.deleteRepository("p-1")).resolves.toBeUndefined();
	});
});

describe("CodeStorageGitStore retries", () => {
	it("retries a 429 once and then succeeds", async () => {
		await startServer();
		answers.push({ status: 429, body: { detail: "rate limited" } });
		answers.push({ status: 201, body: { message: "created" } });
		const store = makeStore();

		await expect(store.ensureRepository("project-1")).resolves.toEqual({
			remoteUrl: "https://wandit.code.storage/wandit/project-1.git",
		});
		expect(requests).toHaveLength(2);
	});

	it("waits the Retry-After seconds on a 429", async () => {
		await startServer();
		answers.push({
			status: 429,
			retryAfter: "2",
			body: { detail: "rate limited" },
		});
		answers.push({ status: 201, body: { message: "created" } });
		const store = makeStore();

		await store.ensureRepository("project-1");

		expect(sleeps).toEqual([2_000]);
	});

	it("caps a long Retry-After at 60 s", async () => {
		await startServer();
		answers.push({
			status: 429,
			retryAfter: "300",
			body: { detail: "rate limited" },
		});
		answers.push({ status: 201, body: { message: "created" } });
		const store = makeStore();

		await store.ensureRepository("project-1");

		expect(sleeps).toEqual([60_000]);
	});

	it("falls back to the backoff delay when a 429 carries no Retry-After", async () => {
		await startServer();
		answers.push({ status: 429, body: { detail: "rate limited" } });
		answers.push({ status: 201, body: { message: "created" } });
		const store = makeStore();

		await store.ensureRepository("project-1");

		expect(sleeps).toEqual([1_000]);
	});

	it("backs off 1 s, 2 s, 4 s on repeated 5xx answers", async () => {
		await startServer();
		for (let i = 0; i < 4; i += 1) {
			answers.push({ status: 502, body: { detail: "bad gateway" } });
		}
		const store = makeStore();

		const failure = await store
			.ensureRepository("project-1")
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(GitStoreError);
		expect(sleeps).toEqual([1_000, 2_000, 4_000]);
		expect(requests).toHaveLength(4);
	});

	it("throws a GitStoreError with the problem detail after 4 attempts", async () => {
		await startServer();
		for (let i = 0; i < 4; i += 1) {
			answers.push({ status: 500, body: { detail: "backend down" } });
		}
		const store = makeStore();

		const failure = await store
			.ensureRepository("project-1")
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(GitStoreError);
		// SAFETY: toBeInstanceOf above proves the type.
		const storeError = failure as GitStoreError;
		expect(storeError.status).toBe(500);
		expect(storeError.detail).toBe("backend down");
		expect(requests).toHaveLength(4);
	});

	it("surfaces a 400 without retrying", async () => {
		await startServer();
		answers.push({ status: 400, body: { detail: "bad repo name" } });
		const store = makeStore();

		const failure = await store
			.ensureRepository("bad name")
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(GitStoreError);
		// SAFETY: toBeInstanceOf above proves the type.
		const storeError = failure as GitStoreError;
		expect(storeError.status).toBe(400);
		expect(storeError.detail).toBe("bad repo name");
		expect(requests).toHaveLength(1);
	});
});

describe("CodeStorageGitStore token hygiene", () => {
	it("never puts the JWT in a request body, path, or thrown error", async () => {
		await startServer();
		answers.push({ status: 400, body: { detail: "rejected" } });
		const store = makeStore();

		const failure = await store
			.ensureRepository("project-1")
			.catch((error: unknown) => error);

		expect(failure).toBeInstanceOf(GitStoreError);
		const key = await importSPKI(publicKeyPem, "ES256");
		// SAFETY: the regex proves the Bearer prefix exists.
		const sentToken = (requests[0]?.authorization ?? "").slice(7);
		await expect(jwtVerify(sentToken, key)).resolves.toBeDefined();
		for (const request of requests) {
			expect(request.body).not.toContain(sentToken);
			expect(request.path).not.toContain(sentToken);
		}
		expect(JSON.stringify(failure)).not.toContain(sentToken);
		// SAFETY: toBeInstanceOf above proves the type.
		expect((failure as GitStoreError).message).not.toContain(sentToken);
	});
});

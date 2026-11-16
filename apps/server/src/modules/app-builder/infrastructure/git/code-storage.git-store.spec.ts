import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { importSPKI, jwtVerify } from "jose";
import { afterEach, describe, expect, it } from "vitest";

import { GitFileTooLargeError } from "../../domain/errors/git-file-too-large.error";
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
	/** A record goes out as problem JSON; bytes go out as they are. */
	body: Record<string, string | number> | Uint8Array;
	/** Raw `Retry-After` header value the answer carries, when set. */
	retryAfter?: string;
	/**
	 * Sends `sentBytes` body bytes and never ends the body. With
	 * `declaredBytes`, the answer carries that Content-Length; else it is chunked.
	 */
	holdOpen?: { declaredBytes?: number; sentBytes: number };
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
			const answer: Answer = answers.shift() ?? {
				status: 200,
				body: { message: "ok" },
			};
			const headers: Record<string, string> = {
				"content-type":
					answer.body instanceof Uint8Array
						? "application/octet-stream"
						: "application/problem+json",
			};
			if (answer.retryAfter !== undefined) {
				headers["retry-after"] = answer.retryAfter;
			}
			if (answer.holdOpen !== undefined) {
				if (answer.holdOpen.declaredBytes !== undefined) {
					headers["content-length"] = String(answer.holdOpen.declaredBytes);
				}
				response.writeHead(answer.status, headers);
				response.write(Buffer.alloc(answer.holdOpen.sentBytes, "x"));
				return;
			}
			response.writeHead(answer.status, headers);
			response.end(
				answer.body instanceof Uint8Array
					? answer.body
					: JSON.stringify(answer.body),
			);
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

// A `git archive` tar.gz of a repository with a folder, a symlink, and a
// long path. The path does not fit the ustar fields, so git writes a pax header.
async function gitArchive(longPath: string): Promise<Uint8Array> {
	const repo = await mkdtemp(join(tmpdir(), "code-storage-archive-"));
	const git = (...args: string[]) =>
		execFileSync("git", ["-C", repo, ...args], { stdio: "pipe" });
	try {
		git("init", "-q");
		await writeFile(join(repo, "package.json"), "{}");
		await mkdir(join(repo, "src"));
		await writeFile(join(repo, "src/app.tsx"), "app");
		await writeFile(join(repo, longPath), "long");
		await symlink("app.tsx", join(repo, "src/link.tsx"));
		git("add", "-A");
		git(
			"-c",
			"user.name=spec",
			"-c",
			"user.email=spec@example.com",
			"-c",
			"commit.gpgsign=false",
			"commit",
			"-q",
			"-m",
			"init",
		);
		return git("archive", "--format=tar.gz", "HEAD");
	} finally {
		await rm(repo, { force: true, recursive: true });
	}
}

// One ustar entry: a 512-byte header, then the content padded to 512 bytes.
// The reader does not check the checksum, so the header leaves it empty.
// `sizeField` replaces the octal size text, to write a bad header.
function tarEntry(path: string, content: string, sizeField?: string): Buffer {
	const header = Buffer.alloc(512);
	header.write(path, 0, "utf8");
	header.write("0000644", 100, "utf8");
	header.write(sizeField ?? Buffer.byteLength(content).toString(8), 124);
	header.write("0", 156, "utf8");
	header.write("ustar\u000000", 257, "utf8");
	const body = Buffer.alloc(Math.ceil(Buffer.byteLength(content) / 512) * 512);
	body.write(content, 0, "utf8");
	return Buffer.concat([header, body]);
}

// A tar.gz of `entries`, closed by the two zero blocks of the format.
function tarGzOf(...entries: Buffer[]): Uint8Array {
	return gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)]));
}

afterEach(async () => {
	// A held answer keeps its connection open; close it so the server stops.
	server.closeAllConnections();
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
	it("mints a push-main JWT with the main-only refs claim, without an API call", async () => {
		await startServer();
		const store = makeStore();

		const credential = await store.issueCredential(
			"project-1",
			600,
			"push-main",
		);

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
		// WANDIT-282: a stolen push token cannot force-push, push another
		// branch, or push a tag. code.storage enforces the first match.
		expect(payload.refs).toEqual([
			["refs/heads/main", ["no-force-push"]],
			["*", ["no-push"]],
		]);
		expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(600);
	});

	it("mints a push-github-mirror JWT that can push github/main and nothing else", async () => {
		await startServer();
		const store = makeStore();

		const credential = await store.issueCredential(
			"project-1",
			600,
			"push-github-mirror",
		);

		const key = await importSPKI(publicKeyPem, "ES256");
		const { payload } = await jwtVerify(credential.password, key);
		expect(payload.scopes).toEqual(["git:read", "git:write"]);
		// Security: the worker mirror token must never move `main`.
		expect(payload.refs).toEqual([
			["refs/heads/github/main", []],
			["*", ["no-push"]],
		]);
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
		expect(payload.refs).toBeUndefined();
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

describe("CodeStorageGitStore.readFile", () => {
	// The theme GET reads a stopped project with it: a token that can push would be a leak.
	it("reads a file at a ref with a git:read JWT, and answers null on a 404", async () => {
		await startServer();
		answers.push(
			{ status: 200, body: { version: 1 } },
			{ status: 404, body: { detail: "not found" } },
		);
		const store = makeStore();
		const sha = "a".repeat(40);

		const bytes = await store.readFile(
			"project-1",
			sha,
			"src/styles/theme.json",
		);
		const missing = await store.readFile("project-1", sha, "src/missing.json");

		expect(new TextDecoder().decode(bytes ?? new Uint8Array())).toBe(
			'{"version":1}',
		);
		expect(missing).toBeNull();
		expect(requests[0]?.method).toBe("GET");
		expect(requests[0]?.path).toBe(
			`/api/v1/repos/file?path=src%2Fstyles%2Ftheme.json&ref=${sha}`,
		);
		const claims = await tokenClaims(requests[0]?.authorization ?? null);
		expect(claims.repo).toBe("wandit/project-1");
		expect(claims.scopes).toEqual(["git:read"]);
		expect(claims.refs).toBeUndefined();
	});
});

describe("CodeStorageGitStore Code view reads", () => {
	it("lists only the blob paths at a ref, and answers null on a 404", async () => {
		await startServer();
		answers.push(
			{
				status: 200,
				body: Buffer.from(
					JSON.stringify({
						entries: [
							{ path: "src", type: "tree", mode: "040000" },
							{ path: "src/app.tsx", type: "blob", mode: "100644" },
							{ path: "src/link.tsx", type: "symlink", mode: "120000" },
							{ path: "vendor/lib", type: "submodule", mode: "160000" },
						],
						has_more: false,
						ref: "main",
					}),
				),
			},
			{ status: 404, body: { detail: "not found" } },
		);
		const store = makeStore();
		const sha = "a".repeat(40);

		const paths = await store.listFilePaths("project-1", sha, 5000);
		const missing = await store.listFilePaths("project-1", sha, 5000);

		expect(paths).toEqual(["src/app.tsx"]);
		expect(missing).toBeNull();
		expect(requests[0]?.path).toBe(`/api/v1/repos/files?limit=5000&ref=${sha}`);
		const claims = await tokenClaims(requests[0]?.authorization ?? null);
		expect(claims.scopes).toEqual(["git:read"]);
	});

	it.each([
		["a larger Content-Length", { declaredBytes: 11, sentBytes: 1 }],
		["a chunked body past the ceiling", { sentBytes: 11 }],
	])("refuses a file with %s and never reads the rest of the body", async (_label, holdOpen) => {
		await startServer();
		// The body never ends: a read to the end would hang until the timeout.
		answers.push({ status: 200, body: new Uint8Array(), holdOpen });
		const store = makeStore();

		await expect(
			store.readFile("project-1", "a".repeat(40), "big.json", 10),
		).rejects.toBeInstanceOf(GitFileTooLargeError);
		expect(requests).toHaveLength(1);
	});

	it("reads the regular files of the archive and skips the entry after a pax header", async () => {
		await startServer();
		// 120 characters with no "/" do not fit the 100-byte ustar name field.
		const longPath = `${"x".repeat(120)}.ts`;
		answers.push({ status: 200, body: await gitArchive(longPath) });
		const store = makeStore();

		const archive = await store.readArchiveFiles("project-1", "a".repeat(40), [
			".claude/**",
		]);

		if (archive.kind !== "files") {
			throw new Error(`expected files, got ${archive.kind}`);
		}
		expect(
			[...archive.files].map(([path, bytes]) => [
				path,
				new TextDecoder().decode(bytes),
			]),
		).toEqual([
			["package.json", "{}"],
			["src/app.tsx", "app"],
		]);
		expect(requests[0]?.method).toBe("POST");
		expect(requests[0]?.path).toBe("/api/v1/repos/archive");
		expect(JSON.parse(requests[0]?.body ?? "{}")).toEqual({
			exclude_globs: [".claude/**"],
			ref: "a".repeat(40),
		});
	});

	it.each<{ ceiling: string; answer: Answer }>([
		{
			ceiling: "4 MB of gzip, before the body",
			answer: {
				status: 200,
				body: new Uint8Array(),
				holdOpen: { declaredBytes: 4 * 1024 * 1024 + 1, sentBytes: 1 },
			},
		},
		{
			// About 17 KB of gzip that unpacks to 17 MB: a gzip bomb.
			ceiling: "16 MB of unpacked tar",
			answer: { status: 200, body: gzipSync(Buffer.alloc(17 * 1024 * 1024)) },
		},
	])("answers overCeiling for an archive over $ceiling", async ({ answer }) => {
		await startServer();
		answers.push(answer);
		const store = makeStore();

		await expect(
			store.readArchiveFiles("project-1", "a".repeat(40), []),
		).resolves.toEqual({ kind: "overCeiling" });
	});

	it("reads the archive once with no retry, and still retries the file list", async () => {
		await startServer();
		const store = makeStore();
		const sha = "a".repeat(40);

		// The Code view tree waits for the archive, so a 503 must fail at once.
		answers.push({ status: 503, body: { detail: "busy" } });
		const failure = await store
			.readArchiveFiles("project-1", sha, [])
			.catch((error: unknown) => error);
		expect(failure).toBeInstanceOf(GitStoreError);
		expect(requests).toHaveLength(1);

		answers.push(
			{ status: 503, body: { detail: "busy" } },
			{
				status: 200,
				body: Buffer.from(
					JSON.stringify({
						entries: [{ path: "a.ts", type: "blob", mode: "100644" }],
						has_more: false,
						ref: "main",
					}),
				),
			},
		);
		await expect(store.listFilePaths("project-1", sha, 10)).resolves.toEqual([
			"a.ts",
		]);
		expect(requests).toHaveLength(3);
	});

	// "-1000" is -512 in octal: the old reader never moved its offset.
	it.each([
		["a negative size", "-1000"],
		["a size past the end of the tar", "10000"],
	])("throws for a tar header with %s", async (_label, sizeField) => {
		await startServer();
		answers.push({
			status: 200,
			body: tarGzOf(tarEntry("a.ts", "", sizeField)),
		});
		const store = makeStore();

		await expect(
			store.readArchiveFiles("project-1", "a".repeat(40), []),
		).rejects.toThrow("bad size");
	});

	it("keeps two paths that differ only by a trailing space apart", async () => {
		await startServer();
		answers.push({
			status: 200,
			body: tarGzOf(tarEntry("src/a.ts", "one"), tarEntry("src/a.ts ", "two")),
		});
		const store = makeStore();

		const archive = await store.readArchiveFiles(
			"project-1",
			"a".repeat(40),
			[],
		);

		if (archive.kind !== "files") {
			throw new Error(`expected files, got ${archive.kind}`);
		}
		expect(
			[...archive.files].map(([path, bytes]) => [
				path,
				new TextDecoder().decode(bytes),
			]),
		).toEqual([
			["src/a.ts", "one"],
			["src/a.ts ", "two"],
		]);
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

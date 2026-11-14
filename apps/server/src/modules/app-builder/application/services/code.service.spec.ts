import {
	BadRequestException,
	ConflictException,
	HttpException,
	NotFoundException,
	PayloadTooLargeException,
} from "@nestjs/common";
import {
	CODE_FILE_MAX_BYTES,
	type CodeFileResponse,
	type CodeSnapshotResponse,
	codeFileResponseSchema,
	codeSnapshotResponseSchema,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import {
	type ProjectScope,
	projectScopeFrom,
} from "../../../projects/domain/project-scope";
import { GitFileTooLargeError } from "../../domain/errors/git-file-too-large.error";
import type {
	GitArchiveFiles,
	GitFileReader,
} from "../../domain/ports/git-store";
import type {
	SandboxCreateOptions,
	SandboxExecResult,
} from "../../domain/ports/sandbox-provider";
import type { ScopedAppProject } from "../../infrastructure/persistence/app-commits.repository";
import {
	FAKE_WORKSPACE_DIR,
	FakeSandboxProvider,
} from "../../infrastructure/sandbox/fake-sandbox.provider";
import { CodeService, type CodeSnapshotAnswer } from "./code.service";

const WORKTREE = FAKE_WORKSPACE_DIR;
const SCOPE: ProjectScope = projectScopeFrom(undefined, "user-1");
const PROJECT: ScopedAppProject = {
	engine: "v2_app",
	framework: "web-app",
	id: "p-1",
	organizationId: null,
	templateVersion: "web-app@1.0.0",
	userId: "user-1",
};
const CREATE_OPTIONS: SandboxCreateOptions = {
	devCommand: "pnpm run dev",
	devPort: 5173,
	env: {},
	framework: "web-app",
	organizationId: null,
	ownerUserId: "user-1",
	templateVersion: "web-app@1.0.0",
};

function ok(stdout: string): SandboxExecResult {
	return { exitCode: 0, stderr: "", stdout };
}

const HEAD_SHA = "a".repeat(40);

/** What the fake code.storage reader holds at `HEAD_SHA`. */
type StoredCode = {
	/** The blob paths of the listing; null answers like a 404. */
	paths?: string[] | null;
	/** The archive answer, or an Error that the archive read throws. */
	archive?: GitArchiveFiles | Error;
	/** The committed files that `readFile` answers, by path. */
	files?: Record<string, string>;
};

// A plain fake of code.storage. `calls` names each read, so a case can
// prove that a path never reaches the store.
function fakeGitFiles(stored: StoredCode) {
	const calls: string[] = [];
	const reader: Pick<
		GitFileReader,
		"readFile" | "listFilePaths" | "readArchiveFiles"
	> = {
		listFilePaths: async (_projectId, ref) => {
			calls.push(`list ${ref}`);
			return stored.paths === undefined ? [] : stored.paths;
		},
		readArchiveFiles: async (_projectId, ref) => {
			calls.push(`archive ${ref}`);
			if (stored.archive instanceof Error) {
				throw stored.archive;
			}
			return stored.archive ?? { files: new Map(), kind: "files" };
		},
		readFile: async (_projectId, ref, path, maxBytes) => {
			calls.push(`file ${ref} ${path}`);
			const text = stored.files?.[path];
			if (text === undefined) {
				return null;
			}
			const bytes = new TextEncoder().encode(text);
			// The real store throws before it holds a larger body.
			if (maxBytes !== undefined && bytes.byteLength > maxBytes) {
				throw new GitFileTooLargeError(path);
			}
			return bytes;
		},
	};
	return { calls, reader };
}

function archiveOf(files: Record<string, string>): GitArchiveFiles {
	const encoded = Object.entries(files).map(
		([path, text]): [string, Uint8Array] => [
			path,
			new TextEncoder().encode(text),
		],
	);
	return { files: new Map(encoded), kind: "files" };
}

async function setup(options?: {
	project?: ScopedAppProject | null;
	sandbox?: "running" | "stopped" | "none";
	/** The stored `main` head; null or absent means no commit yet. */
	headSha?: string | null;
	stored?: StoredCode;
}) {
	const sandboxes = new FakeSandboxProvider();
	if (options?.sandbox !== "none") {
		await sandboxes.getOrCreate("p-1", CREATE_OPTIONS);
		if (options?.sandbox === "stopped") {
			await sandboxes.stop("p-1");
		}
	}
	const project = options?.project === undefined ? PROJECT : options.project;
	const headSha = options?.headSha ?? null;
	const git = fakeGitFiles(options?.stored ?? {});
	const service = new CodeService(
		{
			findBranch: async () => (headSha === null ? null : { headSha }),
			findScopedProject: async () => project,
		},
		sandboxes,
		git.reader,
	);
	return { git, sandboxes, service };
}

// The snapshot body of a "snapshot" answer; a "notModified" answer fails the case.
async function snapshotOf(
	answer: Promise<CodeSnapshotAnswer>,
): Promise<CodeSnapshotResponse> {
	const result = await answer;
	if (result.kind !== "snapshot") {
		throw new Error(`expected a snapshot, got ${result.kind}`);
	}
	return result.snapshot;
}

function sandboxReads(sandboxes: FakeSandboxProvider): string[] {
	return sandboxes.calls
		.filter((call) => call.method === "findRunning" || call.method === "exec")
		.map((call) => call.method);
}

// Scripts the one command of a file read: the real worktree, the real
// path of the open file, then the bytes as base64.
function scriptFile(
	sandboxes: FakeSandboxProvider,
	realPath: string,
	content: string | Uint8Array,
): void {
	sandboxes.respondTo(
		"bash",
		ok(`${WORKTREE}\0${realPath}\0${Buffer.from(content).toString("base64")}`),
	);
}

/** One path of the prefetch output: read with its real path, or not read. */
type PrefetchRecord =
	| { realPath: string; content: string; size?: number }
	| { notRead: true };

// The prefetch command prints the real worktree, then one record per path.
// `size` defaults to the byte length of `content`.
function prefetchOutput(records: PrefetchRecord[]): string {
	const body = records
		.map((record) => {
			if ("notRead" in record) return "\0\0\0";
			const size = record.size ?? Buffer.byteLength(record.content);
			const base64 = Buffer.from(record.content).toString("base64");
			return `${record.realPath}\0${size}\0${base64}\0`;
		})
		.join("");
	return `${WORKTREE}\0${body}`;
}

// Scripts the listing commands of a snapshot for `paths`, with no deleted
// path and the branch `main`.
function scriptListing(sandboxes: FakeSandboxProvider, paths: string[]): void {
	sandboxes.respondTo("bash", ok(paths.map((path) => `${path}\0`).join("")));
	sandboxes.respondTo("bash", ok(""));
	sandboxes.respondTo("git", ok("main\n"));
}

async function failureOf<T extends CodeFileResponse | CodeSnapshotAnswer>(
	promise: Promise<T>,
): Promise<HttpException> {
	const failure = await promise.then(
		() => null,
		(error: unknown) => error,
	);
	if (!(failure instanceof HttpException)) {
		throw new Error(`expected an HttpException, got ${String(failure)}`);
	}
	return failure;
}

function execCalls(sandboxes: FakeSandboxProvider): string[] {
	return sandboxes.calls
		.filter((call) => call.method === "exec")
		.map((call) => call.detail ?? "");
}

describe("CodeService.snapshot", () => {
	it("answers the tree without .env files and deleted paths, the branch, and the default file", async () => {
		const { sandboxes, service } = await setup();
		sandboxes.respondTo(
			"bash",
			ok(
				"package.json\0src/routes/index.tsx\0.env\0.env.local\0src/old.ts\0src/app.tsx\0",
			),
		);
		sandboxes.respondTo("bash", ok("src/old.ts\0"));
		sandboxes.respondTo("git", ok("main\n"));
		sandboxes.respondTo(
			"bash",
			ok(
				prefetchOutput([
					{
						content: "export default 1;\n",
						realPath: `${WORKTREE}/src/routes/index.tsx`,
					},
					{ content: "app", realPath: `${WORKTREE}/src/app.tsx` },
					{ content: "{}", realPath: `${WORKTREE}/package.json` },
				]),
			),
		);

		const snapshot = await snapshotOf(
			service.snapshot(SCOPE, "p-1", undefined),
		);

		expect(codeSnapshotResponseSchema.parse(snapshot)).toEqual({
			branch: "main",
			defaultFilePath: "src/routes/index.tsx",
			files: [
				{
					binary: false,
					content: "export default 1;\n",
					path: "src/routes/index.tsx",
					size: 18,
				},
				{ binary: false, content: "app", path: "src/app.tsx", size: 3 },
				{ binary: false, content: "{}", path: "package.json", size: 2 },
			],
			tree: [
				{
					children: [
						{
							children: [
								{
									kind: "file",
									name: "index.tsx",
									path: "src/routes/index.tsx",
								},
							],
							kind: "folder",
							name: "routes",
							path: "src/routes",
						},
						{ kind: "file", name: "app.tsx", path: "src/app.tsx" },
					],
					kind: "folder",
					name: "src",
					path: "src",
				},
				{ kind: "file", name: "package.json", path: "package.json" },
			],
		});
		// Both listings stop at 5000 paths and 2 MB, so the stdout stays small.
		// The prefetch reads at most 64 KB per file and 512 KB in total.
		expect(execCalls(sandboxes)).toEqual([
			expect.stringMatching(
				/ bash 5000 2097152 ls-files -z --cached --others --exclude-standard$/,
			),
			expect.stringMatching(/ bash 5000 2097152 ls-files -z --deleted$/),
			expect.stringMatching(/^git .* rev-parse --abbrev-ref HEAD$/),
			expect.stringMatching(
				/ bash 65536 524288 src\/routes\/index\.tsx src\/app\.tsx package\.json$/,
			),
		]);
	});

	it("drops a path that the byte cap cut in the middle", async () => {
		const { sandboxes, service } = await setup();
		sandboxes.respondTo("bash", ok("a.ts\0b.t"));
		sandboxes.respondTo("bash", ok(""));
		sandboxes.respondTo("git", ok("main\n"));
		sandboxes.respondTo(
			"bash",
			ok(prefetchOutput([{ content: "a", realPath: `${WORKTREE}/a.ts` }])),
		);

		const snapshot = await snapshotOf(
			service.snapshot(SCOPE, "p-1", undefined),
		);

		expect(snapshot.tree).toEqual([
			{ kind: "file", name: "a.ts", path: "a.ts" },
		]);
	});

	it("answers binary files of the prefetch with an empty content", async () => {
		const { sandboxes, service } = await setup();
		scriptListing(sandboxes, ["logo.png"]);
		sandboxes.respondTo(
			"bash",
			ok(
				prefetchOutput([
					{ content: "PNG\0\0", realPath: `${WORKTREE}/logo.png` },
				]),
			),
		);

		const snapshot = await snapshotOf(
			service.snapshot(SCOPE, "p-1", undefined),
		);

		expect(snapshot.files).toEqual([
			{ binary: true, content: "", path: "logo.png", size: 5 },
		]);
	});

	it("drops prefetch records that are not read, outside the worktree, hidden, or torn", async () => {
		const { sandboxes, service } = await setup();
		scriptListing(sandboxes, ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "f.ts"]);
		sandboxes.respondTo(
			"bash",
			ok(
				prefetchOutput([
					{ notRead: true },
					{ content: "secret", realPath: "/proc/1/environ" },
					{ content: "TOKEN=1", realPath: `${WORKTREE}/.env` },
					{ content: "[core]", realPath: `${WORKTREE}/.git/config` },
					// The file shrank after `stat`: the size and the bytes differ.
					{ content: "abc", realPath: `${WORKTREE}/e.ts`, size: 2 },
					{ content: "kept", realPath: `${WORKTREE}/f.ts` },
				]),
			),
		);

		const snapshot = await snapshotOf(
			service.snapshot(SCOPE, "p-1", undefined),
		);

		expect(snapshot.files).toEqual([
			{ binary: false, content: "kept", path: "f.ts", size: 4 },
		]);
	});

	it("answers the tree with no files when the prefetch command fails", async () => {
		const { sandboxes, service } = await setup();
		scriptListing(sandboxes, ["a.ts"]);
		sandboxes.respondTo("bash", {
			exitCode: 124,
			stderr: "timeout",
			stdout: "",
		});

		const snapshot = await snapshotOf(
			service.snapshot(SCOPE, "p-1", undefined),
		);

		expect(snapshot.tree).toEqual([
			{ kind: "file", name: "a.ts", path: "a.ts" },
		]);
		expect(snapshot.files).toEqual([]);
	});

	it("answers no files when the prefetch prints a wrong number of parts", async () => {
		const { sandboxes, service } = await setup();
		scriptListing(sandboxes, ["a.ts", "b.ts"]);
		sandboxes.respondTo(
			"bash",
			ok(prefetchOutput([{ content: "a", realPath: `${WORKTREE}/a.ts` }])),
		);

		const snapshot = await snapshotOf(
			service.snapshot(SCOPE, "p-1", undefined),
		);

		expect(snapshot.files).toEqual([]);
	});

	it("runs no prefetch when the tree has only skipped files", async () => {
		const { sandboxes, service } = await setup();
		scriptListing(sandboxes, [
			".claude/skills/a/SKILL.md",
			".claude/settings.json",
		]);

		const snapshot = await snapshotOf(
			service.snapshot(SCOPE, "p-1", undefined),
		);

		expect(snapshot.files).toEqual([]);
		expect(execCalls(sandboxes)).toHaveLength(3);
	});

	it("throws when git fails", async () => {
		const { sandboxes, service } = await setup();
		sandboxes.respondTo("bash", {
			exitCode: 128,
			stderr: "fatal: not a git repository",
			stdout: "",
		});
		sandboxes.respondTo("bash", ok(""));
		sandboxes.respondTo("git", ok("main\n"));

		await expect(service.snapshot(SCOPE, "p-1", undefined)).rejects.toThrow(
			"git ls-files -z --cached --others --exclude-standard failed (128)",
		);
	});

	it("answers 404 for a project out of scope or a V1 project", async () => {
		const outOfScope = await setup({ project: null });
		const v1 = await setup({ project: { ...PROJECT, engine: "v1_page" } });

		await expect(
			outOfScope.service.snapshot(SCOPE, "p-1", undefined),
		).rejects.toBeInstanceOf(NotFoundException);
		await expect(
			v1.service.snapshot(SCOPE, "p-1", undefined),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("answers 409 SANDBOX_NOT_RUNNING for a stopped sandbox and does not wake it", async () => {
		const { sandboxes, service } = await setup({ sandbox: "stopped" });

		const failure = await failureOf(service.snapshot(SCOPE, "p-1", undefined));

		expect(failure).toBeInstanceOf(ConflictException);
		expect(failure.getResponse()).toMatchObject({
			code: "SANDBOX_NOT_RUNNING",
		});
		expect(await sandboxes.findRunning("p-1")).toBeNull();
		expect(
			sandboxes.calls.filter((call) => call.method === "getOrCreate"),
		).toHaveLength(1);
	});

	it("answers 409 SANDBOX_NOT_RUNNING when the project has no sandbox", async () => {
		const { sandboxes, service } = await setup({ sandbox: "none" });

		await expect(
			service.snapshot(SCOPE, "p-1", undefined),
		).rejects.toBeInstanceOf(ConflictException);
		expect(sandboxes.createdCount).toBe(0);
	});
});

describe("CodeService.file", () => {
	it("answers the text and the size of a file through a capped read", async () => {
		const { sandboxes, service } = await setup();
		scriptFile(sandboxes, `${WORKTREE}/src/routes/index.tsx`, "hello");

		const file = await service.file(SCOPE, "p-1", "src/routes/index.tsx");

		expect(codeFileResponseSchema.parse(file)).toEqual({
			binary: false,
			content: "hello",
			path: "src/routes/index.tsx",
			size: 5,
		});
		// One command checks and reads, and asks for one byte over the
		// 512 KB cap, never more.
		expect(execCalls(sandboxes)).toEqual([
			expect.stringMatching(
				new RegExp(
					`^bash -c .+ bash ${WORKTREE} ${WORKTREE}/src/routes/index.tsx ${CODE_FILE_MAX_BYTES + 1}$`,
					"s",
				),
			),
		]);
	});

	it("answers binary with an empty content for a PNG", async () => {
		const { sandboxes, service } = await setup();
		const png = new Uint8Array([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
		]);
		scriptFile(sandboxes, `${WORKTREE}/public/logo.png`, png);

		const file = await service.file(SCOPE, "p-1", "public/logo.png");

		expect(file).toEqual({
			binary: true,
			content: "",
			path: "public/logo.png",
			size: 12,
		});
	});

	it("answers a file of exactly 512 KB", async () => {
		const { sandboxes, service } = await setup();
		scriptFile(
			sandboxes,
			`${WORKTREE}/data.json`,
			"x".repeat(CODE_FILE_MAX_BYTES),
		);

		const file = await service.file(SCOPE, "p-1", "data.json");

		expect(file.size).toBe(CODE_FILE_MAX_BYTES);
	});

	it("answers 413 CODE_FILE_TOO_LARGE when the read gets more than the cap", async () => {
		const { sandboxes, service } = await setup();
		scriptFile(
			sandboxes,
			`${WORKTREE}/big.json`,
			"x".repeat(CODE_FILE_MAX_BYTES + 1),
		);

		const failure = await failureOf(service.file(SCOPE, "p-1", "big.json"));

		expect(failure).toBeInstanceOf(PayloadTooLargeException);
		expect(failure.getResponse()).toMatchObject({
			code: "CODE_FILE_TOO_LARGE",
		});
	});

	it("answers 404 CODE_FILE_NOT_FOUND when the script finds no regular file to open", async () => {
		const { sandboxes, service } = await setup();
		sandboxes.respondTo("bash", { exitCode: 44, stderr: "", stdout: "" });

		const failure = await failureOf(service.file(SCOPE, "p-1", "missing.ts"));

		expect(failure).toBeInstanceOf(NotFoundException);
		expect(failure.getResponse()).toMatchObject({
			code: "CODE_FILE_NOT_FOUND",
		});
	});

	it("throws when the read fails for another reason", async () => {
		const { sandboxes, service } = await setup();
		sandboxes.respondTo("bash", {
			exitCode: 137,
			stderr: "Killed",
			stdout: "",
		});

		await expect(service.file(SCOPE, "p-1", "a.ts")).rejects.toThrow(
			"Code file read failed (137): Killed",
		);
	});

	it.each([
		"../x",
		"/etc/passwd",
		".env",
	])("answers 400 CODE_PATH_INVALID for %s and runs no command", async (path) => {
		const { sandboxes, service } = await setup();

		const failure = await failureOf(service.file(SCOPE, "p-1", path));

		expect(failure).toBeInstanceOf(BadRequestException);
		expect(failure.getResponse()).toMatchObject({ code: "CODE_PATH_INVALID" });
		expect(execCalls(sandboxes)).toEqual([]);
	});

	it.each([
		["outside the worktree", "/proc/1/environ"],
		["to a .env file", `${WORKTREE}/.env`],
		["into .git", `${WORKTREE}/.git/config`],
	])("answers 400 for a symlink %s and reads nothing", async (_label, realPath) => {
		const { sandboxes, service } = await setup();
		// The script prints no bytes for a file outside the worktree.
		sandboxes.respondTo("bash", ok(`${WORKTREE}\0${realPath}\0`));

		const failure = await failureOf(service.file(SCOPE, "p-1", "link.txt"));

		expect(failure).toBeInstanceOf(BadRequestException);
		expect(execCalls(sandboxes)).toHaveLength(1);
	});

	it("answers 400 when the script prints an empty worktree root", async () => {
		const { sandboxes, service } = await setup();
		// An empty root must not turn into the prefix "/".
		sandboxes.respondTo(
			"bash",
			ok(`\0/proc/1/environ\0${Buffer.from("secret").toString("base64")}`),
		);

		const failure = await failureOf(service.file(SCOPE, "p-1", "a.ts"));

		expect(failure).toBeInstanceOf(BadRequestException);
	});

	it("answers 404 for a project out of scope before any path check", async () => {
		const { service } = await setup({ project: null });

		await expect(service.file(SCOPE, "p-1", ".env")).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it("answers 409 SANDBOX_NOT_RUNNING for a stopped sandbox", async () => {
		const { service } = await setup({ sandbox: "stopped" });

		await expect(
			service.file(SCOPE, "p-1", "src/app.tsx"),
		).rejects.toBeInstanceOf(ConflictException);
	});
});

describe("CodeService on the stored main head", () => {
	it("reads the commit with no sandbox call, even when the sandbox is stopped", async () => {
		const { git, sandboxes, service } = await setup({
			headSha: HEAD_SHA,
			sandbox: "stopped",
			stored: {
				archive: archiveOf({ "src/app.tsx": "app" }),
				paths: ["src/app.tsx"],
			},
		});

		const answer = await service.snapshot(SCOPE, "p-1", undefined);

		expect(answer).toMatchObject({
			etag: expect.stringContaining(HEAD_SHA),
			kind: "snapshot",
			snapshot: {
				branch: "main",
				defaultFilePath: "src/app.tsx",
				files: [
					{ binary: false, content: "app", path: "src/app.tsx", size: 3 },
				],
			},
		});
		expect(git.calls).toEqual([`list ${HEAD_SHA}`, `archive ${HEAD_SHA}`]);
		expect(sandboxReads(sandboxes)).toEqual([]);
	});

	it("reads the sandbox and never the store when the project has no commit", async () => {
		const { git, sandboxes, service } = await setup();
		scriptListing(sandboxes, []);

		const answer = await service.snapshot(SCOPE, "p-1", undefined);

		expect(answer).toMatchObject({ etag: null, kind: "snapshot" });
		expect(git.calls).toEqual([]);
	});

	it("reads the sandbox when the store answers 404 for the head", async () => {
		const { sandboxes, service } = await setup({
			headSha: HEAD_SHA,
			stored: { paths: null },
		});
		scriptListing(sandboxes, ["a.ts"]);
		sandboxes.respondTo(
			"bash",
			ok(prefetchOutput([{ content: "a", realPath: `${WORKTREE}/a.ts` }])),
		);

		const answer = await service.snapshot(SCOPE, "p-1", undefined);

		expect(answer).toMatchObject({ etag: null, kind: "snapshot" });
		expect(sandboxReads(sandboxes)).toContain("findRunning");
	});

	it("keeps a committed .env and .git file out of the tree and the files", async () => {
		const { service } = await setup({
			headSha: HEAD_SHA,
			stored: {
				archive: archiveOf({
					".env": "TOKEN=1",
					".git/config": "[core]",
					"src/app.tsx": "app",
				}),
				paths: [".env", ".git/config", "src/app.tsx"],
			},
		});

		const snapshot = await snapshotOf(
			service.snapshot(SCOPE, "p-1", undefined),
		);

		expect(snapshot.tree).toEqual([
			{
				children: [{ kind: "file", name: "app.tsx", path: "src/app.tsx" }],
				kind: "folder",
				name: "src",
				path: "src",
			},
		]);
		expect(snapshot.files.map((file) => file.path)).toEqual(["src/app.tsx"]);
	});

	it("skips a file over 64 KB and a file past the 512 KB budget, in the prefetch order", async () => {
		const kilobytes = (count: number) => "x".repeat(count * 1024);
		const { service } = await setup({
			headSha: HEAD_SHA,
			stored: {
				// The default file first, then `src/` in display order, then the rest.
				archive: archiveOf({
					"README.md": "readme",
					"src/a.ts": kilobytes(64),
					"src/b.ts": kilobytes(65),
					"src/c/1.ts": kilobytes(60),
					"src/c/2.ts": kilobytes(60),
					"src/c/3.ts": kilobytes(60),
					"src/c/4.ts": kilobytes(60),
					"src/c/5.ts": kilobytes(60),
					"src/c/6.ts": kilobytes(60),
					"src/c/7.ts": kilobytes(60),
					"src/c/8.ts": kilobytes(60),
					"src/routes/index.tsx": "index",
				}),
				paths: [
					"README.md",
					"src/a.ts",
					"src/b.ts",
					"src/c/1.ts",
					"src/c/2.ts",
					"src/c/3.ts",
					"src/c/4.ts",
					"src/c/5.ts",
					"src/c/6.ts",
					"src/c/7.ts",
					"src/c/8.ts",
					"src/routes/index.tsx",
				],
			},
		});

		const snapshot = await snapshotOf(
			service.snapshot(SCOPE, "p-1", undefined),
		);

		// 8 * 60 = 480 KB fit. `src/a.ts` (64 KB) then passes the 512 KB
		// budget, `src/b.ts` is over 64 KB, and the small README still fits.
		expect(snapshot.files.map((file) => file.path)).toEqual([
			"src/routes/index.tsx",
			"src/c/1.ts",
			"src/c/2.ts",
			"src/c/3.ts",
			"src/c/4.ts",
			"src/c/5.ts",
			"src/c/6.ts",
			"src/c/7.ts",
			"src/c/8.ts",
			"README.md",
		]);
	});

	it.each([
		["a plain tag", (etag: string) => etag],
		["a weak tag", (etag: string) => `W/${etag}`],
		["a tag in a list", (etag: string) => `"other", ${etag}`],
	])("answers notModified with no store read for %s", async (_label, header) => {
		const first = await setup({ headSha: HEAD_SHA });
		const answer = await first.service.snapshot(SCOPE, "p-1", undefined);
		if (answer.etag === null) {
			throw new Error("expected an ETag on a committed snapshot");
		}
		const { git, service } = await setup({ headSha: HEAD_SHA });

		const second = await service.snapshot(SCOPE, "p-1", header(answer.etag));

		expect(second).toEqual({ etag: answer.etag, kind: "notModified" });
		expect(git.calls).toEqual([]);
	});

	it("reads the store when If-None-Match holds the tag of another head", async () => {
		const { git, service } = await setup({ headSha: HEAD_SHA });

		const answer = await service.snapshot(
			SCOPE,
			"p-1",
			`"code-v1-${"b".repeat(40)}"`,
		);

		expect(answer.kind).toBe("snapshot");
		expect(git.calls).toContain(`list ${HEAD_SHA}`);
	});

	// A failed read can pass next time, so it has no ETag. An archive over a
	// ceiling stays over it at this sha, so its answer keeps the ETag.
	it.each([
		[
			"the archive read fails",
			new Error("code.storage archive read failed (502)"),
			null,
		],
		[
			"the archive is over a ceiling",
			{ kind: "overCeiling" } as const,
			expect.stringContaining(HEAD_SHA),
		],
	])("answers the tree with no files when %s", async (_label, archive, etag) => {
		const { service } = await setup({
			headSha: HEAD_SHA,
			stored: { archive, paths: ["src/app.tsx"] },
		});

		const answer = await service.snapshot(SCOPE, "p-1", undefined);

		expect(answer).toMatchObject({
			etag,
			kind: "snapshot",
			snapshot: {
				files: [],
				tree: [{ kind: "folder", path: "src" }],
			},
		});
	});

	it.each([
		".env",
		".git/config",
	])("file() answers 400 CODE_PATH_INVALID for %s and reads nothing", async (path) => {
		const { git, sandboxes, service } = await setup({
			headSha: HEAD_SHA,
			stored: { files: { [path]: "secret" } },
		});

		const failure = await failureOf(service.file(SCOPE, "p-1", path));

		expect(failure.getResponse()).toMatchObject({ code: "CODE_PATH_INVALID" });
		expect(git.calls).toEqual([]);
		expect(sandboxReads(sandboxes)).toEqual([]);
	});

	it("file() answers a committed file at the head with no sandbox call", async () => {
		const { git, sandboxes, service } = await setup({
			headSha: HEAD_SHA,
			sandbox: "stopped",
			stored: { files: { "src/app.tsx": "app" } },
		});

		const file = await service.file(SCOPE, "p-1", "src/app.tsx");

		expect(file).toEqual({
			binary: false,
			content: "app",
			path: "src/app.tsx",
			size: 3,
		});
		expect(git.calls).toEqual([`file ${HEAD_SHA} src/app.tsx`]);
		expect(sandboxReads(sandboxes)).toEqual([]);
	});

	it.each([
		["a missing file", {}, NotFoundException, "CODE_FILE_NOT_FOUND"],
		[
			"a file over the cap",
			{ "big.json": "x".repeat(CODE_FILE_MAX_BYTES + 1) },
			PayloadTooLargeException,
			"CODE_FILE_TOO_LARGE",
		],
	])("file() answers %s at the head when no sandbox runs", async (_label, files, type, code) => {
		// A stopped sandbox gives 404 for a missing file here, never 409.
		const { service } = await setup({
			headSha: HEAD_SHA,
			sandbox: "stopped",
			stored: { files },
		});

		const failure = await failureOf(service.file(SCOPE, "p-1", "big.json"));

		expect(failure).toBeInstanceOf(type);
		expect(failure.getResponse()).toMatchObject({ code });
	});

	it("file() reads the running sandbox when the store has no file at the head", async () => {
		// code.storage lost the repository, so the tree comes from the sandbox.
		// Each file of that tree must come from the sandbox too.
		const { git, sandboxes, service } = await setup({ headSha: HEAD_SHA });
		scriptFile(sandboxes, `${WORKTREE}/src/app.tsx`, "app");

		const file = await service.file(SCOPE, "p-1", "src/app.tsx");

		expect(file).toEqual({
			binary: false,
			content: "app",
			path: "src/app.tsx",
			size: 3,
		});
		expect(git.calls).toEqual([`file ${HEAD_SHA} src/app.tsx`]);
	});
});

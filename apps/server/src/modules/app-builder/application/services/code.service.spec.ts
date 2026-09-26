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

import type { ProjectScope } from "../../../projects/domain/project-scope";
import type {
	SandboxCreateOptions,
	SandboxExecResult,
} from "../../domain/ports/sandbox-provider";
import type { ScopedAppProject } from "../../infrastructure/persistence/app-commits.repository";
import {
	FAKE_WORKSPACE_DIR,
	FakeSandboxProvider,
} from "../../infrastructure/sandbox/fake-sandbox.provider";
import { CodeService } from "./code.service";

const WORKTREE = FAKE_WORKSPACE_DIR;
const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };
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

async function setup(options?: {
	project?: ScopedAppProject | null;
	sandbox?: "running" | "stopped" | "none";
}) {
	const sandboxes = new FakeSandboxProvider();
	if (options?.sandbox !== "none") {
		await sandboxes.getOrCreate("p-1", CREATE_OPTIONS);
		if (options?.sandbox === "stopped") {
			await sandboxes.stop("p-1");
		}
	}
	const project = options?.project === undefined ? PROJECT : options.project;
	const service = new CodeService(
		{ findScopedProject: async () => project },
		sandboxes,
	);
	return { sandboxes, service };
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

async function failureOf<T extends CodeFileResponse | CodeSnapshotResponse>(
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

		const snapshot = await service.snapshot(SCOPE, "p-1");

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
			"git rev-parse --abbrev-ref HEAD",
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

		const snapshot = await service.snapshot(SCOPE, "p-1");

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

		const snapshot = await service.snapshot(SCOPE, "p-1");

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

		const snapshot = await service.snapshot(SCOPE, "p-1");

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

		const snapshot = await service.snapshot(SCOPE, "p-1");

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

		const snapshot = await service.snapshot(SCOPE, "p-1");

		expect(snapshot.files).toEqual([]);
	});

	it("runs no prefetch when the tree has only skipped files", async () => {
		const { sandboxes, service } = await setup();
		scriptListing(sandboxes, [
			".claude/skills/a/SKILL.md",
			".claude/settings.json",
		]);

		const snapshot = await service.snapshot(SCOPE, "p-1");

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

		await expect(service.snapshot(SCOPE, "p-1")).rejects.toThrow(
			"git ls-files -z --cached --others --exclude-standard failed (128)",
		);
	});

	it("answers 404 for a project out of scope or a V1 project", async () => {
		const outOfScope = await setup({ project: null });
		const v1 = await setup({ project: { ...PROJECT, engine: "v1_page" } });

		await expect(
			outOfScope.service.snapshot(SCOPE, "p-1"),
		).rejects.toBeInstanceOf(NotFoundException);
		await expect(v1.service.snapshot(SCOPE, "p-1")).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it("answers 409 SANDBOX_NOT_RUNNING for a stopped sandbox and does not wake it", async () => {
		const { sandboxes, service } = await setup({ sandbox: "stopped" });

		const failure = await failureOf(service.snapshot(SCOPE, "p-1"));

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

		await expect(service.snapshot(SCOPE, "p-1")).rejects.toBeInstanceOf(
			ConflictException,
		);
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

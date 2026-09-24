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

// Scripts the two commands of one file read: `realpath` answers the real
// worktree and the real file path, and the capped read answers the bytes
// as base64.
function scriptFile(
	sandboxes: FakeSandboxProvider,
	realPath: string,
	content: string | Uint8Array,
): void {
	sandboxes.respondTo("realpath", ok(`${WORKTREE}\0${realPath}\0`));
	sandboxes.respondTo("bash", ok(Buffer.from(content).toString("base64")));
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

		const snapshot = await service.snapshot(SCOPE, "p-1");

		expect(codeSnapshotResponseSchema.parse(snapshot)).toEqual({
			branch: "main",
			defaultFilePath: "src/routes/index.tsx",
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
		expect(execCalls(sandboxes)).toEqual([
			expect.stringMatching(
				/ bash 5000 2097152 ls-files -z --cached --others --exclude-standard$/,
			),
			expect.stringMatching(/ bash 5000 2097152 ls-files -z --deleted$/),
			"git rev-parse --abbrev-ref HEAD",
		]);
	});

	it("drops a path that the byte cap cut in the middle", async () => {
		const { sandboxes, service } = await setup();
		sandboxes.respondTo("bash", ok("a.ts\0b.t"));
		sandboxes.respondTo("bash", ok(""));
		sandboxes.respondTo("git", ok("main\n"));

		const snapshot = await service.snapshot(SCOPE, "p-1");

		expect(snapshot.tree).toEqual([
			{ kind: "file", name: "a.ts", path: "a.ts" },
		]);
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
		// The read asks for one byte over the 512 KB cap, never more.
		expect(execCalls(sandboxes)).toEqual([
			`realpath -e -z -- ${WORKTREE} ${WORKTREE}/src/routes/index.tsx`,
			expect.stringMatching(
				new RegExp(
					`^bash -c .+ bash ${WORKTREE}/src/routes/index.tsx ${CODE_FILE_MAX_BYTES + 1}$`,
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

	it("answers 404 CODE_FILE_NOT_FOUND for a missing path", async () => {
		const { sandboxes, service } = await setup();
		sandboxes.respondTo("realpath", {
			exitCode: 1,
			stderr: "realpath: missing.ts: No such file or directory",
			stdout: `${WORKTREE}\0`,
		});

		const failure = await failureOf(service.file(SCOPE, "p-1", "missing.ts"));

		expect(failure).toBeInstanceOf(NotFoundException);
		expect(failure.getResponse()).toMatchObject({
			code: "CODE_FILE_NOT_FOUND",
		});
	});

	it("answers 404 for a path that is not a regular file, like a folder", async () => {
		const { sandboxes, service } = await setup();
		sandboxes.respondTo("realpath", ok(`${WORKTREE}\0${WORKTREE}/src\0`));
		sandboxes.respondTo("bash", { exitCode: 44, stderr: "", stdout: "" });

		await expect(service.file(SCOPE, "p-1", "src")).rejects.toBeInstanceOf(
			NotFoundException,
		);
	});

	it("throws when the read fails for another reason", async () => {
		const { sandboxes, service } = await setup();
		sandboxes.respondTo("realpath", ok(`${WORKTREE}\0${WORKTREE}/a.ts\0`));
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
		sandboxes.respondTo("realpath", ok(`${WORKTREE}\0${realPath}\0`));

		const failure = await failureOf(service.file(SCOPE, "p-1", "link.txt"));

		expect(failure).toBeInstanceOf(BadRequestException);
		expect(execCalls(sandboxes)).toHaveLength(1);
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

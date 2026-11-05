import { HttpException } from "@nestjs/common";
import {
	type McpApplyChangesInput,
	mcpToolErrorSchema,
} from "@wandit/contracts";
import { describe, expect, it, vi } from "vitest";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import type { GitStore } from "../../domain/ports/git-store";
import type {
	SandboxCreateOptions,
	SandboxExecResult,
} from "../../domain/ports/sandbox-provider";
import type { TurnTaskStarter } from "../../domain/ports/turn-task-starter";
import { CommitTurnError } from "../../infrastructure/git/commit-turn";
import type {
	AppCommitRow,
	NewAppCommit,
	ScopedAppProject,
} from "../../infrastructure/persistence/app-commits.repository";
import type {
	BuilderTurnRow,
	BuilderTurnsRepository,
} from "../../infrastructure/persistence/builder-turns.repository";
import { FakeTurnLock } from "../../infrastructure/redis/fake-turn-lock";
import { FakeSandboxProvider } from "../../infrastructure/sandbox/fake-sandbox.provider";
import { McpChangesService } from "./mcp-changes.service";

const SCOPE: ProjectScope = {
	actorIsLimitExempt: true,
	actorRoles: ["owner"],
	actorUserId: "user-1",
	kind: "personal",
	ownerUserId: "user-1",
};
const HEAD = "b".repeat(40);
const NEW_SHA = "c".repeat(40);
const REMOTE = "https://org.code.storage/wandit/p-1.git";
const OK: SandboxExecResult = { exitCode: 0, stderr: "", stdout: "" };
const PROJECT: ScopedAppProject = {
	engine: "v2_app",
	framework: "web-app",
	id: "p-1",
	organizationId: null,
	templateVersion: "web-app@1.1.0",
	userId: "user-1",
};
const CREATE_OPTIONS: SandboxCreateOptions = {
	devCommand: "pnpm run dev",
	devPort: 5173,
	env: {},
	framework: "web-app",
	organizationId: null,
	ownerUserId: "user-1",
	templateVersion: "web-app@1.1.0",
};

/** An edit of the tracked `src/app.tsx` and a new `src/new.ts`. */
const INPUT: McpApplyChangesInput = {
	changes: [
		{ content: "export const a = 1;\n", path: "src/app.tsx" },
		{ content: "export const b = 2;\n", path: "src/new.ts" },
	],
	expectedHeadSha: HEAD,
	message: "Add b",
	projectId: "p-1",
};

/** The undo of `INPUT`: the tracked file comes back from HEAD, and the new file goes away. */
const UNDO_LINES = [
	expect.stringMatching(` reset --quiet ${HEAD}$`),
	expect.stringMatching(
		` --literal-pathspecs checkout ${HEAD} -- src/app.tsx$`,
	),
	expect.stringMatching(/ --literal-pathspecs clean -f -q -x -- src\/new\.ts$/),
];

/** The project state of one case. Every field has a default that lets the call pass. */
type ProjectState = {
	/** True when a turn holds the project lock before the call. */
	lockedByTurn?: boolean;
	/** True when a turn of the project waits for a user answer. */
	turnWaits?: boolean;
	/** "none": the project has no running sandbox. */
	sandbox?: "running" | "none";
	/** `projects.framework`. Default: `web-app`. */
	framework?: string;
};

async function setup(state: ProjectState = {}) {
	const sandboxes = new FakeSandboxProvider();
	if (state.sandbox !== "none") {
		await sandboxes.getOrCreate("p-1", CREATE_OPTIONS);
	}
	const turnLock = new FakeTurnLock();
	if (state.lockedByTurn) {
		await turnLock.acquire("p-1", "turn-9", 60_000);
	}
	const inserted: NewAppCommit[] = [];
	const appCommits = {
		findBranch: async () => ({ headSha: HEAD }),
		findScopedProject: async () => ({
			...PROJECT,
			framework: state.framework ?? PROJECT.framework,
		}),
		insert: async (row: NewAppCommit): Promise<AppCommitRow> => {
			inserted.push(row);
			return { ...row, createdAt: new Date(0), id: "row-1" };
		},
		upsertBranchHead: async () => true,
	};
	const gitStore: GitStore = {
		deleteRepository: async () => undefined,
		ensureRepository: async () => ({ remoteUrl: REMOTE }),
		issueCredential: async () => ({
			expiresAt: new Date(Date.now() + 600_000),
			password: "header.payload.signature",
			remoteUrl: REMOTE,
			username: "t",
		}),
	};
	const turns = {
		findWaitingForUser: async () =>
			// SAFETY: the service reads only whether a row exists.
			state.turnWaits ? ({ id: "turn-8" } as BuilderTurnRow) : null,
		promoteOldestWaiting: vi.fn<BuilderTurnsRepository["promoteOldestWaiting"]>(
			async () => null,
		),
		setTriggerRunId: vi.fn(async () => undefined),
		transition: vi.fn<BuilderTurnsRepository["transition"]>(async () => true),
	};
	const starter: TurnTaskStarter = {
		cancel: async () => undefined,
		start: async () => ({ runId: "run-1", runner: "trigger" }),
	};
	const service = new McpChangesService(
		appCommits,
		sandboxes,
		turnLock,
		gitStore,
		{ putPatch: async () => undefined },
		turns,
		starter,
		{ scheduleIfLinked: async () => undefined },
	);
	return { inserted, sandboxes, service, turnLock };
}

/**
 * Scripts the sandbox answers of one call: the HEAD check, the tracked-file list, the guarded
 * write script, then the 9 git commands of `commitTurn`. A failed push answers twice, because
 * `commitTurn` retries it once. The three commands of the undo follow. `writeExitCode` is a
 * refusal of the write script, 45 or 46, and the script then prints the refused path.
 */
function scriptCall(
	sandboxes: FakeSandboxProvider,
	options: {
		sandboxHead?: string;
		writeExitCode?: number;
		pushFails?: boolean;
	} = {},
): void {
	sandboxes.respondTo("git", {
		...OK,
		stdout: `${options.sandboxHead ?? HEAD}\n`,
	});
	sandboxes.respondTo("git", { ...OK, stdout: "src/app.tsx\0" }); // ls-tree
	sandboxes.respondTo("bash", {
		...OK,
		exitCode: options.writeExitCode ?? 0,
		stdout: options.writeExitCode === undefined ? "" : "src/app.tsx",
	});
	sandboxes.respondTo("git", OK); // add
	sandboxes.respondTo("git", { ...OK, stdout: "Earlier version\n" }); // log
	sandboxes.respondTo("git", OK); // commit
	sandboxes.respondTo("git", OK); // tag -f
	sandboxes.respondTo("git", { ...OK, stdout: `${NEW_SHA}\n` }); // rev-parse HEAD
	sandboxes.respondTo("git", { ...OK, stdout: `${HEAD}\n` }); // rev-parse HEAD~1
	sandboxes.respondTo("git", {
		...OK,
		stdout: "1\t1\tsrc/app.tsx\n1\t0\tsrc/new.ts\n",
	}); // numstat
	sandboxes.respondTo("git", { ...OK, stdout: "diff --git a/src/app.tsx\n" }); // show
	sandboxes.respondTo("git", options.pushFails ? { ...OK, exitCode: 1 } : OK); // push
	sandboxes.respondTo("git", { ...OK, exitCode: 1 }); // push retry
	sandboxes.respondTo("git", OK); // reset
	sandboxes.respondTo("git", OK); // checkout
	sandboxes.respondTo("git", OK); // clean
}

/** Every command line that the sandbox ran, in order. */
function commandLinesOf(sandboxes: FakeSandboxProvider): string[] {
	return sandboxes.calls
		.filter((call) => call.method === "exec")
		.map((call) => call.detail ?? "");
}

/** The `code` of an HTTP error, or null for any other outcome. */
async function errorCodeOf(answer: Promise<{ headSha: string }>) {
	const failure = await answer.then(
		() => null,
		(error: unknown) => error,
	);
	if (!(failure instanceof HttpException)) {
		return null;
	}
	const body = mcpToolErrorSchema.safeParse(failure.getResponse());
	return body.success ? body.data.code : null;
}

describe("McpChangesService.apply", () => {
	const REFUSED_CALLS: [
		string,
		ProjectState,
		McpApplyChangesInput,
		{ sandboxHead?: string } | null,
		string,
	][] = [
		[
			"a turn holds the lock",
			{ lockedByTurn: true },
			INPUT,
			null,
			"BUILDER_TURN_RUNNING",
		],
		[
			"a turn waits for the user",
			{ turnWaits: true },
			INPUT,
			null,
			"BUILDER_TURN_WAITING",
		],
		[
			"no sandbox runs",
			{ sandbox: "none" },
			INPUT,
			null,
			"SANDBOX_NOT_RUNNING",
		],
		[
			"the sandbox HEAD moved after the read",
			{},
			INPUT,
			{ sandboxHead: "d".repeat(40) },
			"HEAD_MOVED",
		],
		[
			"a path is on the deny list",
			{},
			{ ...INPUT, changes: [{ content: "KEY=1\n", path: "src/.env" }] },
			null,
			"PATH_NOT_ALLOWED",
		],
		// The builder writes desktop migrations only through add_local_migration and its gate.
		[
			"a desktop project writes a migration file",
			{ framework: "desktop-app" },
			{
				...INPUT,
				changes: [
					{ content: "DROP TABLE notes;\n", path: "migrations/0002_x.sql" },
				],
			},
			null,
			"PATH_NOT_ALLOWED",
		],
		[
			"a desktop project deletes a frozen migration file",
			{ framework: "desktop-app" },
			{
				...INPUT,
				changes: [{ delete: true, path: "migrations/0001_init.sql" }],
			},
			null,
			"PATH_NOT_ALLOWED",
		],
		[
			"a delete names a file that the saved version does not hold",
			{},
			{ ...INPUT, changes: [{ delete: true, path: "src/new.ts" }] },
			{},
			"FILE_NOT_FOUND",
		],
	];

	it.each(
		REFUSED_CALLS,
	)("refuses when %s, commits nothing, and frees the lock", async (_label, state, input, script, code) => {
		const { inserted, sandboxes, service, turnLock } = await setup(state);
		if (script !== null) {
			scriptCall(sandboxes, script);
		}

		expect(await errorCodeOf(service.apply(SCOPE, input))).toBe(code);

		expect(inserted).toEqual([]);
		expect(
			commandLinesOf(sandboxes).some((line) => line.includes(" commit ")),
		).toBe(false);
		// The call gave its lock back, and a refused acquire left the turn's lock alone.
		expect(await turnLock.holder("p-1")).toBe(
			state.lockedByTurn ? "turn-9" : null,
		);
	});

	// A check-pass refusal wrote nothing, so an undo there would restore or delete files of a failed turn.
	it.each([
		["check", 45, []],
		["apply", 46, UNDO_LINES],
	])("answers PATH_NOT_ALLOWED when the %s pass refuses a path, and undoes only an apply pass", async (_pass, writeExitCode, undoLines) => {
		const { inserted, sandboxes, service } = await setup();
		scriptCall(sandboxes, { writeExitCode });

		expect(await errorCodeOf(service.apply(SCOPE, INPUT))).toBe(
			"PATH_NOT_ALLOWED",
		);

		const lines = commandLinesOf(sandboxes);
		const scriptIndex = lines.findIndex((line) => line.startsWith("bash "));
		expect(lines.slice(scriptIndex + 1)).toEqual(undoLines);
		expect(inserted).toEqual([]);
	});

	it("commits exactly the given paths as an mcp version and frees the lock", async () => {
		const { inserted, sandboxes, service, turnLock } = await setup();
		scriptCall(sandboxes);

		expect(await service.apply(SCOPE, INPUT)).toEqual({ headSha: NEW_SHA });

		const lines = commandLinesOf(sandboxes);
		// Files of a failed turn can wait in the worktree: never `add -A`, and literal paths only.
		expect(lines.filter((line) => / add /.test(line))).toEqual([
			expect.stringMatching(
				/ --literal-pathspecs add -- src\/app\.tsx src\/new\.ts$/,
			),
		]);
		expect(inserted).toEqual([
			expect.objectContaining({
				chatId: null,
				message: "Add b",
				messageId: expect.stringMatching(/^mcp-/),
				source: "mcp",
				turnId: null,
			}),
		]);
		expect(await turnLock.holder("p-1")).toBeNull();
	});

	it("puts HEAD and the changed paths back when both pushes fail", async () => {
		const { inserted, sandboxes, service, turnLock } = await setup();
		scriptCall(sandboxes, { pushFails: true });

		await expect(service.apply(SCOPE, INPUT)).rejects.toBeInstanceOf(
			CommitTurnError,
		);

		expect(commandLinesOf(sandboxes).slice(-3)).toEqual(UNDO_LINES);
		expect(inserted).toEqual([]);
		expect(await turnLock.holder("p-1")).toBeNull();
	});
});

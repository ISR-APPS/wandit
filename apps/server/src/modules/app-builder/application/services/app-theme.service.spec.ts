import { ConflictException } from "@nestjs/common";
import {
	APP_THEME_TEMPLATE_SELECTION,
	type AppThemeFile,
	buildAppThemeFile,
	type PutAppThemeBody,
	type PutAppThemeResponse,
} from "@wandit/contracts/v2/app-theme";
import { describe, expect, it } from "vitest";

import type { ProjectScope } from "../../../projects/domain/project-scope";
import { fallbackThemeSelection } from "../../domain/app-theme-deal";
import type { GitFileReader, GitStore } from "../../domain/ports/git-store";
import type {
	SandboxCreateOptions,
	SandboxExecResult,
} from "../../domain/ports/sandbox-provider";
import type {
	AppCommitRow,
	NewAppCommit,
	ScopedAppProject,
} from "../../infrastructure/persistence/app-commits.repository";
import type { BuilderTurnRow } from "../../infrastructure/persistence/builder-turns.repository";
import { FakeTurnLock } from "../../infrastructure/redis/fake-turn-lock";
import {
	APP_THEME_FILE_PATH,
	appThemeFileText,
	readAppThemeFile,
	writeAppThemeFile,
} from "../../infrastructure/sandbox/app-theme-file";
import { FakeSandboxProvider } from "../../infrastructure/sandbox/fake-sandbox.provider";
import { AppThemeService } from "./app-theme.service";

const SCOPE: ProjectScope = { kind: "personal", userId: "user-1" };
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

/** The theme.json in the sandbox before a save: card 1 of the deal, as the pre-turn fallback writes it. */
const PREVIOUS = buildAppThemeFile({
	origin: "host",
	selection: fallbackThemeSelection("p-1"),
});

/** The same look in dark mode: the body of one Save click. */
const BODY: PutAppThemeBody = {
	expectedHeadSha: HEAD,
	selection: { ...PREVIOUS.selection, mode: "dark" },
};

/** The project state of one case. Every field has a default that lets a save pass. */
type ProjectState = {
	/** True when a turn holds the project lock before the save. */
	lockedByTurn?: boolean;
	/** True when a turn of the project waits for a user answer. */
	turnWaits?: boolean;
	/** "none": the project has no running sandbox. */
	sandbox?: "running" | "none";
	/** The theme.json that code.storage holds at the stored head. */
	storedTheme?: AppThemeFile;
	/** The `template_version` of the project row. Default: "web-app@1.1.0". */
	templateVersion?: string;
	/** True when another writer moved the stored `main` head, so the head CAS of a commit fails. */
	headCasFails?: boolean;
};

/** How the commit of a save fails. "push": both pushes fail. "head-cas": the push works, and the head CAS fails. */
type CommitFailure = "push" | "head-cas";

async function setup(state: ProjectState = {}) {
	const sandboxes = new FakeSandboxProvider();
	if (state.sandbox !== "none") {
		const sandbox = await sandboxes.getOrCreate("p-1", CREATE_OPTIONS);
		await writeAppThemeFile(sandbox, PREVIOUS);
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
			templateVersion: state.templateVersion ?? PROJECT.templateVersion,
		}),
		insert: async (row: NewAppCommit): Promise<AppCommitRow> => {
			inserted.push(row);
			return { ...row, createdAt: new Date(0), id: "row-1" };
		},
		upsertBranchHead: async () => !state.headCasFails,
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
	// code.storage holds the stored theme only at the stored head.
	const gitFiles: GitFileReader = {
		readFile: async (_projectId, ref, path) =>
			ref === HEAD &&
			path === APP_THEME_FILE_PATH &&
			state.storedTheme !== undefined
				? new TextEncoder().encode(appThemeFileText(state.storedTheme))
				: null,
	};
	const turns = {
		findWaitingForUser: async () =>
			// SAFETY: the service reads only whether a row exists.
			state.turnWaits ? ({ id: "turn-8" } as BuilderTurnRow) : null,
	};
	const service = new AppThemeService(
		appCommits,
		sandboxes,
		turnLock,
		gitStore,
		gitFiles,
		{ putPatch: async () => undefined },
		turns,
		{ scheduleIfLinked: async () => undefined },
	);
	return { inserted, sandboxes, service, turnLock };
}

/**
 * Scripts the git answers of one save: the HEAD check, then the 9 commands of `commitTurn`.
 * A failed push answers twice, because `commitTurn` retries the push once. The reset of the undo follows.
 * A failed head CAS adds the ancestor check of `commitTurn`, which finds a diverged head.
 */
function scriptSave(
	sandboxes: FakeSandboxProvider,
	options: { sandboxHead?: string; failure?: CommitFailure } = {},
): void {
	sandboxes.respondTo("git", {
		...OK,
		stdout: `${options.sandboxHead ?? HEAD}\n`,
	});
	sandboxes.respondTo("git", OK); // add
	sandboxes.respondTo("git", { ...OK, stdout: "Add the hero section\n" }); // log
	sandboxes.respondTo("git", OK); // commit
	sandboxes.respondTo("git", OK); // tag -f
	sandboxes.respondTo("git", { ...OK, stdout: `${NEW_SHA}\n` }); // rev-parse HEAD
	sandboxes.respondTo("git", { ...OK, stdout: `${HEAD}\n` }); // rev-parse HEAD~1
	sandboxes.respondTo("git", {
		...OK,
		stdout: `1\t1\t${APP_THEME_FILE_PATH}\n`,
	}); // numstat
	sandboxes.respondTo("git", {
		...OK,
		stdout: `diff --git a/${APP_THEME_FILE_PATH}\n`,
	}); // show
	if (options.failure === "push") {
		sandboxes.respondTo("git", { ...OK, exitCode: 1 }); // push
		sandboxes.respondTo("git", { ...OK, exitCode: 1 }); // push retry
		sandboxes.respondTo("git", OK); // reset
		return;
	}
	sandboxes.respondTo("git", OK); // push
	if (options.failure === "head-cas") {
		sandboxes.respondTo("git", { ...OK, exitCode: 1 }); // merge-base --is-ancestor
	}
}

/** Every git command line that the sandbox ran, in order. */
function gitLinesOf(sandboxes: FakeSandboxProvider): string[] {
	return sandboxes.calls
		.filter((call) => call.method === "exec")
		.map((call) => call.detail ?? "");
}

/** The text of theme.json in the running sandbox, or null without a sandbox or a file. */
async function themeTextOf(
	sandboxes: FakeSandboxProvider,
): Promise<string | null> {
	const sandbox = await sandboxes.findRunning("p-1");
	return sandbox === null
		? null
		: ((await readAppThemeFile(sandbox))?.text ?? null);
}

/** The `code` of a 409 answer, or null for any other outcome. */
async function conflictCodeOf(
	answer: Promise<PutAppThemeResponse>,
): Promise<string | null> {
	const failure = await answer.then(
		() => null,
		(error: unknown) => error,
	);
	if (!(failure instanceof ConflictException)) {
		return null;
	}
	const body = failure.getResponse();
	return typeof body === "object" && "code" in body ? String(body.code) : null;
}

describe("AppThemeService.save", () => {
	const REFUSED_SAVES: [
		string,
		ProjectState & { sandboxHead?: string },
		string,
	][] = [
		["a turn holds the lock", { lockedByTurn: true }, "BUILDER_TURN_RUNNING"],
		["a turn waits for the user", { turnWaits: true }, "BUILDER_TURN_WAITING"],
		["no sandbox runs", { sandbox: "none" }, "PREVIEW_NOT_RUNNING"],
		[
			"the sandbox HEAD moved after the GET",
			{ sandboxHead: "d".repeat(40) },
			"THEME_HEAD_MOVED",
		],
	];

	it.each(
		REFUSED_SAVES,
	)("answers 409 when %s, and writes and boots nothing", async (_label, state, code) => {
		const { inserted, sandboxes, service, turnLock } = await setup(state);
		if (state.sandboxHead !== undefined) {
			scriptSave(sandboxes, { sandboxHead: state.sandboxHead });
		}
		const createdBefore = sandboxes.createdCount;

		expect(await conflictCodeOf(service.save(SCOPE, "p-1", BODY))).toBe(code);

		expect(await themeTextOf(sandboxes)).toBe(
			state.sandbox === "none" ? null : appThemeFileText(PREVIOUS),
		);
		expect(inserted).toEqual([]);
		expect(sandboxes.createdCount).toBe(createdBefore);
		// The save gave its lock back, and a refused acquire left the turn's lock alone.
		expect(await turnLock.holder("p-1")).toBe(
			state.lockedByTurn ? "turn-9" : null,
		);
	});

	it("commits only src/styles/theme.json as a theme version", async () => {
		const { inserted, sandboxes, service, turnLock } = await setup();
		scriptSave(sandboxes);

		const answer = await service.save(SCOPE, "p-1", BODY);

		expect(answer.headSha).toBe(NEW_SHA);
		expect(answer.theme).toMatchObject({
			origin: "user",
			selection: { mode: "dark" },
		});
		expect(await themeTextOf(sandboxes)).toBe(appThemeFileText(answer.theme));
		const gitLines = gitLinesOf(sandboxes);
		// Files of a failed turn can wait in the worktree: neither `add -A` nor a commit of the index.
		expect(gitLines.filter((line) => / add /.test(line))).toEqual([
			expect.stringMatching(/ add -- src\/styles\/theme\.json$/),
		]);
		expect(gitLines.find((line) => line.includes(" commit "))).toMatch(
			/ -- src\/styles\/theme\.json$/,
		);
		expect(inserted).toEqual([
			expect.objectContaining({
				message: `Theme: ${PREVIOUS.name}`,
				source: "theme",
			}),
		]);
		expect(await turnLock.holder("p-1")).toBeNull();
	});

	const FAILED_COMMITS: [string, CommitFailure, string | null, boolean][] = [
		// code.storage has no theme commit: the save drops its commit and puts the old file back.
		["both pushes fail", "push", null, true],
		// code.storage holds the commit: a reset would break the next push, so the commit and the file stay.
		[
			"the head CAS fails after the push",
			"head-cas",
			"THEME_HEAD_MOVED",
			false,
		],
	];

	it.each(
		FAILED_COMMITS,
	)("when %s, undoes the save only if the push did not happen", async (_label, failure, code, isUndone) => {
		const { sandboxes, service, turnLock } = await setup({
			headCasFails: failure === "head-cas",
		});
		scriptSave(sandboxes, { failure });

		expect(await conflictCodeOf(service.save(SCOPE, "p-1", BODY))).toBe(code);

		const saved = buildAppThemeFile({
			origin: "user",
			selection: BODY.selection,
		});
		expect(await themeTextOf(sandboxes)).toBe(
			appThemeFileText(isUndone ? PREVIOUS : saved),
		);
		// The undo moves HEAD back to the head that the GET answered, never to another commit.
		expect(
			gitLinesOf(sandboxes).filter((line) => / reset /.test(line)),
		).toEqual(
			isUndone ? [expect.stringMatching(` reset --quiet ${HEAD}$`)] : [],
		);
		expect(await turnLock.holder("p-1")).toBeNull();
	});
});

describe("AppThemeService.get", () => {
	const STORED = buildAppThemeFile({
		origin: "user",
		selection: BODY.selection,
	});
	const TEMPLATE_DEFAULT = buildAppThemeFile({
		origin: "template",
		selection: APP_THEME_TEMPLATE_SELECTION,
	});
	const READS: [string, ProjectState, AppThemeFile, boolean][] = [
		[
			"reads theme.json at the stored head when no sandbox runs",
			{ sandbox: "none", storedTheme: STORED },
			STORED,
			true,
		],
		[
			"answers the template default before web-app@1.1.0",
			{
				sandbox: "none",
				storedTheme: STORED,
				templateVersion: "web-app@1.0.0",
			},
			TEMPLATE_DEFAULT,
			false,
		],
	];

	it.each(READS)("%s", async (_label, state, theme, editable) => {
		const { service } = await setup(state);

		const answer = await service.get(SCOPE, "p-1");

		expect(answer).toEqual({ editable, headSha: HEAD, theme, world: null });
	});
});

import { describe, expect, it } from "vitest";

import type { GitNumstatEntry } from "../modules/app-builder/domain/git-numstat";
import type { SandboxExecResult } from "../modules/app-builder/domain/ports/sandbox-provider";
import type { AppCommitRow } from "../modules/app-builder/infrastructure/persistence/app-commits.repository";
import { FakeTurnLock } from "../modules/app-builder/infrastructure/redis/fake-turn-lock";
import {
	type ApplyStarterTemplateDeps,
	failStarterTemplateApply,
	runApplyStarterTemplate,
} from "./apply-starter-template.runtime";

const PROJECT_ID = "project-1";
const STARTER_TEMPLATE_ID = "crm-pro";
const INPUT = {
	chatId: "chat-1",
	messageId: "message-1",
	projectId: PROJECT_ID,
	starterTemplateId: STARTER_TEMPLATE_ID,
};
const STARTER_SHA = "a".repeat(40);

// One message that the runtime gives to `insertUiMessagesIfAbsent`.
type StoredMessage = Parameters<
	ApplyStarterTemplateDeps["chats"]["insertUiMessagesIfAbsent"]
>[1][number];

// What the real run keeps in Postgres and in the sandbox.
type FakeState = {
	commitCalls: number;
	/** Each sandbox command: the program, then its arguments. */
	execs: string[][];
	noteFailuresLeft: number;
	/** The stored chat messages, by message id. */
	notes: Map<string, StoredMessage>;
	sandboxStarts: number;
	/** `projects.starter_template_id`. */
	starterTemplateId: string | null;
	/** The `app_commits` rows of the project. */
	versions: AppCommitRow[];
};

// One `app_commits` row of `project-1`. An empty `numstat` is a commit that changed no file.
function commitRow(
	source: AppCommitRow["source"],
	sha: string,
	numstat: GitNumstatEntry[] = [
		{ deletions: 0, insertions: 1, path: "STARTER.md" },
	],
): AppCommitRow {
	return {
		chatId: "chat-1",
		createdAt: new Date(0),
		id: `row-${sha}`,
		message: "A version",
		messageId: "message-1",
		numstat,
		organizationId: null,
		parentSha: null,
		patchKey: null,
		projectId: PROJECT_ID,
		restoredFromSha: null,
		sha,
		source,
		turnId: null,
		userId: "user-1",
	};
}

function setup(over?: {
	/** The versions that the project holds before the attempt. */
	versions?: AppCommitRow[];
	/** The text of `manifest.json` in the archive. Absent means a good manifest. */
	manifest?: string;
	/** True makes the sandbox boot throw. */
	sandboxFails?: boolean;
	/** How many note writes throw before one succeeds. */
	noteFailures?: number;
	/** True makes the commit of the archive change no file, as `git commit --allow-empty` permits. */
	archiveChangesNoFile?: boolean;
}) {
	const state: FakeState = {
		commitCalls: 0,
		execs: [],
		noteFailuresLeft: over?.noteFailures ?? 0,
		notes: new Map(),
		sandboxStarts: 0,
		starterTemplateId: STARTER_TEMPLATE_ID,
		versions: over?.versions ?? [],
	};
	const lock = new FakeTurnLock();
	const deps: ApplyStarterTemplateDeps = {
		appCommits: {
			// The same rule as the SQL: a row counts unless its numstat is `[]`.
			hasFileChanges: async () =>
				state.versions.some((row) => JSON.stringify(row.numstat) !== "[]"),
			listByProject: async () => ({ items: state.versions, nextCursor: null }),
		},
		chats: {
			// Insert-if-absent by message id, as the `messages` primary key does.
			insertUiMessagesIfAbsent: async (_chatId, messages) => {
				if (state.noteFailuresLeft > 0) {
					state.noteFailuresLeft -= 1;
					throw new Error("database down");
				}
				for (const message of messages) {
					if (!state.notes.has(message.id)) {
						state.notes.set(message.id, message);
					}
				}
			},
		},
		commit: async (_sandbox, _commitDeps, input) => {
			state.commitCalls += 1;
			const numstat = over?.archiveChangesNoFile
				? []
				: [{ deletions: 0, insertions: 1, path: "STARTER.md" }];
			const commit = commitRow(input.source, STARTER_SHA, numstat);
			state.versions = [commit];
			return {
				commit,
				numstat,
				parentSha: null,
				patchKey: "patch-key",
				sha: STARTER_SHA,
			};
		},
		commitDeps: {
			appCommits: {
				findBranch: async () => null,
				insert: async () => commitRow("starter", STARTER_SHA),
				upsertBranchHead: async () => true,
			},
			githubSync: { scheduleIfLinked: async () => {} },
			gitStore: {
				deleteRepository: async () => {},
				ensureRepository: async () => ({ remoteUrl: "" }),
				issueCredential: async () => ({
					expiresAt: new Date(0),
					password: "",
					remoteUrl: "",
					username: "",
				}),
			},
			putPatch: async () => {},
		},
		lock,
		logger: { error: () => {}, info: () => {}, warn: () => {} },
		projects: {
			clearStarterTemplateId: async () => {
				state.starterTemplateId = null;
			},
		},
		readArchive: async () => new Uint8Array([1]),
		sandboxSessions: { touchActivity: async () => {} },
		scheduleThumbnail: async () => {},
		startSandbox: async () => {
			state.sandboxStarts += 1;
			if (over?.sandboxFails) {
				throw new Error("vendor down");
			}
			return {
				exec: async (command, args): Promise<SandboxExecResult> => {
					state.execs.push([command, ...args]);
					return { exitCode: 0, stderr: "", stdout: "" };
				},
				projectId: PROJECT_ID,
				readFile: async () =>
					new TextEncoder().encode(
						over?.manifest ??
							JSON.stringify({ id: STARTER_TEMPLATE_ID, removed: [] }),
					),
				workspaceDir: "/vercel/sandbox/workspace",
				writeFiles: async () => {},
			};
		},
		turnProjects: {
			findForTurn: async () => ({
				engine: "v2_app",
				framework: "web-app",
				languages: ["en"],
				networkAllowedHosts: [],
				organizationId: null,
				starterTemplateId: state.starterTemplateId,
				suspendedReasonCode: null,
				templateVersion: "web-app@1.1.0",
				userId: "user-1",
			}),
		},
	};
	return { deps, lock, state };
}

// The parts of every stored chat message, in insert order.
function noteParts(state: FakeState) {
	return [...state.notes.values()].flatMap((message) => message.parts);
}

describe("runApplyStarterTemplate", () => {
	it("stores one note and applies the archive one time when attempts repeat after a done commit", async () => {
		const { deps, lock, state } = setup({ noteFailures: 1 });

		// Attempt 1: the commit lands, then the note write fails.
		await expect(runApplyStarterTemplate(deps, INPUT)).rejects.toThrow(
			"database down",
		);
		// The failed attempt must free the project for the retry.
		expect(await lock.holder(PROJECT_ID)).toBeNull();
		// Attempt 2 stores the note. A third run stands for a repeated task run.
		await runApplyStarterTemplate(deps, INPUT);
		const result = await runApplyStarterTemplate(deps, INPUT);

		expect(result).toEqual({ commitSha: STARTER_SHA, outcome: "applied" });
		expect(state.sandboxStarts).toBe(1);
		expect(state.commitCalls).toBe(1);
		expect(noteParts(state)).toEqual([
			expect.objectContaining({
				data: { starterTemplateId: STARTER_TEMPLATE_ID, status: "applied" },
			}),
		]);
		expect(state.starterTemplateId).toBe(STARTER_TEMPLATE_ID);
	});

	it("keeps the files of a project that already has a version, and marks the apply as failed", async () => {
		const { deps, state } = setup({
			noteFailures: 1,
			versions: [commitRow("agent", "b".repeat(40))],
		});

		// Attempt 1: the note write fails. The column must stay set, or the
		// retry skips and the chat gets no note.
		await expect(runApplyStarterTemplate(deps, INPUT)).rejects.toThrow(
			"database down",
		);
		const result = await runApplyStarterTemplate(deps, INPUT);

		expect(result).toEqual({
			outcome: "failed",
			reason: "project_has_versions",
		});
		expect(state.sandboxStarts).toBe(0);
		expect(state.starterTemplateId).toBeNull();
		expect(noteParts(state)).toEqual([
			expect.objectContaining({
				data: { starterTemplateId: STARTER_TEMPLATE_ID, status: "failed" },
			}),
		]);
	});

	it("ends the wait of the web when the archive changes no file, also after a failed attempt", async () => {
		const { deps, state } = setup({
			archiveChangesNoFile: true,
			noteFailures: 1,
		});

		// Attempt 1: the empty commit lands, then the note write fails.
		await expect(runApplyStarterTemplate(deps, INPUT)).rejects.toThrow(
			"database down",
		);
		// Attempt 2 finds the `starter` row. It must not answer `applied`.
		const result = await runApplyStarterTemplate(deps, INPUT);
		const repeated = await runApplyStarterTemplate(deps, INPUT);

		expect(result).toEqual({ outcome: "failed", reason: "empty_archive" });
		expect(repeated).toEqual({ outcome: "skipped", reason: "not_pending" });
		expect(state.commitCalls).toBe(1);
		expect(state.starterTemplateId).toBeNull();
		expect(noteParts(state)).toEqual([
			expect.objectContaining({
				data: { starterTemplateId: STARTER_TEMPLATE_ID, status: "failed" },
			}),
		]);
	});

	it("throws and changes nothing while a turn holds the project lock", async () => {
		const { deps, lock, state } = setup();
		await lock.acquire(PROJECT_ID, "turn-1", 60_000);

		await expect(runApplyStarterTemplate(deps, INPUT)).rejects.toThrow(
			"is held",
		);

		expect(state.sandboxStarts).toBe(0);
		// The release of the attempt must not free the lock of the turn.
		expect(await lock.holder(PROJECT_ID)).toBe("turn-1");
	});

	it.each([
		{
			manifest: JSON.stringify({ id: "other-starter", removed: [] }),
			name: "the id of another starter template",
		},
		{
			manifest: JSON.stringify({
				id: STARTER_TEMPLATE_ID,
				removed: ["../../etc/passwd"],
			}),
			name: "a removed path outside the project",
		},
	])("refuses a manifest with $name before it changes the workspace", async ({
		manifest,
	}) => {
		const { deps, state } = setup({ manifest });

		await expect(runApplyStarterTemplate(deps, INPUT)).rejects.toThrow();

		// Only the /tmp commands ran: no copy into the workspace, no delete in it.
		expect(state.execs.map(([command]) => command)).toEqual([
			"rm",
			"mkdir",
			"tar",
		]);
		expect(state.commitCalls).toBe(0);
	});
});

describe("failStarterTemplateApply", () => {
	it("clears the column and stores the failed note after the last failed attempt", async () => {
		const { deps, lock, state } = setup({ sandboxFails: true });
		await expect(runApplyStarterTemplate(deps, INPUT)).rejects.toThrow(
			"vendor down",
		);

		await failStarterTemplateApply(deps, INPUT);

		expect(await lock.holder(PROJECT_ID)).toBeNull();
		expect(state.starterTemplateId).toBeNull();
		expect(noteParts(state)).toEqual([
			expect.objectContaining({
				data: { starterTemplateId: STARTER_TEMPLATE_ID, status: "failed" },
			}),
		]);
	});

	it("keeps the column and stores the applied note when the commit exists", async () => {
		const { deps, state } = setup({
			versions: [commitRow("starter", STARTER_SHA)],
		});

		await failStarterTemplateApply(deps, INPUT);

		expect(state.starterTemplateId).toBe(STARTER_TEMPLATE_ID);
		expect(noteParts(state)).toEqual([
			expect.objectContaining({
				data: { starterTemplateId: STARTER_TEMPLATE_ID, status: "applied" },
			}),
		]);
	});
});

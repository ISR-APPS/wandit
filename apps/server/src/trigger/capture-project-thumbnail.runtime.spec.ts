import { describe, expect, it } from "vitest";

import type { SandboxExecResult } from "../modules/app-builder/domain/ports/sandbox-provider";
import type { BuilderTurnRow } from "../modules/app-builder/infrastructure/persistence/builder-turns.repository";
import {
	type CaptureProjectThumbnailDeps,
	runCaptureProjectThumbnail,
} from "./capture-project-thumbnail.runtime";

const PROJECT_ID = "project-1";
const COMMIT_SHA = "a".repeat(40);
const INPUT = { commitSha: COMMIT_SHA, projectId: PROJECT_ID };
// The first bytes of a JFIF file: the JPEG magic ff d8 ff, then the APP0 marker.
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

// One byte over the 5 MB cap, with the JPEG magic ff d8 ff in front.
function oversizedJpeg(): Uint8Array {
	const bytes = new Uint8Array(5 * 1024 * 1024 + 1);
	bytes.set([0xff, 0xd8, 0xff]);
	return bytes;
}

// A running turn row of `project-1`.
function activeTurnRow(): BuilderTurnRow {
	return {
		cacheReadTokens: null,
		cacheWriteTokens: null,
		chatId: "chat-1",
		completedAt: null,
		createdAt: new Date(0),
		credits: null,
		error: null,
		failureCode: null,
		failureKind: null,
		failureProvider: null,
		failureProviderMessage: null,
		failureRequestId: null,
		failureSource: null,
		harness: "claude_code",
		id: "turn-1",
		inputCommitSha: null,
		inputTokens: null,
		messageId: "message-1",
		model: null,
		organizationId: null,
		outputCommitSha: null,
		outputTokens: null,
		projectId: PROJECT_ID,
		requestKey: "turn-1",
		runner: "trigger",
		sentryEventId: null,
		sessionId: "session-1",
		spec: { attachments: [], composer: null, message: "hi" },
		startedAt: null,
		status: "running",
		triggerRunId: null,
		turnNumber: 1,
		userId: "user-1",
	};
}

function setup(over?: {
	/** The row `findActiveForProject` answers. */
	activeTurn?: BuilderTurnRow;
	/** The `main` head sha; absent means `COMMIT_SHA`. */
	headSha?: string;
	/** The bytes of the screenshot file in the sandbox. */
	file?: Uint8Array;
	/** The answer of `setPreviewImageUrl`; false means the project is gone. */
	urlWritten?: boolean;
}) {
	const execs: string[][] = [];
	const uploads: string[] = [];
	const urlWrites: string[] = [];
	const deletes: string[] = [];
	const deps: CaptureProjectThumbnailDeps = {
		appCommits: {
			findBranch: async () => ({ headSha: over?.headSha ?? COMMIT_SHA }),
		},
		deleteObject: async (key) => {
			deletes.push(key);
		},
		logger: { error: () => {}, info: () => {}, warn: () => {} },
		projects: {
			setPreviewImageUrl: async (_projectId, url) => {
				urlWrites.push(url);
				return over?.urlWritten ?? true;
			},
		},
		sandboxes: {
			findRunning: async () => ({
				exec: async (command, args): Promise<SandboxExecResult> => {
					execs.push([command, ...args]);
					return { exitCode: 0, stderr: "", stdout: "" };
				},
				projectId: PROJECT_ID,
				readFile: async () => over?.file ?? JPEG_BYTES,
				workspaceDir: "/vercel/sandbox/app",
				writeFiles: async () => {},
			}),
		},
		turnProjects: {
			findForTurn: async () => ({
				engine: "v2_app",
				framework: "web-app",
				languages: ["en"],
				networkAllowedHosts: [],
				organizationId: null,
				suspendedReasonCode: null,
				templateVersion: "web-app@1.0.0",
				userId: "user-1",
			}),
		},
		turns: {
			findActiveForProject: async () => over?.activeTurn ?? null,
		},
		uploadThumbnail: async (key) => {
			uploads.push(key);
		},
	};
	return { deletes, deps, execs, uploads, urlWrites };
}

describe("runCaptureProjectThumbnail", () => {
	it.each([
		{
			name: "a turn is active",
			over: { activeTurn: activeTurnRow() },
			reason: "turn_active",
		},
		{
			name: "the head moved",
			over: { headSha: "b".repeat(40) },
			reason: "head_moved",
		},
	])("skips without a capture when $name", async ({ over, reason }) => {
		const world = setup(over);

		const result = await runCaptureProjectThumbnail(world.deps, INPUT);

		expect(result).toEqual({ outcome: "skipped", reason });
		expect(world.execs).toEqual([]);
		expect(world.uploads).toEqual([]);
		expect(world.urlWrites).toEqual([]);
	});

	it.each([
		{
			file: new TextEncoder().encode("<svg onload=alert(1)>"),
			name: "svg text",
		},
		{ file: oversizedJpeg(), name: "a JPEG over 5 MB" },
	])("refuses $name as not_an_image", async ({ file }) => {
		const world = setup({ file });

		const result = await runCaptureProjectThumbnail(world.deps, INPUT);

		expect(result).toEqual({ outcome: "skipped", reason: "not_an_image" });
		expect(world.uploads).toEqual([]);
		expect(world.urlWrites).toEqual([]);
	});

	it("deletes the uploaded object when the project is gone", async () => {
		const world = setup({ urlWritten: false });

		const result = await runCaptureProjectThumbnail(world.deps, INPUT);

		expect(result).toEqual({ outcome: "skipped", reason: "project_gone" });
		expect(world.uploads).toHaveLength(1);
		expect(world.deletes).toEqual(world.uploads);
	});
});

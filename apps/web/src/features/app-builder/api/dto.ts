/**
 * Data shapes of the V2 app builder workspace, UI side only.
 * Read by every component under features/app-builder and by the services.
 * A shape moves into packages/contracts as a zod schema when its API route
 * lands; this file then re-exports it, like the Code view types.
 */

import type {
	AppLanguage,
	AskUserKind,
	CodeSnapshotResponse,
	ProjectEngine,
	TurnDataParts,
	TurnQuestionOption,
} from "@wandit/contracts";
import type { UIMessage } from "ai";

/** What Wandit builds. Changes the preview frame, the More panels, and the publish targets. */
export type AppProjectKind = "web" | "mobile";

export type AppProject = {
	id: string;
	name: string;
	/** URL slug. Web previews live on `{slug}.wandit.app`. */
	slug: string;
	/** Set at creation from `targetPlatform`. It never changes, so Settings shows it as a badge. */
	kind: AppProjectKind;
	/** Languages the agent builds the app in, from `projects.languages`. Settings lists them read-only. */
	languages: AppLanguage[];
	/** Version of the template the project started from, for example "1.4.0". null until the create flow sets it. */
	templateVersion: string | null;
	/** Builder of the project, from `GET /api/v2/projects/:id`. The Backend group of the More view shows only for `v2_app`. */
	engine: ProjectEngine;
	/** Count of saved versions, from the API. The publish popover shows it as "v{n}". */
	versionNumber: number;
	/** Versions saved after the live commit; every version before the first publish. 0 means the live app is current. */
	unpublishedChanges: number;
	/** False while the project holds only the template. The preview then covers the frame: the build step during a turn, else the waiting note. */
	hasCodeChanges: boolean;
};

/**
 * What a step row of the activity feed shows. Picks the icon and the label.
 * lib/turn-parts.ts maps each harness tool name to one kind.
 */
export type BuilderStepKind =
	| "edit"
	| "explore"
	| "run"
	| "web"
	| "image"
	| "database"
	| "databaseCheck"
	| "deploy"
	| "secret"
	| "network"
	| "guide"
	| "task"
	| "other";

/** Life state of a step row: the tool call runs, ended, failed, or did not run. */
export type BuilderStepState = "running" | "done" | "error" | "skipped";

/** How sure the agent is about a suggestion. Drawn as one, two, or three bars. */
export type BuilderConfidence = "high" | "medium" | "low";

/** One line of a unified diff, without the leading sign. */
export type BuilderDiffLine = {
	kind: "add" | "remove" | "context";
	text: string;
};

/**
 * Custom data parts the builder streams inside an assistant message.
 * `change` marks a saved version. `thought` is one reasoning block. `step`
 * is one row of the activity feed (one tool call, or a run of reads).
 * `question` is one question of the agent. `approval` waits for the user to
 * allow a tool call. `error` is a turn failure. `stopped` marks a turn the
 * user stopped. `receipt` is the settled cost of a turn. `suggestion` is a
 * next step the user can accept. `diff` shows one changed file.
 */
export type BuilderDataParts = {
	change: { title: string; versionNumber: number };
	thought: {
		/** The reasoning text the model streamed; "" when it sent none. */
		text: string;
		/** Whole seconds of the block, from the `data-thought` part; null in rows stored before it. */
		seconds: number | null;
		/** True while the block still streams in the running turn. */
		isStreaming: boolean;
	};
	step: {
		kind: BuilderStepKind;
		state: BuilderStepState;
		/** File name, host, or skill name shown in the mono chip; null when the label says enough. */
		target: string | null;
		/** The model's own sentence for a command, in the user's language; null when absent. */
		description: string | null;
		/** Technical lines behind the chevron: diff lines, the command and the end of its output, the SQL. */
		detail: BuilderDiffLine[];
		/** True when `set_secret` answered `missing`: the project has no stored value. The row links to the Secrets panel. */
		isSecretMissing?: boolean;
	};
	question: {
		/** Harness call id of the paused tool call; the answer sends it back. */
		toolCallId: string;
		/** Question id inside that call, for example `question-0`. */
		questionId: string;
		question: string;
		/** Picks the tray body: chips, world cards, an upload zone, or the textarea only. */
		kind: AskUserKind;
		/** One short line under the question, or null. */
		helper: string | null;
		/** Upload limit of an `attachments` question; null means the tray default. */
		maxFiles: number | null;
		options: TurnQuestionOption[];
		/** True while no reply follows the question and no turn runs. The tray shows it. */
		isOpen: boolean;
		/** True once a later reply exists. The thread then shows the question with a check. */
		isAnswered: boolean;
	};
	approval: {
		/** Id the harness issued for the pending call; the answer sends it back. */
		approvalId: string;
		/** Host tool that waits, for example "request_network_host". */
		toolName: string;
		/** JSON text of the tool call input, as the harness reported it. */
		input: string;
		/** null while the approval is open or unknown after a reload. */
		decision: "approved" | "denied" | null;
		/** false once a later user turn answered the card. */
		isOpen: boolean;
	};
	/** The `data-turn-error` payload as the stream sends it. */
	error: { code: string; message: string; retryable: boolean };
	/** The `data-turn-done` status of a turn the user stopped. */
	stopped: { status: "canceled" };
	receipt: {
		/** Whole credits, rounded up from the centi-credits the stream sends. */
		credits: number;
		/** null until `data-turn-done` brings the settled receipt. */
		modelId: string | null;
		inputTokens: number;
		outputTokens: number;
		/** Prompt tokens the model read from its cache. Not part of `inputTokens`. */
		cacheReadTokens: number;
		/** Prompt tokens the model wrote to its cache. Not part of `inputTokens`. */
		cacheWriteTokens: number;
	};
	suggestion: { title: string; body: string; confidence: BuilderConfidence };
	diff: { path: string; lines: BuilderDiffLine[] };
};

/** Fields of an assistant message outside its parts. The AI SDK carries them as `message.metadata`. */
export type BuilderMessageMetadata = {
	/** Prompts the user can send with one click, shown under the message. */
	followUps?: string[];
};

/** One chat message in the AI SDK shape, so `useChat` can replace the mock later. */
export type BuilderMessage = UIMessage<
	BuilderMessageMetadata,
	BuilderDataParts
>;

/** A message part of the builder. Same union the AI SDK gives for BuilderMessage. */
export type BuilderMessagePart = BuilderMessage["parts"][number];

/**
 * The real V2 message shape: no metadata, and the `data-*` parts the turn
 * stream sends (contracts `v2/turns.ts`). The cards stay on `BuilderMessage`;
 * `lib/turn-parts.ts` maps `TurnMessage` to it.
 */
export type TurnMessage = UIMessage<never, TurnDataParts>;

/** One part of a real V2 message: text, file, reasoning, or a `data-*` card. */
export type TurnMessagePart = TurnMessage["parts"][number];

/** A folder or a file of the sandbox worktree, for the Code view tree. */
export type { CodeTreeNode } from "@wandit/contracts";

/**
 * The Code view tree, the branch, and the file it opens first, as
 * `GET /api/v2/projects/:id/code` answers them. The prefetched `files` of
 * that answer go into the file query cache instead.
 */
export type CodeSnapshot = Omit<CodeSnapshotResponse, "files">;

/**
 * What the Code view shows for one path. `path` is relative to the
 * worktree root, for example `src/routes/index.tsx`. `size` is in bytes.
 * `missing` also covers a path the API refuses, like `.env`.
 */
export type CodeFile =
	| { kind: "text"; path: string; content: string; size: number }
	| { kind: "binary"; path: string; size: number }
	| { kind: "tooLarge"; path: string }
	| { kind: "missing"; path: string };

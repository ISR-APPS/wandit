/**
 * Data shapes of the V2 app builder workspace, UI side only.
 * Read by every component under features/app-builder and by the services.
 * A shape moves into packages/contracts as a zod schema when its API route
 * lands; this file then re-exports it, like the Code view types.
 */

import type {
	AskUserKind,
	CodeSnapshotResponse,
	ProjectEngine,
	TurnDataParts,
	TurnQuestionOption,
	TurnSummaryData,
} from "@wandit/contracts";
import type { UIMessage } from "ai";

import type { MorePanel } from "../lib/constants";

/** What Wandit builds. Changes the preview frame, the More panels, and the publish targets. */
export type AppProjectKind = "web" | "mobile";

export type AppProject = {
	id: string;
	name: string;
	/** URL slug. Web previews live on `{slug}.wandit.app`. */
	slug: string;
	description: string;
	kind: AppProjectKind;
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

/**
 * The part of the app that an edit changes, in plain words for the chat
 * status line, for example "styles" for `global.css`. lib/turn-parts.ts
 * reads it from the file path; "code" is the fallback.
 */
export type BuilderEditArea =
	| "styles"
	| "pages"
	| "components"
	| "texts"
	| "images"
	| "database"
	| "settings"
	| "code";

/** One line of a unified diff, without the leading sign. */
export type BuilderDiffLine = {
	kind: "add" | "remove" | "context";
	text: string;
};

/**
 * Custom data parts of an assistant message, made by lib/turn-parts.ts.
 * `thought`, `step`, and `note` are the activity of the turn: the details
 * panel shows them, the production chat does not. `summary` gives the work
 * time and the changed files. `question` is one question of the agent.
 * `approval` waits for the user to allow a tool call. `error` is a turn
 * failure. `receipt` is the settled cost of a turn.
 */
export type BuilderDataParts = {
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
		/** Technical lines behind the chevron: diff lines, the command, the SQL. */
		detail: BuilderDiffLine[];
		/** Part of the app an edit changes, from the file path; null for a step that is not an edit. */
		area: BuilderEditArea | null;
		/**
		 * Image the step read or made: a `data:` URL for a read of an image
		 * file, the https URL for a generated image. Null for other steps.
		 */
		imageUrl: string | null;
	};
	/**
	 * Text the agent wrote between its steps, for example "Now the texts…".
	 * Only the text after the last step is the final answer; it stays a
	 * `text` part. While the turn runs, every text is a note.
	 */
	note: { text: string };
	/** The `data-turn-summary` payload: work time in whole seconds and the changed files. */
	summary: TurnSummaryData;
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
	receipt: {
		/** Whole credits, rounded up from the centi-credits the stream sends. */
		credits: number;
		/** null until `data-turn-done` brings the settled receipt. */
		modelId: string | null;
		inputTokens: number;
		outputTokens: number;
	};
};

/** One chat message in the AI SDK shape, as lib/turn-parts.ts maps it from a `TurnMessage`. */
export type BuilderMessage = UIMessage<never, BuilderDataParts>;

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

export type BuilderThread = {
	projectId: string;
	messages: BuilderMessage[];
	/** Credits one more turn costs, whole credits. Shown in the composer as an estimate. */
	turnEstimateCredits: number;
	/** Screen or element the next turn targets, or null. The preview sets it on a selection. */
	focusLabel: string | null;
};

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

/** Data of the Sign-in panel. The mock store answers it; the methods themselves are fixed UI. */
export type SignInSummary = {
	/** Users who signed up in the generated app. */
	userCount: number;
};

export type ProjectDomain = {
	host: string;
	/** `wandit` is the free subdomain. `custom` is a domain the user owns. */
	kind: "wandit" | "custom";
	status: "live" | "verifying";
	/** CNAME target the user must set while the status is `verifying`. */
	cnameTarget: string | null;
};

export type StoreListingItemId =
	| "appIcon"
	| "appName"
	| "description"
	| "screenshots"
	| "privacyUrl"
	| "ageRating";

export type StoreListingItem = {
	id: StoreListingItemId;
	done: boolean;
	/** Value or hint shown at the end of the row, as the store tooling reports it. */
	detail: string;
};

export type AppStoresSummary = {
	ios: {
		status: "readyToSubmit" | "notSetUp";
		bundleId: string;
		latestBuild: number;
		testflightTesters: number;
	};
	android: {
		status: "readyToSubmit" | "notSetUp";
	};
	listing: StoreListingItem[];
};

export type CollaboratorRole = "owner" | "editor" | "viewer";

export type Collaborator = {
	id: string;
	name: string;
	/** Email or job title, shown under the name. */
	subtitle: string;
	role: CollaboratorRole;
	/** True while the invitation email is not accepted. */
	pending: boolean;
};

export type EnvironmentVariable = {
	name: string;
	/** null for a secret. The panel shows dots instead. */
	value: string | null;
	/** More panel that wrote the variable, or null when the user added it. */
	setBy: MorePanel | null;
	/** True when the app can read it in the browser. */
	isPublic: boolean;
};

export type ProjectSettings = {
	collaborators: Collaborator[];
	/** Seats the plan allows, including the owner. */
	collaboratorLimit: number;
	environmentVariables: EnvironmentVariable[];
};

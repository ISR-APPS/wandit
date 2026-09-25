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
	/** Builder of the project, from `GET /api/v2/projects/:id`. The Cloud tab shows only for `v2_app`. */
	engine: ProjectEngine;
	/** Highest version number so far. The publish popover shows it as "v{n}". */
	versionNumber: number;
	/** Builder turns since the last publish. 0 means the live app is current. */
	unpublishedChanges: number;
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
 * allow a tool call. `error` is a turn failure. `receipt` is the settled
 * cost of a turn. `suggestion` is a next step the user can accept. `diff`
 * shows one changed file.
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
		/** Technical lines behind the chevron: diff lines, the command, the SQL. */
		detail: BuilderDiffLine[];
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
	receipt: {
		/** Whole credits, rounded up from the centi-credits the stream sends. */
		credits: number;
		/** null until `data-turn-done` brings the settled receipt. */
		modelId: string | null;
		inputTokens: number;
		outputTokens: number;
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

export type BackendTable = {
	name: string;
	columns: string[];
	rowCount: number;
};

export type BackendFunction = {
	name: string;
	/** Who calls it, as the generated backend describes it. */
	trigger: string;
	callsToday: number;
};

export type BackendSummary = {
	/** Rows of every table together. */
	rowCount: number;
	/** Database size in megabytes. */
	sizeMb: number;
	/** Storage bucket size in gigabytes. */
	storageGb: number;
	/** What the bucket holds, as the agent described it. */
	storageNote: string;
	functionCallsToday: number;
	tables: BackendTable[];
	functions: BackendFunction[];
};

export type SignInMethodId =
	| "phoneOtp"
	| "emailPassword"
	| "google"
	| "magicLink";

export type SignInMethod = {
	id: SignInMethodId;
	enabled: boolean;
};

export type SignInSummary = {
	userCount: number;
	methods: SignInMethod[];
};

export type PaymentProduct = {
	id: string;
	name: string;
	billing: { kind: "recurring"; days: number } | { kind: "oneTime" };
	priceDzd: number;
};

export type PaymentsSummary = {
	/** null until the user connects a provider. */
	provider: {
		name: string;
		/** Merchant account name at the provider. */
		account: string;
		/** Card networks the provider accepts, as the provider names them. */
		cards: string;
		mode: "test" | "live";
	} | null;
	products: PaymentProduct[];
	collectedDzd: number;
	/** Month of the collected amount, as an ISO `YYYY-MM` string. */
	collectedMonth: string;
	paymentCount: number;
	refundCount: number;
	webhookPath: string;
	webhookReceiving: boolean;
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

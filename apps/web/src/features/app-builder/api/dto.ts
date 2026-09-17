/**
 * Data shapes of the V2 app builder workspace, UI side only.
 * Read by every component under features/app-builder and by the mock services.
 * The backend session moves these shapes into packages/contracts as zod
 * schemas; this file then becomes z.infer re-exports.
 */

import type { TurnDataParts } from "@wandit/contracts";
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
	/** Highest version number so far. The publish popover shows it as "v{n}". */
	versionNumber: number;
	/** Builder turns since the last publish. 0 means the live app is current. */
	unpublishedChanges: number;
};

/** One line of a build progress card. */
export type BuilderProgressStep = {
	id: string;
	label: string;
	state: "done" | "active" | "pending";
};

/** One row of a thinking trace: what the agent did before it answered. */
export type BuilderTraceStep = {
	label: string;
	/** Short count at the end of the row, for example "5 tables", or null. */
	detail: string | null;
};

/** One tool call of a turn, shown as a row of the tool chips block. */
export type BuilderToolCall = {
	/** Picks the row icon: a spark, a pen, a terminal, or a file. */
	kind: "think" | "write" | "run" | "read";
	/** What the agent did, for example "Write 184 lines". */
	label: string;
	/** File, command, or note the call worked on. Shown in a mono chip. */
	target: string;
};

/** A file the turn changed, with its added and removed line counts. */
export type BuilderFileChange = {
	path: string;
	added: number;
	removed: number;
};

/** How sure the agent is about a suggestion. Drawn as one, two, or three bars. */
export type BuilderConfidence = "high" | "medium" | "low";

/** One line of a unified diff, without the leading sign. */
export type BuilderDiffLine = {
	kind: "add" | "remove" | "context";
	text: string;
};

/**
 * Custom data parts the builder streams inside an assistant message.
 * `change` marks a saved version. `progress` is the live task list of a turn.
 * `trace` is what the agent did before it answered. `tools` lists the tool
 * calls and the changed files of a turn. `question` waits for the user.
 * `approval` waits for the user to allow a tool call. `error` is a turn
 * failure. `receipt` is the settled cost of a turn. `suggestion` is a next
 * step the user can accept. `diff` shows one changed file.
 */
export type BuilderDataParts = {
	change: { title: string; versionNumber: number };
	progress: { title: string; percent: number; steps: BuilderProgressStep[] };
	trace: { seconds: number; steps: BuilderTraceStep[] };
	tools: { calls: BuilderToolCall[]; files: BuilderFileChange[] };
	/** `answer` is null while the question is open. The next user message closes it. */
	question: { question: string; options: string[]; answer: string | null };
	approval: {
		/** Id the harness issued for the pending call; the answer sends it back. */
		approvalId: string;
		/** Harness name of the tool that waits, for example "Bash". */
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

/** A folder or a file of the project repository, for the Code view tree. */
export type CodeTreeNode =
	| { kind: "folder"; path: string; name: string; children: CodeTreeNode[] }
	| { kind: "file"; path: string; name: string };

export type CodeFile = {
	/** Path from the repository root, for example `src/server/payments/checkout.ts`. */
	path: string;
	content: string;
};

export type CodeSnapshot = {
	/** Git branch the sandbox works on. */
	branch: string;
	tree: CodeTreeNode[];
	/** Path of the file the Code view opens first. */
	defaultFilePath: string;
};

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

export type AppVersion = {
	number: number;
	/** One line the agent wrote when it saved the version. */
	summary: string;
	/** ISO 8601 date-time string, as the API sends it. */
	createdAt: string;
	isLive: boolean;
};

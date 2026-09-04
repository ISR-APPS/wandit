import type { aiUsageOperation } from "@wandit/db/schema/credits";

export type AiUsageOperation = (typeof aiUsageOperation.enumValues)[number];
export type PricingMode = "fixed" | "measured" | "per_minute" | "token";

// All credit amounts in this registry are integer centi-credits (cc):
// 1 credit = 100 cc. The API/UI divide by 100 at their own boundary.
//
// Measured reserve floors are derived from the seed catalog at $0.04/credit:
// - image 350 cc: google/gemini-3-pro-image default $0.1344 -> 336 cc.
// - video 550 cc: retained for historical reservations; connector children
//   override this with the connector reserve floor and settle at provider cost 0.
// - transcription 25 cc: openai/whisper-1 $0.0001/s x 60 s -> 15 cc.
// - connector 1 cc: the MCP render runs on the user's own Higgsfield
//   subscription, so only our LLM tokens around it cost anything.
// The size/duration/mode-aware estimate raises the reserve above the floor.
export const IMAGE_RESERVE_FLOOR_CREDITS = 350;
export const VIDEO_RESERVE_FLOOR_CREDITS = 550;
export const MARKETING_RESERVE_FLOOR_CREDITS = 150;
export const CONNECTOR_RESERVE_FLOOR_CREDITS = 1;
export const TRANSCRIPTION_RESERVE_FLOOR_CREDITS = 25;
export const TRANSCRIPTION_MAX_DURATION_SECONDS = 5 * 60;
// Lead scrape is a value-priced product: 0.05 credits per delivered lead,
// never less than 1 credit per scrape (ruling: not measured from Serper).
export const LEAD_SCRAPE_CREDITS_PER_LEAD = 5;
export const LEAD_SCRAPE_MINIMUM_CREDITS = 100;

type ParentChildRules = {
	allowedParentOperations: readonly AiUsageOperation[];
	allowedChildOperations: readonly AiUsageOperation[];
	rootAllowed: boolean;
};

export type TokenOperationPricing = ParentChildRules & {
	mode: "token";
	reserveFloorCredits: number;
};

export type FixedOperationPricing = ParentChildRules & {
	creditsPerUnit: number;
	/** Smallest charge per settled event (optional; defaults to 0). */
	minimumCredits?: number;
	mode: "fixed";
	reserveFloorCredits: number;
	unit: "adjustment" | "image" | "lead" | "operation";
};

/**
 * Legacy mode kept only so reservation snapshots written before measured
 * billing still settle under their reservation-time terms.
 */
export type PerMinuteOperationPricing = ParentChildRules & {
	creditsPerMinute: number;
	maxDurationSeconds: number;
	minimumCredits: number;
	mode: "per_minute";
	reserveFloorCredits: number;
};

/**
 * Billed from real provider cost / USD-per-credit. The floor sizes the
 * reserve when no local price estimate exists; settlement charges the local
 * estimate and gateway reconciliation corrects it to the exact cost.
 */
export type MeasuredOperationPricing = ParentChildRules & {
	maxDurationSeconds?: number;
	mode: "measured";
	reserveFloorCredits: number;
	unit: "image" | "operation" | "video";
};

export type OperationPricing =
	| FixedOperationPricing
	| MeasuredOperationPricing
	| PerMinuteOperationPricing
	| TokenOperationPricing;

const NO_PARENTS = [] as const;
const NO_CHILDREN = [] as const;

/**
 * The one product-owned price registry. Provider model prices report cost;
 * this registry reports customer credits and legal nesting. `topup_adjust` is
 * an internal zero-price reconciliation event, not an AI invocation.
 */
export const OPERATION_REGISTRY = {
	chat: {
		allowedChildOperations: [
			"page_build",
			"image",
			"marketing",
			"connector",
			"lead_scrape",
		],
		allowedParentOperations: NO_PARENTS,
		mode: "token",
		reserveFloorCredits: 10,
		rootAllowed: true,
	},
	connector: {
		allowedChildOperations: ["image", "video"],
		allowedParentOperations: ["chat"],
		mode: "measured",
		reserveFloorCredits: CONNECTOR_RESERVE_FLOOR_CREDITS,
		rootAllowed: true,
		unit: "operation",
	},
	image: {
		allowedChildOperations: NO_CHILDREN,
		allowedParentOperations: ["chat", "page_build", "connector"],
		mode: "measured",
		reserveFloorCredits: IMAGE_RESERVE_FLOOR_CREDITS,
		rootAllowed: true,
		unit: "image",
	},
	lead_scrape: {
		allowedChildOperations: NO_CHILDREN,
		allowedParentOperations: ["chat"],
		creditsPerUnit: LEAD_SCRAPE_CREDITS_PER_LEAD,
		minimumCredits: LEAD_SCRAPE_MINIMUM_CREDITS,
		mode: "fixed",
		reserveFloorCredits: LEAD_SCRAPE_MINIMUM_CREDITS,
		rootAllowed: true,
		unit: "lead",
	},
	marketing: {
		allowedChildOperations: NO_CHILDREN,
		allowedParentOperations: ["chat"],
		mode: "token",
		reserveFloorCredits: MARKETING_RESERVE_FLOOR_CREDITS,
		rootAllowed: true,
	},
	page_build: {
		allowedChildOperations: ["image"],
		allowedParentOperations: ["chat"],
		mode: "token",
		reserveFloorCredits: 1000,
		rootAllowed: true,
	},
	topup_adjust: {
		allowedChildOperations: NO_CHILDREN,
		allowedParentOperations: NO_PARENTS,
		creditsPerUnit: 0,
		mode: "fixed",
		reserveFloorCredits: 0,
		rootAllowed: true,
		unit: "adjustment",
	},
	transcription: {
		allowedChildOperations: NO_CHILDREN,
		allowedParentOperations: NO_PARENTS,
		maxDurationSeconds: TRANSCRIPTION_MAX_DURATION_SECONDS,
		mode: "measured",
		reserveFloorCredits: TRANSCRIPTION_RESERVE_FLOOR_CREDITS,
		rootAllowed: true,
		unit: "operation",
	},
	video: {
		allowedChildOperations: NO_CHILDREN,
		allowedParentOperations: ["connector"],
		mode: "measured",
		reserveFloorCredits: VIDEO_RESERVE_FLOOR_CREDITS,
		rootAllowed: true,
		unit: "video",
	},
} as const satisfies Record<AiUsageOperation, OperationPricing>;

export function operationPricing(
	operation: AiUsageOperation,
): OperationPricing {
	return OPERATION_REGISTRY[operation];
}

// Per-event settlement sanity ceiling (guards pricing-unit bugs, not honest
// runs): 200 credits ≈ $8 provider cost at the $0.04/credit anchor.
export const EVENT_CEILING_FLOOR_CC = 20_000;
export const EVENT_CEILING_MULTIPLIER = 25;

// Operations whose single legitimate run can cost far more than the default
// floor. Token operations reserve a single-call input quote, not a run
// estimate: a 64-step page build with helper calls billed into the parent can
// legitimately exceed $10 of provider cost (page_build: 250_000 cc = $100;
// chat: 50_000 cc = $20). Connector media generations keep their own floors.
const EVENT_CEILING_FLOOR_OVERRIDES_CC: Partial<
	Record<AiUsageOperation, number>
> = {
	chat: 50_000,
	connector: 100_000,
	page_build: 250_000,
	video: 100_000,
};

/**
 * Largest finalCredits a settlement/reconciliation may debit for one event.
 * A breach never discards a finished deliverable: the debit is capped at the
 * ceiling and the event carries a `sanityCeiling` snapshot marker for admin
 * review (see MeteringService.applyCreditAdjustment).
 */
export function maxFinalCreditsCeiling(
	operation: AiUsageOperation,
	reservedCredits: number,
): number {
	const floor =
		EVENT_CEILING_FLOOR_OVERRIDES_CC[operation] ?? EVENT_CEILING_FLOOR_CC;

	return Math.max(floor, reservedCredits * EVENT_CEILING_MULTIPLIER);
}

/** Product price of a lead scrape: per delivered lead, never below 1 credit. */
export function leadScrapeCredits(leads: number): number {
	const pricing = OPERATION_REGISTRY.lead_scrape;

	if (!Number.isSafeInteger(leads) || leads < 0) {
		throw new Error("Lead count must be a non-negative integer");
	}

	return Math.max(pricing.minimumCredits, leads * pricing.creditsPerUnit);
}

export function assertTranscriptionDurationAllowed(
	durationSeconds: number,
): void {
	const pricing = OPERATION_REGISTRY.transcription;

	if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
		throw new Error("Transcription duration must be a non-negative number");
	}

	if (durationSeconds > pricing.maxDurationSeconds) {
		throw new Error(
			`Transcription duration exceeds ${pricing.maxDurationSeconds} seconds`,
		);
	}
}

export function canNestOperation(
	parent: AiUsageOperation,
	child: AiUsageOperation,
): boolean {
	const parentAllows = OPERATION_REGISTRY[parent].allowedChildOperations.some(
		(operation) => operation === child,
	);
	const childAllows = OPERATION_REGISTRY[child].allowedParentOperations.some(
		(operation) => operation === parent,
	);

	return parentAllows && childAllows;
}

export function assertOperationParentAllowed(
	operation: AiUsageOperation,
	parentOperation?: AiUsageOperation | null,
): void {
	if (parentOperation == null) {
		if (!OPERATION_REGISTRY[operation].rootAllowed) {
			throw new Error(`${operation} must have a parent usage event`);
		}
		return;
	}

	if (!canNestOperation(parentOperation, operation)) {
		throw new Error(`${operation} cannot be nested under ${parentOperation}`);
	}
}

export type AiInvocationCoverage = {
	billing: // Helper LLM calls bill inside the parent operation (helper_billable).
		| { billedInto: AiUsageOperation; kind: "helper" }
		| { kind: "metered"; operation: AiUsageOperation };
	id: string;
	marker: string;
	source: string;
};

/**
 * Grep-verifiable logical workflow inventory from billing v2 §5.6. The spec
 * checks every entry's marker still exists and every operation is registered.
 */
export const AI_INVOCATION_COVERAGE = [
	{
		billing: { kind: "metered", operation: "chat" },
		id: "ai-stream-chat",
		marker: "new ToolLoopAgent({",
		source: "apps/server/src/modules/ai-chat/agent/chat-agent.ts",
	},
	{
		billing: { kind: "metered", operation: "page_build" },
		id: "site-builder-steps",
		marker: "const agent = new ToolLoopAgent({",
		source:
			"apps/server/src/modules/ai-chat/agent/site-builder/site-builder-agent.ts",
	},
	{
		billing: { kind: "metered", operation: "image" },
		id: "site-builder-image-child",
		marker: "export async function generateBuildImage",
		source:
			"apps/server/src/modules/ai-chat/agent/site-builder/generate-image.ts",
	},
	{
		billing: { kind: "metered", operation: "image" },
		id: "standalone-image",
		marker: "export async function generateStandaloneImage",
		source:
			"apps/server/src/modules/image-generations/application/services/image-generator.ts",
	},
	{
		billing: { kind: "metered", operation: "marketing" },
		id: "marketing",
		marker: "generateMarketingAssetHtml",
		source:
			"apps/server/src/modules/marketing-assets/application/services/marketing-html.ts",
	},
	{
		billing: { kind: "metered", operation: "connector" },
		id: "connector-inline",
		marker: "client.callTool({",
		source:
			"apps/server/src/modules/mcp-connectors/application/services/mcp-chat-tools.service.ts",
	},
	{
		billing: { kind: "metered", operation: "connector" },
		id: "connector-background",
		marker: "const result = await client.callTool({",
		source: "apps/server/src/trigger/run-connector-generation.task.ts",
	},
	{
		billing: { kind: "metered", operation: "lead_scrape" },
		id: "lead-scrape",
		marker: "export const scrapeLeadsTask = task({",
		source: "apps/server/src/trigger/scrape-leads.task.ts",
	},
	{
		billing: { kind: "metered", operation: "transcription" },
		id: "transcription",
		marker: "model.doGenerate({",
		source:
			"apps/server/src/modules/generation/application/services/transcription.service.ts",
	},
	{
		billing: { kind: "metered", operation: "chat" },
		id: "legacy-worker-chat",
		marker: "const result = streamText({",
		source: "apps/worker/src/processors/ai-generation.processor.ts",
	},
	{
		billing: { billedInto: "chat", kind: "helper" },
		id: "project-title-helper",
		marker: "const result = await generateText({",
		source:
			"apps/server/src/modules/projects/application/services/project-title.service.ts",
	},
	{
		billing: { billedInto: "chat", kind: "helper" },
		id: "higgsfield-prompt-refine-helper",
		marker: "const result = await generateText({",
		source:
			"apps/server/src/modules/mcp-connectors/application/services/higgsfield-prompt-refiner.service.ts",
	},
	{
		billing: { billedInto: "chat", kind: "helper" },
		id: "video-director-helper",
		marker: "const result = await generateText({",
		source:
			"apps/server/src/modules/media-generations/application/services/video-director.ts",
	},
	{
		billing: { billedInto: "chat", kind: "helper" },
		id: "chat-tool-call-repair-helper",
		marker: "const result = await generateObject({",
		source: "apps/server/src/modules/ai-chat/agent/chat-agent.ts",
	},
] as const satisfies readonly AiInvocationCoverage[];

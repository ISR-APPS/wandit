import type { aiUsageOperation } from "@wandit/db/schema/credits";

export type AiUsageOperation = (typeof aiUsageOperation.enumValues)[number];
export type PricingMode = "fixed" | "per_minute" | "token";

export const IMAGE_CREDITS_PER_IMAGE = 5;
export const VIDEO_CREDITS_PER_OPERATION = 25;
export const MARKETING_CREDITS_PER_OPERATION = 5;
export const CONNECTOR_CREDITS_PER_OPERATION = 5;
export const LEAD_SCRAPE_CREDITS_PER_OPERATION = 5;
export const TRANSCRIPTION_CREDITS_PER_MINUTE = 1;
export const TRANSCRIPTION_MAX_DURATION_SECONDS = 5 * 60;

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
	mode: "fixed";
	reserveFloorCredits: number;
	unit: "adjustment" | "image" | "operation";
};

export type PerMinuteOperationPricing = ParentChildRules & {
	creditsPerMinute: number;
	maxDurationSeconds: number;
	minimumCredits: number;
	mode: "per_minute";
	reserveFloorCredits: number;
};

export type OperationPricing =
	| FixedOperationPricing
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
			"video",
			"marketing",
			"connector",
			"lead_scrape",
		],
		allowedParentOperations: NO_PARENTS,
		mode: "token",
		reserveFloorCredits: 1,
		rootAllowed: true,
	},
	connector: {
		allowedChildOperations: ["image", "video"],
		allowedParentOperations: ["chat"],
		creditsPerUnit: CONNECTOR_CREDITS_PER_OPERATION,
		mode: "fixed",
		reserveFloorCredits: CONNECTOR_CREDITS_PER_OPERATION,
		rootAllowed: true,
		unit: "operation",
	},
	image: {
		allowedChildOperations: NO_CHILDREN,
		allowedParentOperations: ["chat", "page_build", "connector"],
		creditsPerUnit: IMAGE_CREDITS_PER_IMAGE,
		mode: "fixed",
		reserveFloorCredits: IMAGE_CREDITS_PER_IMAGE,
		rootAllowed: true,
		unit: "image",
	},
	lead_scrape: {
		allowedChildOperations: NO_CHILDREN,
		allowedParentOperations: ["chat"],
		creditsPerUnit: LEAD_SCRAPE_CREDITS_PER_OPERATION,
		mode: "fixed",
		reserveFloorCredits: LEAD_SCRAPE_CREDITS_PER_OPERATION,
		rootAllowed: true,
		unit: "operation",
	},
	marketing: {
		allowedChildOperations: NO_CHILDREN,
		allowedParentOperations: ["chat"],
		creditsPerUnit: MARKETING_CREDITS_PER_OPERATION,
		mode: "fixed",
		reserveFloorCredits: MARKETING_CREDITS_PER_OPERATION,
		rootAllowed: true,
		unit: "operation",
	},
	page_build: {
		allowedChildOperations: ["image", "video"],
		allowedParentOperations: ["chat"],
		mode: "token",
		reserveFloorCredits: 10,
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
		creditsPerMinute: TRANSCRIPTION_CREDITS_PER_MINUTE,
		maxDurationSeconds: TRANSCRIPTION_MAX_DURATION_SECONDS,
		minimumCredits: 1,
		mode: "per_minute",
		reserveFloorCredits: 1,
		rootAllowed: true,
	},
	video: {
		allowedChildOperations: NO_CHILDREN,
		allowedParentOperations: ["chat", "page_build", "connector"],
		creditsPerUnit: VIDEO_CREDITS_PER_OPERATION,
		mode: "fixed",
		reserveFloorCredits: VIDEO_CREDITS_PER_OPERATION,
		rootAllowed: true,
		unit: "operation",
	},
} as const satisfies Record<AiUsageOperation, OperationPricing>;

export function operationPricing(
	operation: AiUsageOperation,
): OperationPricing {
	return OPERATION_REGISTRY[operation];
}

export function fixedOperationCredits(
	operation: AiUsageOperation,
	units = 1,
): number {
	const pricing = operationPricing(operation);

	if (pricing.mode !== "fixed") {
		throw new Error(`${operation} is not fixed-price`);
	}

	if (!Number.isSafeInteger(units) || units <= 0) {
		throw new Error("Fixed-price units must be a positive integer");
	}

	return pricing.creditsPerUnit * units;
}

export function transcriptionCredits(durationSeconds: number): number {
	const pricing = OPERATION_REGISTRY.transcription;

	if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
		throw new Error("Transcription duration must be a non-negative number");
	}

	if (durationSeconds > pricing.maxDurationSeconds) {
		throw new Error(
			`Transcription duration exceeds ${pricing.maxDurationSeconds} seconds`,
		);
	}

	return Math.max(
		pricing.minimumCredits,
		Math.ceil(durationSeconds / 60) * pricing.creditsPerMinute,
	);
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
	billing:
		| { bundledInto: AiUsageOperation; kind: "bundled" }
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
		billing: { kind: "metered", operation: "video" },
		id: "site-builder-video-child",
		marker: "export async function generateBuildVideo",
		source:
			"apps/server/src/modules/ai-chat/agent/site-builder/generate-video.ts",
	},
	{
		billing: { kind: "metered", operation: "image" },
		id: "standalone-image",
		marker: "export async function generateStandaloneImage",
		source:
			"apps/server/src/modules/image-generations/application/services/image-generator.ts",
	},
	{
		billing: { kind: "metered", operation: "video" },
		id: "standalone-animation",
		marker: "runImageAnimation",
		source:
			"apps/server/src/modules/media-generations/application/services/image-animation-runner.ts",
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
		billing: { bundledInto: "chat", kind: "bundled" },
		id: "project-title-bundled",
		marker: "const result = await generateText({",
		source:
			"apps/server/src/modules/projects/application/services/project-title.service.ts",
	},
] as const satisfies readonly AiInvocationCoverage[];

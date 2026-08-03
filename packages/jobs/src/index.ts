// Shared queue contract for API and worker.
//
// The API adds jobs. The worker reads jobs. Both sides must use the same queue
// names, job names, and payload shapes. A typo here can make jobs disappear into
// a queue no worker is listening to.
import type { ComposerMetadata } from "@wandit/contracts";

// Queue for AI chat/page generation work.
export const AI_GENERATION_QUEUE = "ai-generation";
// Queue for future image/video jobs.
export const MEDIA_GENERATION_QUEUE = "media-generation";
// Queue for lead processing jobs.
export const LEAD_PROCESSING_QUEUE = "lead-processing";
// Queue for publishing jobs.
export const PUBLISH_QUEUE = "publish";

// One list used by API and worker to register all queues.
export const queueNames = [
	AI_GENERATION_QUEUE,
	MEDIA_GENERATION_QUEUE,
	LEAD_PROCESSING_QUEUE,
	PUBLISH_QUEUE,
] as const;

// Job names allowed inside the AI generation queue.
export type AiGenerationJobName =
	| "generate-site"
	| "revise-site"
	| "generate-copy";
// Media job names.
export type MediaGenerationJobName = "generate-image" | "generate-video";
// Lead-processing job names.
export type LeadProcessingJobName = "normalize-lead" | "send-lead-notification";
// Publish job names.
export type PublishJobName = "publish-site";

// Payload the API sends to the AI worker.
export interface AiGenerationJobData {
	// Used by credit code to choose the price.
	action: "landingPageGeneration" | "chatMessage";
	// Admission-time billing decision. Optional only for jobs queued before this
	// field existed; workers use their runtime switch for those legacy payloads.
	billingMode?: "enforce" | "off";
	// Worker uses these ids to verify ownership before generating.
	chatId: string;
	// Prompt-box settings from the UI.
	composer?: ComposerMetadata;
	// Stable id shared by BullMQ, Redis events, and assistant message id.
	jobId: string;
	// User message that triggered this job.
	messageId: string;
	// Original user text.
	prompt: string;
	projectId: string;
	// Null only when the explicit local GENERATION_BILLING_MODE=off bypass was
	// active at enqueue time. Enforced jobs must carry their durable reservation.
	// Optional: jobs enqueued before the metering rollout carry no field at all.
	usageEventId?: string | null;
	userId: string;
}

// Future media job payload.
export interface MediaGenerationJobData {
	assetId: string;
	prompt: string;
	projectId: string;
	userId: string;
}

// Lead-processing job payload.
export interface LeadProcessingJobData {
	landingPageId: string;
	leadId: string;
	userId: string;
}

// Publish job payload.
export interface PublishJobData {
	deploymentId: string;
	projectId: string;
	versionId: string;
	slug: string;
}

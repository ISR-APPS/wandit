import type { ComposerMetadata } from "@wandit/contracts";

export const AI_GENERATION_QUEUE = "ai-generation";
export const MEDIA_GENERATION_QUEUE = "media-generation";
export const LEAD_PROCESSING_QUEUE = "lead-processing";
export const PUBLISH_QUEUE = "publish";

export const queueNames = [
	AI_GENERATION_QUEUE,
	MEDIA_GENERATION_QUEUE,
	LEAD_PROCESSING_QUEUE,
	PUBLISH_QUEUE,
] as const;

export type AiGenerationJobName =
	| "generate-site"
	| "revise-site"
	| "generate-copy";
export type MediaGenerationJobName = "generate-image" | "generate-video";
export type LeadProcessingJobName = "normalize-lead" | "send-lead-notification";
// Rollback re-runs the same job against an older version; unpublish is a
// direct KV delete in the API, no job.
export type PublishJobName = "publish-site";

export interface AiGenerationJobData {
	action: "landingPageGeneration" | "chatMessage";
	chatId: string;
	composer?: ComposerMetadata;
	jobId: string;
	messageId: string;
	prompt: string;
	projectId: string;
	userId: string;
}

export interface MediaGenerationJobData {
	assetId: string;
	prompt: string;
	projectId: string;
	userId: string;
}

export interface LeadProcessingJobData {
	landingPageId: string;
	leadId: string;
	userId: string;
}

export interface PublishJobData {
	deploymentId: string;
	projectId: string;
	versionId: string;
	slug: string;
}

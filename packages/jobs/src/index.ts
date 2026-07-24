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
// Queue for custom domain jobs.
export const DOMAINS_QUEUE = "domains";
// Queue for durable payment-order refunds.
export const ORDER_REFUNDS_QUEUE = "order-refunds";

// One list used by API and worker to register all queues.
export const queueNames = [
	AI_GENERATION_QUEUE,
	MEDIA_GENERATION_QUEUE,
	LEAD_PROCESSING_QUEUE,
	PUBLISH_QUEUE,
	DOMAINS_QUEUE,
	ORDER_REFUNDS_QUEUE,
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
// Domain job names.
export type DomainJobName =
	| "domain-purchase"
	| "domain-configure"
	| "domain-renewals"
	| "domain-sync";
// Payment-order refund job names.
export type OrderRefundJobName = "order-refund";

// Payload the API sends to the AI worker.
export interface AiGenerationJobData {
	// Used by credit code to choose the price.
	action: "landingPageGeneration" | "chatMessage";
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

// Domain purchase job payload. Jobs created before money orders existed omit
// paymentSource and therefore remain credits-backed.
export type DomainPurchaseJobData =
	| {
			domainId: string;
			orderId: string;
			paymentSource: "order";
	  }
	| {
			domainId: string;
			orderId?: never;
			paymentSource?: "credits";
	  };

// A refund job is persisted before a money-backed fulfillment is terminalized.
// The order id also scopes the Stripe idempotency key and BullMQ job id.
export interface OrderRefundJobData {
	failureReason: string;
	orderId: string;
}

// Domain configure job payload.
export interface DomainConfigureJobData {
	attempt?: number;
	domainId: string;
	nonce?: string;
}

// Empty because renewals worker can scan due domains itself.
// biome-ignore lint/suspicious/noEmptyInterface: Empty payload interface required by the jobs contract.
export interface DomainRenewalsJobData {}

// Empty because domain sync is a global sweep.
// biome-ignore lint/suspicious/noEmptyInterface: Empty payload interface required by the jobs contract.
export interface DomainSyncJobData {}

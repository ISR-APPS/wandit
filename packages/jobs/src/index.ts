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
// Every producer of domain-purchase jobs must use the same attempt budget:
// the worker treats "last attempt" as the trigger for the refund path, so a
// producer defaulting to 1 would turn the first transient error terminal.
export const DOMAIN_PURCHASE_JOB_ATTEMPTS = 5;
// Queue for durable payment-order refunds.
export const ORDER_REFUNDS_QUEUE = "order-refunds";
// Queue for durable signup-credit outbox delivery.
export const SIGNUP_GRANTS_QUEUE = "signup-grants";
export const SIGNUP_GRANT_SWEEP_JOB = "sweep-signup-grants";
// Queue for monthly refill slots funded by yearly subscriptions.
export const SUBSCRIPTION_REFILLS_QUEUE = "subscription-refills";
export const SUBSCRIPTION_REFILL_SWEEP_JOB = "sweep-subscription-refill-slots";
// Queue for durable retry and operator replay of persisted billing webhooks.
export const BILLING_WEBHOOKS_QUEUE = "billing-webhooks";
export const BILLING_WEBHOOK_RETRY_SWEEP_JOB = "retry-failed-billing-webhooks";
export const BILLING_WEBHOOK_RETRY_EVENT_JOB = "retry-billing-webhook";
// Hourly refresh of DB-persisted AI Gateway model prices.
export const MODEL_PRICING_QUEUE = "model-pricing";
export const MODEL_PRICING_REFRESH_JOB = "refresh-model-prices";
// Durable AI usage recovery and post-provider cost reconciliation.
export const METERING_QUEUE = "metering";
export const METERING_RECOVERY_SWEEP_JOB = "recover-stale-ai-usage";
export const METERING_RECONCILE_EVENT_JOB = "reconcile-ai-usage-event";
export const METERING_RECONCILE_DELAY_MS = 10_000;
export const METERING_RECONCILE_JOB_ATTEMPTS = 8;
// Daily transition of eligible affiliate commissions from pending to approved.
export const AFFILIATE_MAINTENANCE_QUEUE = "affiliate-maintenance";
export const AFFILIATE_APPROVAL_SWEEP_JOB = "approve-affiliate-commissions";
export const AFFILIATE_ATTRIBUTION_RETRY_JOB = "retry-affiliate-attribution";

// One list used by API and worker to register all queues.
export const queueNames = [
	AI_GENERATION_QUEUE,
	MEDIA_GENERATION_QUEUE,
	LEAD_PROCESSING_QUEUE,
	PUBLISH_QUEUE,
	DOMAINS_QUEUE,
	ORDER_REFUNDS_QUEUE,
	SIGNUP_GRANTS_QUEUE,
	SUBSCRIPTION_REFILLS_QUEUE,
	BILLING_WEBHOOKS_QUEUE,
	MODEL_PRICING_QUEUE,
	METERING_QUEUE,
	AFFILIATE_MAINTENANCE_QUEUE,
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
export type SignupGrantJobName = typeof SIGNUP_GRANT_SWEEP_JOB;
export type SubscriptionRefillJobName = typeof SUBSCRIPTION_REFILL_SWEEP_JOB;
export type BillingWebhookJobName =
	| typeof BILLING_WEBHOOK_RETRY_SWEEP_JOB
	| typeof BILLING_WEBHOOK_RETRY_EVENT_JOB;
export type ModelPricingJobName = typeof MODEL_PRICING_REFRESH_JOB;
export type MeteringJobName =
	| typeof METERING_RECOVERY_SWEEP_JOB
	| typeof METERING_RECONCILE_EVENT_JOB;
export type AffiliateMaintenanceJobName =
	| typeof AFFILIATE_APPROVAL_SWEEP_JOB
	| typeof AFFILIATE_ATTRIBUTION_RETRY_JOB;

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
	usageEventId: string | null;
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

// A user-scoped job is queued after an inline grant fails. The worker also
// schedules this job without a user id to sweep every pending row.
export interface SignupGrantSweepJobData {
	userId?: string;
}

// Empty because the refill worker scans every due pending slot.
// biome-ignore lint/suspicious/noEmptyInterface: Empty payload interface required by the jobs contract.
export interface SubscriptionRefillSweepJobData {}

// Empty because the retry worker scans persisted failed webhook events.
// biome-ignore lint/suspicious/noEmptyInterface: Empty payload interface required by the jobs contract.
export interface BillingWebhookRetrySweepJobData {}

// Admin-triggered replay targets one durable webhook event.
export interface BillingWebhookRetryEventJobData {
	eventId: string;
}

// Empty because the refresh worker fetches the whole public gateway catalog.
// biome-ignore lint/suspicious/noEmptyInterface: Empty payload interface required by the jobs contract.
export interface ModelPricingRefreshJobData {}

// Empty because recovery scans stale reserved rows in bounded batches.
// biome-ignore lint/suspicious/noEmptyInterface: Empty payload interface required by the jobs contract.
export interface MeteringRecoverySweepJobData {}

export interface MeteringReconcileEventJobData {
	eventId: string;
}

export type MeteringJobData =
	| MeteringRecoverySweepJobData
	| MeteringReconcileEventJobData;

// Empty because the worker scans every pending affiliate commission.
// biome-ignore lint/suspicious/noEmptyInterface: Empty payload interface required by the jobs contract.
export interface AffiliateApprovalSweepJobData {}

export interface AffiliateAttributionRetryJobData {
	source: "signup_body" | "signup_cookie";
	token: string;
	userId: string;
}

export type AffiliateMaintenanceJobData =
	| AffiliateApprovalSweepJobData
	| AffiliateAttributionRetryJobData;

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

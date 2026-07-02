export const AI_GENERATION_QUEUE = "ai-generation";
export const MEDIA_GENERATION_QUEUE = "media-generation";
export const LEAD_PROCESSING_QUEUE = "lead-processing";

export const queueNames = [AI_GENERATION_QUEUE, MEDIA_GENERATION_QUEUE, LEAD_PROCESSING_QUEUE] as const;

export type AiGenerationJobName = "generate-site" | "revise-site" | "generate-copy";
export type MediaGenerationJobName = "generate-image" | "generate-video";
export type LeadProcessingJobName = "normalize-lead" | "send-lead-notification";

export interface AiGenerationJobData {
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

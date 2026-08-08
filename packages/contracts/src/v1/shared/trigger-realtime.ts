import { z } from "zod";

/**
 * Live-progress subscription handle for a queued background job: the
 * Trigger.dev run id plus a read-scoped public access token the chat card
 * uses with Realtime (no polling). Absent when Realtime is unavailable
 * (missing credentials, token minting failure, or messages persisted before
 * this field existed) — cards fall back to polling the attempt endpoint.
 *
 * Lives in shared/ (a leaf module) because both ai-chat.ts and pages.ts
 * need it, and pages.ts importing ai-chat.ts would close the ESM cycle
 * ai-chat → page-edits → pages and TDZ-crash at module evaluation.
 */
export const triggerRealtimeHandleSchema = z.object({
	runId: z.string().min(1),
	publicAccessToken: z.string().min(1),
});

export type TriggerRealtimeHandle = z.infer<typeof triggerRealtimeHandleSchema>;

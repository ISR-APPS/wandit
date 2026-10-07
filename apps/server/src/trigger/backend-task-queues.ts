/**
 * Trigger.dev queue for the app-builder backend tasks.
 * `provision-backend.task.ts` consumes `backendProvisioningQueue`; every
 * create call inside it shares the Supabase org rate bucket.
 */
import { type Queue, queue } from "@trigger.dev/sdk";

// Each run makes 2 org-bucket calls (find and create). The Redis limiter
// guards the 120 per minute bucket, so 10 runs at once stay under it.
// A 5 s `wait.for` does not checkpoint, so a run holds its slot for 15 to 42 s.
// LIMIT: 10 runs at once, about 25 backends per minute. Upgrade: a checkpointing wait.
export const backendProvisioningQueue: Queue = queue({
	concurrencyLimit: 10,
	name: "backend-provisioning",
});

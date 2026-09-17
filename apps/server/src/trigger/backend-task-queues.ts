/**
 * Trigger.dev queue for the app-builder backend tasks.
 * `provision-backend.task.ts` consumes `backendProvisioningQueue`; every
 * create call inside it shares the Supabase org rate bucket.
 */
import { type Queue, queue } from "@trigger.dev/sdk";

// ESTIMATE 3 from WANDIT-183: every create call shares the Supabase org
// bucket, so the queue stays narrow.
export const backendProvisioningQueue: Queue = queue({
	concurrencyLimit: 3,
	name: "backend-provisioning",
});

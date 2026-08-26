import { type Queue, queue } from "@trigger.dev/sdk";

/** Serializes lifecycle outbox sweeps so due rows are considered by one worker. */
export const lifecycleEventsQueue: Queue = queue({
	concurrencyLimit: 1,
	name: "lifecycle-events-sweep",
});

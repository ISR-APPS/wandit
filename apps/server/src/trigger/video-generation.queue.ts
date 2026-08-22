import { type Queue, queue } from "@trigger.dev/sdk";

/** All expensive video provider work shares one global concurrency budget. */
export const videoGenerationQueue: Queue = queue({
	concurrencyLimit: 2,
	name: "video-generation",
});

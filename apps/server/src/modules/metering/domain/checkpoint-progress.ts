/**
 * Reads the checkpoint progress an `agent_session` event carries in its
 * `pricingSnapshot` JSON. `MeteringService` calls it from the checkpoint,
 * settle, credit adjustment, and refund paths to find the
 * `checkpoint:<id>:<n>` debits.
 * The snapshot is untrusted JSON: fields may be missing or hold junk.
 */
import { z } from "zod";

/** The checkpoint fields a `checkpoint` call writes into the snapshot. */
export const checkpointProgressSchema = z.object({
	/** Count of landed checkpoints; a missing or bad value reads as 0. */
	checkpoints: z.int().nonnegative().catch(0),
	/** The cc each landed checkpoint debited, in landing order. */
	checkpointDebits: z.array(z.int().nonnegative()).optional(),
});

/**
 * Progress a `checkpoint` call wrote into the event snapshot. A missing
 * or unreadable snapshot answers the defaults; a corrupt
 * `checkpointDebits` value throws.
 */
export function snapshotCheckpointProgress(pricingSnapshot: unknown): {
	checkpointDebits: number[];
	checkpoints: number;
} {
	const parsed = checkpointProgressSchema.safeParse(pricingSnapshot);
	if (parsed.success) {
		return {
			checkpointDebits: parsed.data.checkpointDebits ?? [],
			checkpoints: parsed.data.checkpoints,
		};
	}
	// `checkpoint` is the only writer and stores a cc array. Dropping a bad
	// entry would shift each later debit onto the wrong `checkpoint:<id>:<n>`
	// refund key, so a corrupt value must fail loudly.
	if (
		parsed.error.issues.some((issue) => issue.path[0] === "checkpointDebits")
	) {
		throw new Error(
			"AI usage event snapshot has a corrupt checkpointDebits entry",
		);
	}
	return { checkpointDebits: [], checkpoints: 0 };
}

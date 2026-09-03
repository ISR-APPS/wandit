/**
 * Shared Trigger.dev handoff for page builds: queue the generate-page task
 * with bounded retries, and mint the read-scoped Realtime token the chat card
 * uses to follow the run live.
 *
 * Two callers on purpose — the generate_page chat tool (first build) and the
 * pages retry endpoint (Retry/Resume buttons). Keeping the handoff mechanics
 * in one file means both queues behave identically: same idempotency
 * discipline, same rejection taxonomy, same TTLs.
 */
import { setTimeout as delay } from "node:timers/promises";
import { auth, idempotencyKeys, tasks } from "@trigger.dev/sdk";
import type { TriggerRealtimeHandle } from "@wandit/contracts";

// Type-only import: pulling the task VALUE here would drag the Trigger task
// (and its DB pool) into the Nest process. The type is enough to make
// tasks.trigger() check the payload shape.
import type { generatePageTask } from "../../../trigger/generate-page.task";

const TRIGGER_HANDOFF_ATTEMPTS = 3;
const TRIGGER_IDEMPOTENCY_TTL = "14d";

export type PageBuildHandoffPayload = {
	actorIsLimitExempt?: boolean;
	actorUserId: string;
	attemptId: string;
	/**
	 * Distinguishes queues of the SAME attempt row. The first queue omits it;
	 * every retry passes a fresh nonce — otherwise the 14-day global
	 * idempotency key would resolve a retry to the original (failed) run.
	 */
	idempotencyNonce?: string;
	parentEventId?: string;
	projectId: string;
};

export async function triggerGeneratePageTask(
	payload: PageBuildHandoffPayload,
): Promise<Awaited<ReturnType<typeof tasks.trigger>>> {
	const idempotencyKey = await idempotencyKeys.create(
		payload.idempotencyNonce
			? `page-build:${payload.attemptId}:${payload.idempotencyNonce}`
			: `page-build:${payload.attemptId}`,
		{ scope: "global" },
	);
	let lastError: unknown;

	for (let attempt = 0; attempt < TRIGGER_HANDOFF_ATTEMPTS; attempt += 1) {
		try {
			return await tasks.trigger<typeof generatePageTask>(
				"generate-page",
				{
					...(payload.actorIsLimitExempt ? { actorIsLimitExempt: true } : {}),
					actorUserId: payload.actorUserId,
					attemptId: payload.attemptId,
					...(payload.parentEventId
						? { parentEventId: payload.parentEventId }
						: {}),
				},
				{
					idempotencyKey,
					idempotencyKeyTTL: TRIGGER_IDEMPOTENCY_TTL,
					tags: [
						`page-build-attempt:${payload.attemptId}`,
						`project:${payload.projectId}`,
					],
					ttl: "35m",
				},
			);
		} catch (error) {
			lastError = error;

			if (isDefinitiveTriggerRejection(error)) {
				break;
			}

			if (attempt < TRIGGER_HANDOFF_ATTEMPTS - 1) {
				await delay(100 * 2 ** attempt);
			}
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error("Trigger.dev handoff failed");
}

export function isDefinitiveTriggerRejection(error: unknown): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}

	const candidate = error as { name?: unknown; status?: unknown };

	return (
		candidate.name === "TriggerApiError" &&
		(candidate.status === 400 ||
			candidate.status === 401 ||
			candidate.status === 403 ||
			candidate.status === 404 ||
			candidate.status === 422)
	);
}

/**
 * Mint a read-scoped Realtime token so the chat card can follow the build
 * live instead of showing a static "building…" line. Best-effort: on failure
 * the card falls back to polling the attempt endpoint, so queueing must
 * never fail here.
 */
export async function mintRealtimeHandle(
	runId: string,
	log?: (message: string) => void,
): Promise<TriggerRealtimeHandle | undefined> {
	try {
		const publicAccessToken = await auth.createPublicToken({
			// Long enough to outlive any build plus a same-session reload; an
			// expired token just means the card falls back to attempt polling.
			expirationTime: "2h",
			scopes: { read: { runs: [runId] } },
		});

		return { publicAccessToken, runId };
	} catch (error) {
		log?.(
			`Realtime token minting failed for run ${runId} — the chat card ` +
				`will poll instead: ${error instanceof Error ? error.message : String(error)}`,
		);

		return undefined;
	}
}

import type { LifecycleEventsService } from "../modules/lifecycle-events/application/services/lifecycle-events.service";
import type { EnqueueLifecycleEvent } from "../modules/lifecycle-events/domain/lifecycle-event";

type LifecycleLogger = {
	error(message: string): unknown;
};

export function pageGenerationLifecycleEvent(
	actorUserId: string,
	pageKind: "cod" | "website" | undefined,
): EnqueueLifecycleEvent {
	const event =
		(pageKind ?? "website") === "website"
			? "website_generated"
			: "landing_page_generated";

	return {
		event,
		idempotencyKey: `${event}:${actorUserId}`,
		userId: actorUserId,
	};
}

export async function enqueuePageGenerationLifecycleEvent(
	lifecycleEvents: LifecycleEventsService,
	actorUserId: string,
	pageKind: "cod" | "website" | undefined,
	logger: LifecycleLogger,
): Promise<void> {
	try {
		await lifecycleEvents.enqueue(
			pageGenerationLifecycleEvent(actorUserId, pageKind),
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error(
			`Page generation lifecycle enqueue failed for user ${actorUserId}: ${message}`,
		);
	}
}

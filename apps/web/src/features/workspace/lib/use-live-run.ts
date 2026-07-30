// Push-based progress for queued background jobs: subscribe to a Trigger.dev
// run with the read-scoped token minted at queue time. Realtime pushes every
// metadata/status change; a slow management-API poll (5s, plus tab-refocus
// revalidation) rides along as a safety net, because the underlying Electric
// stream can die silently AFTER delivering its first snapshot. Whichever
// transport has the newer row wins. Consumers keep the durable attempt row
// as the source of truth for the final result: on settle they refetch it
// ONCE (via onSettled), and when neither transport delivers they fall back
// to the legacy polling path, flagged here via `failed`.

import { useRealtimeRun, useRun } from "@trigger.dev/react-hooks";
import type { TriggerRealtimeHandle } from "@wandit/contracts";
import { useEffect, useRef } from "react";

// Slow on purpose: the stream carries the live cadence; the poll only keeps
// the card honest when the stream dies. SWR stops it once the run completes.
const POLL_INTERVAL_MS = 5_000;

const SETTLED_RUN_STATUSES = new Set([
	"COMPLETED",
	"FAILED",
	"CANCELED",
	"CRASHED",
	"SYSTEM_FAILURE",
	"EXPIRED",
	"TIMED_OUT",
]);

/** The slice of a run row this hook reads, common to both transports. */
type RunSnapshot = {
	metadata?: Record<string, unknown> | undefined;
	status?: string;
	updatedAt?: Date | string;
};

/** Newer row wins; a lone row wins by default. */
function pickFresher(
	a: RunSnapshot | undefined,
	b: RunSnapshot | undefined,
): RunSnapshot | undefined {
	if (!a) return b;
	if (!b) return a;

	const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
	const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;

	return bTime > aTime ? b : a;
}

export function useLiveRun({
	handle,
	enabled,
	onSettled,
}: {
	handle: TriggerRealtimeHandle | undefined;
	enabled: boolean;
	/** Fired once when the run reaches a terminal state. */
	onSettled?: () => void;
}) {
	const subscribed = Boolean(handle) && enabled;
	const { run: streamedRun, error } = useRealtimeRun(handle?.runId, {
		accessToken: handle?.publicAccessToken,
		enabled: subscribed,
		skipColumns: ["payload", "output"],
	});

	// SWR disables itself on a null key, so the poll obeys the same gate as
	// the subscription and stops with it after settle.
	const { run: polledRun } = useRun(
		(subscribed ? (handle?.runId ?? null) : null) as string,
		{
			accessToken: handle?.publicAccessToken,
			refreshInterval: POLL_INTERVAL_MS,
			revalidateOnFocus: true,
		},
	);

	const run = pickFresher(
		streamedRun as RunSnapshot | undefined,
		polledRun as RunSnapshot | undefined,
	);

	const status = run?.status;
	const settled = status !== undefined && SETTLED_RUN_STATUSES.has(status);

	// The ONE effect this hook keeps, and only because it must: onSettled
	// performs external side effects (query invalidation) on a transition,
	// which React forbids during render. It runs exactly once per run —
	// latched — not per render.
	const settledOnce = useRef(false);
	const onSettledRef = useRef(onSettled);
	onSettledRef.current = onSettled;

	useEffect(() => {
		if (!settled || settledOnce.current) return;
		settledOnce.current = true;
		onSettledRef.current?.();
	}, [settled]);

	return {
		/** Neither transport is usable — the consumer should poll instead. */
		failed: subscribed && error !== undefined && polledRun === undefined,
		metadata: run?.metadata as Record<string, unknown> | undefined,
		settled,
		status,
	};
}

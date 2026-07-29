// Push-based progress for queued background jobs: subscribe to a Trigger.dev
// run with the read-scoped token minted at queue time. No polling — Realtime
// pushes every metadata/status change. Consumers keep the durable attempt row
// as the source of truth for the final result: on settle they refetch it ONCE
// (via onSettled), and if the subscription cannot be established (expired
// token after a late reload, network, old messages without a handle) they
// fall back to the legacy polling path, flagged here via `failed`.

import { useRealtimeRun } from "@trigger.dev/react-hooks";
import type { TriggerRealtimeHandle } from "@wandit/contracts";
import { useEffect, useRef, useState } from "react";

const STALL_TIMEOUT_MS = 15_000;

const SETTLED_RUN_STATUSES = new Set([
	"COMPLETED",
	"FAILED",
	"CANCELED",
	"CRASHED",
	"SYSTEM_FAILURE",
	"EXPIRED",
	"TIMED_OUT",
]);

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
	const { run, error } = useRealtimeRun(handle?.runId, {
		accessToken: handle?.publicAccessToken,
		enabled: subscribed,
		skipColumns: ["payload", "output"],
	});

	const status = run?.status;
	const settled = status !== undefined && SETTLED_RUN_STATUSES.has(status);

	// Liveness guard: the underlying Electric stream retries network errors
	// forever WITHOUT surfacing them (`error` stays undefined behind a proxy
	// or DNS block). A subscription that delivers nothing within the window
	// counts as failed so consumers fall back to polling.
	const [stalled, setStalled] = useState(false);
	const hasData = run !== undefined;

	useEffect(() => {
		if (!subscribed || hasData) return;
		const timer = setTimeout(() => setStalled(true), STALL_TIMEOUT_MS);
		return () => clearTimeout(timer);
	}, [subscribed, hasData]);

	// Latch: settle exactly once per run, even though Realtime keeps pushing
	// row updates after the terminal transition.
	const settledOnce = useRef(false);
	const onSettledRef = useRef(onSettled);
	onSettledRef.current = onSettled;

	useEffect(() => {
		if (!settled || settledOnce.current) return;
		settledOnce.current = true;
		onSettledRef.current?.();
	}, [settled]);

	return {
		/** Subscription is unusable — the consumer should poll instead. */
		failed: subscribed && (error !== undefined || (stalled && !hasData)),
		metadata: (run?.metadata ?? undefined) as
			| Record<string, unknown>
			| undefined,
		settled,
		status,
	};
}

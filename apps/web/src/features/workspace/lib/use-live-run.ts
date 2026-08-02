// Push-based progress for queued background jobs: subscribe to a Trigger.dev
// run with the read-scoped token minted at queue time. Realtime pushes every
// metadata/status change; a slow management-API poll (5s, plus tab-refocus
// revalidation) rides along as a safety net, because the underlying Electric
// stream can die silently AFTER delivering its first snapshot. Terminal rows
// are sticky per run; otherwise the newer transport row wins. The durable
// attempt row remains the source of truth for the final result: on settle
// consumers refetch it ONCE (via onSettled). When neither transport delivers,
// they fall back to the legacy polling path, flagged here via `failed`.

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
	id: string;
	metadata?: Record<string, unknown> | undefined;
	status?: string;
	updatedAt?: Date | string;
};

function isSettledSnapshot(snapshot: RunSnapshot | undefined): boolean {
	return (
		snapshot?.status !== undefined && SETTLED_RUN_STATUSES.has(snapshot.status)
	);
}

/** Terminal rows win; otherwise the newer row wins, with ties favoring `a`. */
export function pickFresher(
	a: RunSnapshot | undefined,
	b: RunSnapshot | undefined,
): RunSnapshot | undefined {
	if (!a) return b;
	if (!b) return a;

	const aSettled = isSettledSnapshot(a);
	const bSettled = isSettledSnapshot(b);
	if (aSettled !== bSettled) return aSettled ? a : b;

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
		id: handle?.runId,
		skipColumns: ["payload", "output"],
	});

	// SWR disables itself on a null key, so the poll obeys the same gate as
	// the subscription. Trigger's hook stops polling completed runs itself.
	const { run: polledRun } = useRun(
		(subscribed ? (handle?.runId ?? null) : null) as string,
		{
			accessToken: handle?.publicAccessToken,
			refreshInterval: POLL_INTERVAL_MS,
			revalidateOnFocus: true,
		},
	);

	const runId = handle?.runId;
	const streamedSnapshot = streamedRun as RunSnapshot | undefined;
	const polledSnapshot = polledRun as RunSnapshot | undefined;
	const currentStreamedRun =
		streamedSnapshot?.id === runId ? streamedSnapshot : undefined;
	const currentPolledRun =
		polledSnapshot?.id === runId ? polledSnapshot : undefined;
	const selectedRun = pickFresher(currentStreamedRun, currentPolledRun);
	const terminalRunRef = useRef<
		{ runId: string; snapshot: RunSnapshot } | undefined
	>(undefined);

	// Run statuses are irreversible. Keep the newest terminal row for this run
	// so a transport teardown cannot reveal an older cached in-flight snapshot.
	const terminalRun = terminalRunRef.current;
	const previousTerminal =
		terminalRun && terminalRun.runId === runId
			? terminalRun.snapshot
			: undefined;
	const terminalSnapshot = isSettledSnapshot(selectedRun)
		? pickFresher(previousTerminal, selectedRun)
		: previousTerminal;
	const run = terminalSnapshot ?? selectedRun;

	const status = run?.status;
	const settled = isSettledSnapshot(run);

	// The ONE effect this hook keeps, and only because it must: onSettled
	// performs external side effects (query invalidation) on a transition,
	// which React forbids during render. It runs exactly once per run —
	// latched — not per render.
	const settledRunIdRef = useRef<string | undefined>(undefined);
	const onSettledRef = useRef(onSettled);
	onSettledRef.current = onSettled;

	useEffect(() => {
		if (runId && terminalSnapshot) {
			terminalRunRef.current = { runId, snapshot: terminalSnapshot };
		}
		if (!settled || !runId || settledRunIdRef.current === runId) return;
		settledRunIdRef.current = runId;
		onSettledRef.current?.();
	}, [runId, settled, terminalSnapshot]);

	return {
		/** Neither transport is usable — the consumer should poll instead. */
		failed: subscribed && error !== undefined && currentPolledRun === undefined,
		metadata: run?.metadata as Record<string, unknown> | undefined,
		settled,
		status,
	};
}

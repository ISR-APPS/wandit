// Push-based progress for queued background jobs, native edition. The web
// hook rides @trigger.dev/react-hooks; that package leans on WHATWG stream
// plumbing Hermes doesn't guarantee, so this subscribes to the SAME wire
// protocol directly: Trigger Realtime is an Electric shape stream — HTTP
// long-polls that each return a complete JSON body, which React Native's
// plain fetch handles fine. No interval polling anywhere: the server holds
// the live request open and answers the moment the run row changes. On a
// terminal status the subscription tears itself down and fires onSettled
// exactly once so consumers can refetch durable state one time.

import {
	FetchError,
	isChangeMessage,
	isControlMessage,
	type Message,
	type Row,
	ShapeStream,
} from "@electric-sql/client";
import type { TriggerRealtimeHandle } from "@wandit/contracts";
import { env } from "@wandit/env/native";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

/** API-facing statuses that mean the run will never change again. */
const SETTLED_RUN_STATUSES = new Set([
	"COMPLETED",
	"FAILED",
	"CANCELED",
	"CRASHED",
	"SYSTEM_FAILURE",
	"EXPIRED",
	"TIMED_OUT",
]);

// The shape row carries the engine's internal status enum; the SDK maps it
// to the public API statuses consumers (and the web card) reason about.
// Ported from @trigger.dev/core's apiStatusFromRunStatus.
const API_STATUS_BY_RAW_STATUS: Record<string, string> = {
	CANCELED: "CANCELED",
	COMPLETED_SUCCESSFULLY: "COMPLETED",
	COMPLETED_WITH_ERRORS: "FAILED",
	CRASHED: "CRASHED",
	DELAYED: "DELAYED",
	DEQUEUED: "DEQUEUED",
	EXECUTING: "EXECUTING",
	EXPIRED: "EXPIRED",
	INTERRUPTED: "FAILED",
	PAUSED: "WAITING",
	PENDING: "QUEUED",
	PENDING_VERSION: "PENDING_VERSION",
	RETRYING_AFTER_FAILURE: "EXECUTING",
	SYSTEM_FAILURE: "SYSTEM_FAILURE",
	TIMED_OUT: "TIMED_OUT",
	WAITING_FOR_DEPLOY: "PENDING_VERSION",
	WAITING_TO_RESUME: "WAITING",
};

/**
 * Run metadata arrives as a serialized column plus its dataType. JSON is the
 * normal case; super+json wraps the value in a `{ json, meta }` envelope we
 * can unwrap without the superjson runtime because build progress is plain
 * JSON data (the meta section only matters for Dates/Maps/etc.). Anything
 * unparsable degrades to undefined — the progress schema's .catch() defaults
 * take it from there.
 */
function parseRunMetadata(
	data: unknown,
	dataType: unknown,
): Record<string, unknown> | undefined {
	if (typeof data !== "string" || data.length === 0) return undefined;

	try {
		const parsed: unknown = JSON.parse(data);
		const unwrapped =
			dataType === "application/super+json" &&
			typeof parsed === "object" &&
			parsed !== null &&
			"json" in parsed
				? (parsed as { json: unknown }).json
				: parsed;

		return typeof unwrapped === "object" &&
			unwrapped !== null &&
			!Array.isArray(unwrapped)
			? (unwrapped as Record<string, unknown>)
			: undefined;
	} catch {
		return undefined;
	}
}

type LiveRunSnapshot = {
	status: string;
	metadata: Record<string, unknown> | undefined;
};

function snapshotFromRow(row: Row<unknown>): LiveRunSnapshot {
	const rawStatus = typeof row.status === "string" ? row.status : "";
	return {
		metadata: parseRunMetadata(row.metadata, row.metadataType),
		status: API_STATUS_BY_RAW_STATUS[rawStatus] ?? "QUEUED",
	};
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
	const [snapshot, setSnapshot] = useState<LiveRunSnapshot | undefined>(
		undefined,
	);
	const [failed, setFailed] = useState(false);
	// Bumped to rebuild the subscription after a fatal error, when the app
	// returns to the foreground. Reconnection, not polling: nothing repeats
	// on a timer.
	const [attempt, setAttempt] = useState(0);

	const settled =
		snapshot !== undefined && SETTLED_RUN_STATUSES.has(snapshot.status);

	const runId = enabled && !settled ? handle?.runId : undefined;
	const accessToken = handle?.publicAccessToken;
	const streamRef = useRef<ShapeStream | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is a deliberate resubscribe trigger — bumping it rebuilds a dead stream.
	useEffect(() => {
		if (!runId || !accessToken) return;

		let disposed = false;
		const abortController = new AbortController();
		// Electric delivers row deltas; fold them into the full row exactly
		// like the SDK's ReadableShapeStream, emitting only at up-to-date so
		// the card never renders a half-merged snapshot.
		const rows = new Map<string, Row<unknown>>();

		const markFailed = () => {
			if (!disposed) setFailed(true);
		};

		const handleMessages = (messages: Message<Row<unknown>>[]) => {
			if (disposed) return;

			let upToDate = false;
			for (const message of messages) {
				if (isChangeMessage(message)) {
					if (message.headers.operation === "insert") {
						rows.set(message.key, message.value);
					} else if (message.headers.operation === "update") {
						const existing = rows.get(message.key);
						rows.set(
							message.key,
							existing ? { ...existing, ...message.value } : message.value,
						);
					}
				} else if (isControlMessage(message)) {
					if (message.headers.control === "must-refetch") {
						rows.clear();
					} else if (message.headers.control === "up-to-date") {
						upToDate = true;
					}
				}
			}

			if (!upToDate) return;
			// The shape is scoped to one run, so the map holds one row.
			const row = rows.values().next().value;
			if (!row) return;

			const next = snapshotFromRow(row);
			setSnapshot(next);
			setFailed(false);
			if (SETTLED_RUN_STATUSES.has(next.status)) {
				// Terminal — nothing further can arrive; stop long-polling.
				abortController.abort();
			}
		};

		try {
			const stream = new ShapeStream({
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"x-trigger-api-version": "2025-07-16",
					"x-trigger-electric-version": "1.0.0-beta.1",
				},
				onError: (error) => {
					// Transient network errors retry internally with backoff and
					// never land here; a FetchError means the server refused us
					// (expired token, gone run) — that's fatal for this attempt.
					if (error instanceof FetchError) markFailed();
				},
				signal: abortController.signal,
				url: `${env.EXPO_PUBLIC_TRIGGER_API_URL}/realtime/v1/runs/${runId}?skipColumns=payload,output`,
			});
			streamRef.current = stream;
			stream.subscribe(handleMessages, markFailed);
		} catch {
			markFailed();
		}

		return () => {
			disposed = true;
			streamRef.current = null;
			abortController.abort();
		};
	}, [runId, accessToken, attempt]);

	// Foreground recovery: iOS suspends sockets in the background, so when
	// the app comes back either refresh the healthy stream (drops the stale
	// long-poll and re-syncs to the latest row now) or rebuild a failed one.
	useEffect(() => {
		if (!runId || !accessToken) return;

		const subscription = AppState.addEventListener("change", (state) => {
			if (state !== "active") return;
			const stream = streamRef.current;
			if (stream) {
				stream.forceDisconnectAndRefresh().catch(() => undefined);
			} else {
				setFailed(false);
				setAttempt((current) => current + 1);
			}
		});

		return () => subscription.remove();
	}, [runId, accessToken]);

	// Same latch as the web hook: onSettled performs external side effects
	// (query invalidation) on a transition, once per run — not per render.
	const settledOnce = useRef(false);
	const onSettledRef = useRef(onSettled);
	onSettledRef.current = onSettled;

	useEffect(() => {
		if (!settled || settledOnce.current) return;
		settledOnce.current = true;
		onSettledRef.current?.();
	}, [settled]);

	return {
		/** The subscription is dead and won't recover on its own. */
		failed: failed && !settled,
		metadata: snapshot?.metadata,
		settled,
		status: snapshot?.status,
	};
}

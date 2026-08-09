// Live card for one background connector generation (e.g. a Higgsfield
// video) — design gallery card 22, "video sent to render". The chat agent
// queued the run and answered immediately; this card follows the run over
// Trigger Realtime — queued → rendering (the task republishes the provider's
// own stage string on every status poll) → media player — and reads the
// durable attempt row once the run settles. A slow safety poll guarantees
// the card concludes even if the subscription dies silently (backgrounded
// tab, sleep/wake); it goes fast when there is no usable subscription at all.

import { useQueryClient } from "@tanstack/react-query";
import type { TriggerRealtimeHandle } from "@wandit/contracts";
import { AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useStopwatch } from "react-timer-hook";

import { invalidateBalanceAfterGenerationTerminal } from "@/features/credits/lib/terminal-balance-invalidation";
import { useTranslation } from "@/lib/i18n";
import {
	connectorGenerationKeys,
	useConnectorGenerationAttemptQuery,
} from "../../../api/connector-generations.queries";
import { useLiveRun } from "../../../lib/use-live-run";
import { SpinnerArc } from "../request-tray/tray-signals";
import { ChatMediaGallery } from "./chat-media";

const QUEUED_RUN_STATUSES = new Set([
	"QUEUED",
	"DEQUEUED",
	"DELAYED",
	"PENDING_VERSION",
]);

// The task republishes the provider's own state string (queued, pending,
// processing, rendering…) as run-metadata `stage` on every poll — mirror of
// the server's IN_FLIGHT/SETTLED patterns in run-connector-generation.task.
const QUEUED_STAGE_PATTERN = /queue|pend|wait|delay/i;

export function ConnectorGenerationCard({
	args,
	attemptId,
	connectorName,
	realtime,
	title,
	toolName,
}: {
	/** Raw MCP tool arguments — duration/aspect enrich the title line. */
	args: unknown;
	attemptId: string;
	/** User-facing connector name, e.g. "Higgsfield". */
	connectorName: string;
	realtime: TriggerRealtimeHandle | undefined;
	/** Localized action label, e.g. "Génération de la vidéo". */
	title: string;
	/** Provider tool name for the technical footer, e.g. "generate_video". */
	toolName: string;
}) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	// Flipped when the subscription dies OR the run settles: the poll goes
	// fast until the row is terminal (its interval stops by itself), so a
	// crashed run still resolves via the server's stale-row janitor.
	const [pollFallback, setPollFallback] = useState(false);

	const intervalMs = !realtime || pollFallback ? 1500 : 15_000;
	const { data: attempt, error } = useConnectorGenerationAttemptQuery(
		attemptId,
		intervalMs,
	);
	const attemptSettled =
		attempt?.status === "succeeded" || attempt?.status === "failed";
	const terminalStatus = attemptSettled ? attempt.status : null;

	useEffect(() => {
		if (!terminalStatus) return;
		invalidateBalanceAfterGenerationTerminal(queryClient, terminalStatus);
	}, [queryClient, terminalStatus]);

	const live = useLiveRun({
		handle: realtime,
		enabled: !attemptSettled,
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: connectorGenerationKeys.attempt(attemptId),
			});
			invalidateBalanceAfterGenerationTerminal(queryClient, "settled");
			setPollFallback(true);
		},
	});

	useEffect(() => {
		if (live.failed) setPollFallback(true);
	}, [live.failed]);

	// Stopwatch anchor: the durable row's createdAt once known (mount time
	// until then) — a reload keeps the true age instead of restarting at 0:00.
	const mountedAtIso = useRef(new Date().toISOString());

	// Attempt unreadable (deleted row, auth loss): say so instead of a
	// spinner that can never conclude — the poll stops itself on error.
	if (error && !attempt) {
		return (
			<p dir="auto" className="text-[13px] text-muted-foreground leading-[1.5]">
				{t("workspace.chat.mcpTool.generation.statusLoadError")}
			</p>
		);
	}

	if (attempt?.status === "failed") {
		return (
			<div className="rounded-[14px] border border-destructive/25 bg-destructive/[0.035] p-3.5">
				<div className="flex items-start gap-2.5">
					<span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
						<AlertTriangle className="size-3.5" aria-hidden />
					</span>
					<div className="min-w-0 flex-1">
						<p className="font-medium text-[13.5px] text-foreground">
							{t("workspace.chat.mcpTool.generation.failed")}
						</p>
						<p
							dir="auto"
							className="mt-0.5 text-[13px] text-muted-foreground leading-[1.5]"
						>
							{attempt.error ??
								t("workspace.chat.mcpTool.generation.stoppedEarly")}
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (attempt?.status === "succeeded") {
		if (attempt.media.length === 0) {
			return (
				<p
					dir="auto"
					className="text-[13px] text-muted-foreground leading-[1.5]"
				>
					{t("workspace.chat.mcpTool.generation.noMedia")}
				</p>
			);
		}

		return (
			<ChatMediaGallery
				items={attempt.media.map((item, index) => ({
					key: `${attempt.id}:${index}:${item.url}`,
					kind: item.kind,
					url: item.url,
					label: `${title} — ${index + 1}`,
				}))}
			/>
		);
	}

	// queued / running / first fetch still in flight. The chip prefers the
	// provider's own stage (pushed over Realtime every poll) over the coarse
	// run status, so the card flips to "Generating" the moment the provider
	// actually starts rendering.
	const stage =
		typeof live.metadata?.stage === "string" ? live.metadata.stage : undefined;
	const queued = stage
		? QUEUED_STAGE_PATTERN.test(stage)
		: live.status !== undefined
			? QUEUED_RUN_STATUSES.has(live.status)
			: attempt?.status !== "running";
	const startedAtIso = attempt?.createdAt ?? mountedAtIso.current;
	const heading = titleLine(title, args);
	const statusLabel = queued
		? t("workspace.chat.mcpTool.generation.statusQueued")
		: t("workspace.chat.mcpTool.generation.statusGenerating");

	return (
		<div>
			<div className="mb-2 flex items-center gap-2">
				<span className="grid size-[22px] shrink-0 place-items-center rounded-full border border-primary/38 bg-primary/12 text-ember-text">
					<SpinnerArc className="size-3" />
				</span>
				<span className="font-mono text-[11px] text-ember-text uppercase tracking-[0.1em]">
					{t("workspace.chat.mcpTool.generation.sentTo", {
						connector: connectorName,
					})}
				</span>
			</div>

			<div className="rounded-[14px] border border-primary/30 bg-primary/[0.045] p-[14px]">
				<div className="overflow-hidden rounded-[12px] border border-border bg-background p-3.5">
					<div className="flex items-center gap-2">
						<p
							dir="auto"
							className="min-w-0 flex-1 truncate font-medium text-[13.5px] text-foreground"
						>
							{heading}
						</p>
						<span className="shrink-0 rounded-full border border-primary/35 bg-primary/5 px-2 py-0.5 font-mono text-[10px] text-ember-text uppercase tracking-wider">
							{statusLabel}
						</span>
					</div>

					<div
						dir="ltr"
						className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted"
					>
						<motion.div
							className="h-full w-1/3 rounded-full bg-gradient-ember"
							animate={{ x: ["-100%", "300%"] }}
							transition={{
								duration: 1.4,
								repeat: Number.POSITIVE_INFINITY,
								ease: "easeInOut",
							}}
						/>
					</div>

					<p
						dir="auto"
						className="mt-2.5 text-[13px] text-muted-foreground leading-[1.5]"
					>
						{t("workspace.chat.mcpTool.generation.workingHint", {
							connector: connectorName,
						})}
					</p>

					<p
						dir="ltr"
						className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground"
					>
						<span aria-hidden className="size-1.5 rounded-full bg-primary" />
						<ElapsedTimer key={startedAtIso} since={startedAtIso} />
						<span>/ {t("workspace.chat.mcpTool.generation.usually")}</span>
					</p>
				</div>

				<p
					dir="ltr"
					className="mt-2.5 font-mono text-[10.5px] text-muted-foreground/70"
				>
					{`${connectorName.toLowerCase()} · ${toolName}`}
				</p>
			</div>

			<span
				role="status"
				aria-live="polite"
				aria-atomic="true"
				className="sr-only"
			>
				{`${heading}. ${statusLabel}.`}
			</span>
		</div>
	);
}

/**
 * Live elapsed clock — react-timer-hook's stopwatch seeded with the time
 * already elapsed since the attempt was queued, zero-padded ("00:12", card
 * 22). Call sites key this by `since`: the offset is read once at mount, so
 * a changed start time must remount it (same rule as generate-page-part).
 */
function ElapsedTimer({ since }: { since: string }) {
	const [offset] = useState(() => {
		const alreadyElapsedMs = Math.max(
			0,
			Date.now() - new Date(since).getTime(),
		);

		return new Date(Date.now() + alreadyElapsedMs);
	});
	const { hours, minutes, seconds } = useStopwatch({
		autoStart: true,
		offsetTimestamp: offset,
	});
	const totalMinutes = hours * 60 + minutes;

	return (
		<span className="text-ember-text tabular-nums">
			{String(totalMinutes).padStart(2, "0")}:
			{seconds.toString().padStart(2, "0")}
		</span>
	);
}

/** "Generating the video · 6s · 9:16" — enriched from the call's own args. */
function titleLine(title: string, args: unknown): string {
	const params = readParams(args);
	const duration =
		typeof params?.duration === "number" && params.duration > 0
			? `${params.duration}s`
			: typeof params?.duration === "string" && params.duration.trim()
				? `${params.duration.trim()}s`
				: null;
	const aspect =
		typeof params?.aspect_ratio === "string" && params.aspect_ratio.trim()
			? params.aspect_ratio.trim()
			: null;

	return [title, duration, aspect]
		.filter((piece): piece is string => Boolean(piece))
		.join(" · ");
}

// Higgsfield nests its real arguments as `params` (object or JSON string).
function readParams(args: unknown): Record<string, unknown> | null {
	if (typeof args !== "object" || args === null) {
		return null;
	}

	const params = (args as { params?: unknown }).params;

	if (typeof params === "object" && params !== null && !Array.isArray(params)) {
		return params as Record<string, unknown>;
	}

	if (typeof params === "string") {
		try {
			const parsed: unknown = JSON.parse(params);

			return typeof parsed === "object" &&
				parsed !== null &&
				!Array.isArray(parsed)
				? (parsed as Record<string, unknown>)
				: null;
		} catch {
			return null;
		}
	}

	return null;
}

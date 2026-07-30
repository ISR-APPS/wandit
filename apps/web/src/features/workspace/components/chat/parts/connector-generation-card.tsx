// Live card for one background connector generation (e.g. a Higgsfield
// video). The chat agent queued the run and answered immediately; this card
// follows the run over Trigger Realtime — queued → generating → media
// player — and reads the durable attempt row once the run settles. A slow
// safety poll guarantees the card concludes even if the subscription dies
// silently (backgrounded tab, sleep/wake); it goes fast when there is no
// usable subscription at all.

import { useQueryClient } from "@tanstack/react-query";
import type { TriggerRealtimeHandle } from "@wandit/contracts";
import { AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import {
	connectorGenerationKeys,
	useConnectorGenerationAttemptQuery,
} from "../../../api/connector-generations.queries";
import { useLiveRun } from "../../../lib/use-live-run";
import { ChatMediaGallery } from "./chat-media";

const QUEUED_RUN_STATUSES = new Set([
	"QUEUED",
	"DEQUEUED",
	"DELAYED",
	"PENDING_VERSION",
]);

export function ConnectorGenerationCard({
	attemptId,
	realtime,
	title,
}: {
	attemptId: string;
	realtime: TriggerRealtimeHandle | undefined;
	/** Localized action label, e.g. "Génération de la vidéo". */
	title: string;
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

	const live = useLiveRun({
		handle: realtime,
		enabled: !attemptSettled,
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: connectorGenerationKeys.attempt(attemptId),
			});
			setPollFallback(true);
		},
	});

	useEffect(() => {
		if (live.failed) setPollFallback(true);
	}, [live.failed]);

	// Elapsed clock for the in-flight card, anchored on the durable row's
	// createdAt once known (mount time until then).
	const mountedAt = useRef(Date.now());
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (attemptSettled) return;
		const timer = setInterval(() => setNow(Date.now()), 1_000);
		return () => clearInterval(timer);
	}, [attemptSettled]);

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

	// queued / running / first fetch still in flight.
	const queued =
		live.status !== undefined
			? QUEUED_RUN_STATUSES.has(live.status)
			: attempt?.status !== "running";
	const startedAtMs = attempt
		? Date.parse(attempt.createdAt)
		: mountedAt.current;
	const elapsedSeconds = Math.max(0, Math.floor((now - startedAtMs) / 1_000));

	return (
		<div className="overflow-hidden rounded-[14px] border border-border bg-background p-3.5">
			<div className="flex items-center gap-2">
				<p
					dir="auto"
					className="min-w-0 flex-1 truncate font-medium text-[13.5px] text-foreground"
				>
					{title}
				</p>
				<span className="shrink-0 rounded-full border border-primary/35 bg-primary/5 px-2 py-0.5 font-mono text-[10px] text-ember-text uppercase tracking-wider">
					{queued
						? t("workspace.chat.mcpTool.generation.statusQueued")
						: t("workspace.chat.mcpTool.generation.statusGenerating")}
				</span>
			</div>

			<div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted">
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
				{t("workspace.chat.mcpTool.generation.workingHint")}
			</p>

			<p
				dir="ltr"
				className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground"
			>
				<span aria-hidden className="size-1.5 rounded-full bg-primary" />
				<span className="text-ember-text">{formatElapsed(elapsedSeconds)}</span>
				<span>/ {t("workspace.chat.mcpTool.generation.usually")}</span>
			</p>
		</div>
	);
}

function formatElapsed(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

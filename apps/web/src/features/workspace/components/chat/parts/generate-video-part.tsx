// In-thread card for a generate_video call. The render runs in a background
// task; this part subscribes to the Trigger.dev run over Realtime (staged
// "progress" metadata pushed, zero polling) and renders a cinematic "stage"
// card: a dark 16:9 viewport with a pulsing equalizer while rendering, then
// the playable clip centered inside the same stage (a 9:16 video sits small
// and pillarboxed instead of stretching the card). The durable attempt row
// stays the source of truth: polled slowly as a safety net, fast when the
// subscription dies, so a crashed run still resolves via the reconciler.
// Chrome strings hardcoded English this pass, same rule as the tray files.

import { useQueryClient } from "@tanstack/react-query";
import type {
	MediaGenerationAttempt,
	TriggerRealtimeHandle,
	VideoBuildProgress,
} from "@wandit/contracts";
import { videoBuildProgressSchema } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { AlertTriangle, Check, Download, FolderOpen, Play } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { creditsKeys } from "@/features/credits";
import {
	mediaGenerationKeys,
	useMediaGenerationAttemptQuery,
} from "../../../api/media-generations.queries";
import { mediaGenerationDownloadUrl } from "../../../api/media-generations.services";
import { useWorkspace } from "../../../lib/store";
import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { useLiveRun } from "../../../lib/use-live-run";
import { SpinnerArc } from "../request-tray/tray-signals";
import { StatusMessageHeader } from "../status-message-header";
import { ChatMediaLightbox } from "./chat-media";

type GenerateVideoToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-generate_video" }
>;

export function GenerateVideoPart({ part }: { part: GenerateVideoToolPart }) {
	// The creative brief streams in first, then the tool executes server-side
	// (including the director's prompt-writing pass).
	if (part.state === "input-streaming" || part.state === "input-available") {
		return (
			<WorkingLine
				text={
					part.state === "input-streaming"
						? "Composing the creative brief…"
						: "Writing the director's cut…"
				}
			/>
		);
	}

	if (part.state === "output-error") {
		return (
			<div>
				<StatusMessageHeader
					avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
					kickerClass="text-destructive"
					kicker="Video generation failed to start"
				>
					<AlertTriangle className="size-3" aria-hidden />
				</StatusMessageHeader>
				<p
					dir="auto"
					className="text-[13px] text-muted-foreground leading-[1.5]"
				>
					{part.errorText}
				</p>
			</div>
		);
	}

	if (part.state !== "output-available") return null;

	if (part.output.status === "queued" && part.output.attemptId) {
		return (
			<VideoGenerationCard
				attemptId={part.output.attemptId}
				realtime={part.output.realtime}
				fallbackTitle={part.input.title}
			/>
		);
	}

	// "unavailable" — the server is missing provider/storage credentials;
	// relay the tool's honest message instead of pretending a render runs.
	return (
		<p dir="auto" className="text-[13px] text-muted-foreground leading-[1.5]">
			{part.output.message}
		</p>
	);
}

/** Subscribes to the run and picks the progress / result / failed view. */
function VideoGenerationCard({
	attemptId,
	realtime,
	fallbackTitle,
}: {
	attemptId: string;
	realtime: TriggerRealtimeHandle | undefined;
	fallbackTitle: string;
}) {
	const queryClient = useQueryClient();
	// Flipped when the subscription dies OR the run settles: the poll re-checks
	// the attempt row until it is terminal (its interval stops by itself), so a
	// crashed run still resolves via the server's reconciler.
	const [pollFallback, setPollFallback] = useState(false);

	// Fast interval without a usable subscription; slow safety net with one —
	// a silently-dead Realtime stream must never freeze the card until reload.
	const intervalMs = !realtime || pollFallback ? 1500 : 15_000;
	const { data: attempt, error } = useMediaGenerationAttemptQuery(
		attemptId,
		intervalMs,
	);
	const attemptSettled =
		attempt?.status === "succeeded" || attempt?.status === "failed";
	const terminalStatus = attemptSettled ? attempt.status : null;

	useEffect(() => {
		if (!terminalStatus) return;
		void queryClient.invalidateQueries({ queryKey: creditsKeys.balance() });
	}, [queryClient, terminalStatus]);

	const live = useLiveRun({
		handle: realtime,
		enabled: !attemptSettled,
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: mediaGenerationKeys.attempt(attemptId),
			});
			setPollFallback(true);
		},
	});

	useEffect(() => {
		if (live.failed) setPollFallback(true);
	}, [live.failed]);

	if (error) {
		return (
			<p className="text-[13px] text-muted-foreground leading-[1.5]">
				Couldn't load the video status — reopen this chat to retry.
			</p>
		);
	}

	if (attempt?.status === "failed") {
		return (
			<div>
				<StatusMessageHeader
					avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
					kickerClass="text-destructive"
					kicker="Video generation failed"
				>
					<AlertTriangle className="size-3" aria-hidden />
				</StatusMessageHeader>
				<p
					dir="auto"
					className="text-[13px] text-muted-foreground leading-[1.5]"
				>
					{attempt.error ?? "The render stopped before finishing."}
				</p>
			</div>
		);
	}

	if (attempt?.status === "succeeded" && attempt.videoUrl) {
		return (
			<VideoResultCard
				attempt={attempt}
				title={attempt.title ?? fallbackTitle}
				videoUrl={attempt.videoUrl}
			/>
		);
	}

	// queued / generating / first fetch still in flight. A dead subscription's
	// last-pushed metadata must not shadow the fresher polled row.
	const parsed = videoBuildProgressSchema.safeParse(
		live.failed ? undefined : live.metadata?.progress,
	);

	return (
		<VideoProgressCard
			attempt={attempt}
			progress={parsed.success ? parsed.data : undefined}
			title={attempt?.title ?? fallbackTitle}
		/>
	);
}

/* ---------- the cinematic stage (shared by both states) ---------- */

/**
 * Fixed 16:9 dark viewport with a warm ember glow. Whatever plays inside is
 * centered and keeps its own ratio — a 9:16 clip stays a slim pillarboxed
 * phone frame instead of stretching the card to full width.
 */
function VideoStage({ children }: { children: React.ReactNode }) {
	return (
		<div className="relative aspect-video w-full overflow-hidden bg-[#171210]">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(95%_85%_at_50%_100%,rgba(198,95,51,0.35),rgba(23,18,16,0)_65%)]"
			/>
			<div className="absolute inset-0 flex items-center justify-center p-3">
				{children}
			</div>
		</div>
	);
}

function StageChip({
	position,
	children,
}: {
	position: "bottom-left" | "bottom-right" | "top-left";
	children: React.ReactNode;
}) {
	return (
		<span
			className={cn(
				"pointer-events-none absolute z-10 inline-flex max-w-[62%] items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[11px] text-white/85 backdrop-blur",
				position === "bottom-left" && "bottom-2.5 left-2.5",
				position === "bottom-right" && "right-2.5 bottom-2.5",
				position === "top-left" && "top-2.5 left-2.5",
			)}
		>
			{children}
		</span>
	);
}

// Warm equalizer pulse while the provider renders — the "something is being
// made" signal. Bar geometry mirrors the prototype: short ambers around a
// tall ember center.
const EQ_BARS = [
	{ color: "#c9913f", height: 18 },
	{ color: "#b97f36", height: 26 },
	{ color: "#c9913f", height: 22 },
	{ color: "#c65f33", height: 44 },
	{ color: "#d9a44a", height: 34 },
	{ color: "#c65f33", height: 40 },
	{ color: "#b97f36", height: 30 },
] as const;

function EqualizerBars() {
	return (
		<div aria-hidden className="flex items-center gap-[7px]">
			{EQ_BARS.map((bar, index) => (
				<motion.span
					// biome-ignore lint/suspicious/noArrayIndexKey: static ordered geometry
					key={index}
					className="w-[9px] rounded-full"
					style={{ backgroundColor: bar.color, height: bar.height }}
					animate={{ scaleY: [0.55, 1, 0.7, 1, 0.55] }}
					transition={{
						duration: 1.6,
						delay: index * 0.13,
						ease: "easeInOut",
						repeat: Number.POSITIVE_INFINITY,
					}}
				/>
			))}
		</div>
	);
}

/* ---------- progress card ---------- */

function VideoProgressCard({
	attempt,
	progress,
	title,
}: {
	attempt: MediaGenerationAttempt | undefined;
	/** Staged snapshot pushed over Realtime — fresher than the polled row. */
	progress: VideoBuildProgress | undefined;
	title: string;
}) {
	const generating = attempt?.status === "generating";
	// The director's prompt is snapshotted at queue time, so the polled row
	// carries it even before the run pushes its first metadata.
	const promptExcerpt =
		progress?.promptExcerpt ?? attempt?.prompt.slice(0, 400) ?? null;
	const aspect = progress?.aspect ?? attempt?.aspect ?? "16:9";
	const durationSeconds =
		progress?.durationSeconds ?? attempt?.durationSeconds ?? 10;
	const percent = Math.round(progress?.percent ?? (generating ? 15 : 4));
	const phase = progress?.phase ?? (generating ? "rendering" : "starting");
	const rendering = phase === "rendering" || generating;
	// Still queued also shows the render row alive ("In queue") — an
	// all-pending checklist reads as a dead card.
	const renderState: "done" | "active" =
		phase === "publishing" || phase === "finishing" ? "done" : "active";
	const inQueue = renderState === "active" && !rendering;
	const publishState: "done" | "active" | "pending" =
		phase === "finishing"
			? "done"
			: phase === "publishing"
				? "active"
				: "pending";
	const elapsedMs = progress?.elapsedMs ?? 0;

	return (
		<div className="overflow-hidden rounded-[14px] border border-border bg-background">
			<VideoStage>
				<EqualizerBars />
				<StageChip position="bottom-left">
					<span dir="auto" className="min-w-0 truncate">
						{title}
					</span>
					<span className="shrink-0 text-white/50">· {aspect}</span>
				</StageChip>
				{elapsedMs > 0 ? (
					<StageChip position="bottom-right">
						<span dir="ltr">{formatClock(elapsedMs)}</span>
					</StageChip>
				) : null}
			</VideoStage>
			<div className="flex flex-col gap-[9px] p-[15px] text-[13.5px]">
				<StepRow state="done">Director's cut written</StepRow>
				{promptExcerpt ? (
					<p
						dir="auto"
						className="ms-[25px] truncate text-[12px] text-muted-foreground italic"
					>
						{promptExcerpt}
					</p>
				) : null}
				<StepRow state={renderState}>
					{renderState === "done"
						? `Rendered the ${durationSeconds}-second clip`
						: `Rendering the ${durationSeconds}-second clip…`}
				</StepRow>
				{renderState === "active" ? (
					<p className="ms-[25px] font-mono text-[11px] text-ember-text uppercase tracking-[0.12em]">
						{inQueue ? "In queue" : `${percent}%`}
					</p>
				) : null}
				<StepRow state={publishState}>
					{publishState === "done"
						? "Published"
						: publishState === "active"
							? "Publishing…"
							: "Publish"}
				</StepRow>
			</div>
			<span
				role="status"
				aria-live="polite"
				aria-atomic="true"
				className="sr-only"
			>
				Generating the video. {progress?.headline ?? "Working on the video…"}
			</span>
		</div>
	);
}

/* ---------- result card ---------- */

function VideoResultCard({
	attempt,
	title,
	videoUrl,
}: {
	attempt: MediaGenerationAttempt;
	title: string;
	videoUrl: string;
}) {
	const { setTab } = useWorkspace();
	// Clicking the stage opens the clip full screen INSIDE the app — the same
	// overlay the chat gallery and the Assets tab use. New tabs are the Assets
	// tab's business, not this card's.
	const [viewerOpen, setViewerOpen] = useState(false);
	const extension = attempt.videoMediaType === "video/webm" ? "webm" : "mp4";
	const filename = `wandit-video.${extension}`;
	const totalMs =
		attempt.completedAt !== null
			? new Date(attempt.completedAt).getTime() -
				new Date(attempt.createdAt).getTime()
			: null;
	const portrait = attempt.aspect !== "16:9";

	return (
		<div className="overflow-hidden rounded-[14px] border border-border bg-background">
			<VideoStage>
				<video
					src={videoUrl}
					muted
					playsInline
					preload="metadata"
					className={cn(
						"h-full w-auto max-w-full object-contain",
						// A portrait/square clip floats as its own framed screen on
						// the stage; a 16:9 clip owns the whole viewport.
						portrait && "rounded-[10px] shadow-lg ring-1 ring-white/12",
					)}
					aria-hidden
				/>
				<button
					type="button"
					onClick={() => setViewerOpen(true)}
					aria-label={`Play ${title}`}
					className="group absolute inset-0 z-[5] cursor-pointer"
				>
					<span className="absolute inset-0 grid place-items-center">
						<span className="grid size-12 place-items-center rounded-full bg-white/92 shadow-lg transition-transform group-hover:scale-105">
							<Play
								className="ms-0.5 size-5 fill-current text-[#c65f33]"
								aria-hidden
							/>
						</span>
					</span>
				</button>
				<StageChip position="top-left">{attempt.aspect}</StageChip>
				<StageChip position="bottom-left">
					<span dir="ltr" className="min-w-0 truncate">
						{filename}
					</span>
				</StageChip>
				<StageChip position="bottom-right">
					<span dir="ltr">
						0:{String(attempt.durationSeconds).padStart(2, "0")}
					</span>
				</StageChip>
			</VideoStage>
			<div className="p-3">
				<div className="mb-1 flex items-center gap-2.5">
					<DoneCircle />
					<span
						dir="auto"
						className="min-w-0 flex-1 truncate font-medium text-[13.5px] text-foreground"
					>
						{title}
					</span>
					{totalMs !== null ? (
						<span
							dir="ltr"
							className="shrink-0 font-mono text-[11px] text-muted-foreground"
						>
							{formatClock(totalMs)}
						</span>
					) : null}
				</div>
				<p className="ms-[25px] mb-3 text-[12px] text-muted-foreground">
					All steps done
				</p>
				<div className="flex gap-2">
					<Button asChild size="sm" className="h-9 flex-1 text-[13.5px]">
						<a
							href={mediaGenerationDownloadUrl(attempt.id)}
							download={filename}
						>
							<Download className="size-4" aria-hidden />
							Download
						</a>
					</Button>
					<Button
						size="sm"
						variant="outline"
						className="h-9 flex-1 text-[13.5px]"
						onClick={() => setTab("assets")}
					>
						<FolderOpen className="size-4" aria-hidden />
						View in Assets
					</Button>
				</div>
			</div>
			{viewerOpen ? (
				<ChatMediaLightbox
					items={[
						{
							downloadUrl: mediaGenerationDownloadUrl(attempt.id),
							key: attempt.id,
							kind: "video",
							label: title,
							url: videoUrl,
						},
					]}
					index={0}
					onNavigate={() => undefined}
					onClose={() => setViewerOpen(false)}
				/>
			) : null}
			<span
				role="status"
				aria-live="polite"
				aria-atomic="true"
				className="sr-only"
			>
				Video ready.
			</span>
		</div>
	);
}

/* ---------- shared bits (same idiom as the scrape-leads card) ---------- */

function StepRow({
	state,
	badge,
	children,
}: {
	state: "done" | "active" | "pending";
	badge?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-2.5",
				state === "done" && "text-muted-foreground",
				state === "active" && "font-medium text-foreground",
				state === "pending" && "text-faint",
			)}
		>
			{state === "done" ? (
				<DoneCircle />
			) : state === "active" ? (
				<SpinnerArc className="size-[15px] shrink-0" />
			) : (
				<PendingRing />
			)}
			<span className="min-w-0 flex-1 truncate">{children}</span>
			{badge}
		</div>
	);
}

function DoneCircle() {
	return (
		<span className="grid size-[15px] shrink-0 place-items-center rounded-full bg-success/16">
			<Check className="size-2.5 text-success" strokeWidth={2.5} aria-hidden />
		</span>
	);
}

function PendingRing() {
	return (
		<span
			aria-hidden
			className="size-[15px] shrink-0 rounded-full border-2 border-stone"
		/>
	);
}

function WorkingLine({ text }: { text: string }) {
	return (
		<div className="flex items-center gap-2 text-[13px] text-muted-foreground">
			<SpinnerArc className="size-3.5" />
			<span>{text}</span>
		</div>
	);
}

function formatClock(elapsedMs: number): string {
	const totalSeconds = Math.floor(elapsedMs / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

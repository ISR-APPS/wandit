// In-thread card shared by generate_video, edit_video, and extend_video. Each
// wrapper supplies its own copy while the attempt core owns Realtime progress,
// polling fallback, failure handling, and the finished cinematic stage.

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
import { useTranslation } from "@/lib/i18n";
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

type EditVideoToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-edit_video" }
>;

type ExtendVideoToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-extend_video" }
>;

type VideoToolPart =
	| GenerateVideoToolPart
	| EditVideoToolPart
	| ExtendVideoToolPart;

type VideoPieceProgress = {
	current: number;
	total: number;
};

type VideoAttemptCopy = {
	preparing: string;
	queueing: string;
	failedToStart: string;
	failedTitle: string;
	failedBody: string;
	statusLoadError: string;
	prepared: string;
	active: (durationSeconds: number) => string;
	done: (durationSeconds: number) => string;
	inQueue: string;
	extractingFrame: (piece: VideoPieceProgress | null) => string;
	renderingPiece: (piece: VideoPieceProgress | null) => string;
	joining: string;
	narration: string;
	narrationFailed?: string;
	publish: string;
	publishing: string;
	published: string;
	complete: string;
	ready: string;
	download: string;
	viewAssets: string;
	play: (title: string) => string;
};

// Keep generate_video's established English chrome unchanged in this batch.
const GENERATE_VIDEO_COPY: VideoAttemptCopy = {
	preparing: "Composing the creative brief…",
	queueing: "Writing the director's cut…",
	failedToStart: "Video generation failed to start",
	failedTitle: "Video generation failed",
	failedBody: "The render stopped before finishing.",
	statusLoadError:
		"Couldn't load the video status — reopen this chat to retry.",
	prepared: "Director's cut written",
	active: (durationSeconds) => `Rendering the ${durationSeconds}-second clip…`,
	done: (durationSeconds) => `Rendered the ${durationSeconds}-second clip`,
	inQueue: "In queue",
	extractingFrame: (piece) =>
		piece
			? `Preparing piece ${piece.current} of ${piece.total}…`
			: "Preparing the next piece…",
	renderingPiece: (piece) =>
		piece
			? `Rendering piece ${piece.current} of ${piece.total}…`
			: "Rendering the next piece…",
	joining: "Joining the pieces…",
	narration: "Laying the narration…",
	publish: "Publish",
	publishing: "Publishing…",
	published: "Published",
	complete: "All steps done",
	ready: "Video ready.",
	download: "Download",
	viewAssets: "View in Assets",
	play: (title) => `Play ${title}`,
};

export function GenerateVideoPart({ part }: { part: GenerateVideoToolPart }) {
	return <VideoAttemptPart copy={GENERATE_VIDEO_COPY} part={part} />;
}

export function EditVideoPart({ part }: { part: EditVideoToolPart }) {
	const { t } = useTranslation();
	const copy: VideoAttemptCopy = {
		preparing: t("workspace.chat.videoAttempt.edit.preparing"),
		queueing: t("workspace.chat.videoAttempt.edit.queueing"),
		failedToStart: t("workspace.chat.videoAttempt.edit.failedToStart"),
		failedTitle: t("workspace.chat.videoAttempt.edit.failedTitle"),
		failedBody: t("workspace.chat.videoAttempt.edit.failedBody"),
		statusLoadError: t("workspace.chat.videoAttempt.statusLoadError"),
		prepared: t("workspace.chat.videoAttempt.edit.prepared"),
		active: (durationSeconds) =>
			t("workspace.chat.videoAttempt.edit.active", {
				seconds: durationSeconds,
			}),
		done: (durationSeconds) =>
			t("workspace.chat.videoAttempt.edit.done", {
				seconds: durationSeconds,
			}),
		inQueue: t("workspace.chat.videoAttempt.inQueue"),
		extractingFrame: (piece) =>
			piece
				? t("workspace.chat.videoAttempt.extractingFrame", piece)
				: t("workspace.chat.videoAttempt.extractingFrameFallback"),
		renderingPiece: (piece) =>
			piece
				? t("workspace.chat.videoAttempt.renderingPiece", piece)
				: t("workspace.chat.videoAttempt.renderingPieceFallback"),
		joining: t("workspace.chat.videoAttempt.joining"),
		narration: t("workspace.chat.videoAttempt.narration"),
		publish: t("workspace.chat.videoAttempt.publish"),
		publishing: t("workspace.chat.videoAttempt.edit.publishing"),
		published: t("workspace.chat.videoAttempt.published"),
		complete: t("workspace.chat.videoAttempt.edit.complete"),
		ready: t("workspace.chat.videoAttempt.edit.ready"),
		download: t("workspace.chat.videoAttempt.download"),
		viewAssets: t("workspace.chat.videoAttempt.viewAssets"),
		play: (title) => t("workspace.chat.videoAttempt.play", { title }),
	};

	return <VideoAttemptPart copy={copy} part={part} />;
}

export function ExtendVideoPart({ part }: { part: ExtendVideoToolPart }) {
	const { t } = useTranslation();
	const copy: VideoAttemptCopy = {
		preparing: t("workspace.chat.videoAttempt.extend.preparing"),
		queueing: t("workspace.chat.videoAttempt.extend.queueing"),
		failedToStart: t("workspace.chat.videoAttempt.extend.failedToStart"),
		failedTitle: t("workspace.chat.videoAttempt.extend.failedTitle"),
		failedBody: t("workspace.chat.videoAttempt.extend.failedBody"),
		statusLoadError: t("workspace.chat.videoAttempt.statusLoadError"),
		prepared: t("workspace.chat.videoAttempt.extend.prepared"),
		active: (durationSeconds) =>
			t("workspace.chat.videoAttempt.extend.active", {
				seconds: durationSeconds,
			}),
		done: (durationSeconds) =>
			t("workspace.chat.videoAttempt.extend.done", {
				seconds: durationSeconds,
			}),
		inQueue: t("workspace.chat.videoAttempt.inQueue"),
		extractingFrame: (piece) =>
			piece
				? t("workspace.chat.videoAttempt.extractingFrame", piece)
				: t("workspace.chat.videoAttempt.extractingFrameFallback"),
		renderingPiece: (piece) =>
			piece
				? t("workspace.chat.videoAttempt.renderingPiece", piece)
				: t("workspace.chat.videoAttempt.renderingPieceFallback"),
		joining: t("workspace.chat.videoAttempt.joining"),
		narration: t("workspace.chat.videoAttempt.narration"),
		narrationFailed: t("workspace.chat.videoAttempt.narrationFailed"),
		publish: t("workspace.chat.videoAttempt.publish"),
		publishing: t("workspace.chat.videoAttempt.extend.publishing"),
		published: t("workspace.chat.videoAttempt.published"),
		complete: t("workspace.chat.videoAttempt.extend.complete"),
		ready: t("workspace.chat.videoAttempt.extend.ready"),
		download: t("workspace.chat.videoAttempt.download"),
		viewAssets: t("workspace.chat.videoAttempt.viewAssets"),
		play: (title) => t("workspace.chat.videoAttempt.play", { title }),
	};

	return <VideoAttemptPart copy={copy} part={part} />;
}

function VideoAttemptPart({
	part,
	copy,
}: {
	part: VideoToolPart;
	copy: VideoAttemptCopy;
}) {
	if (part.state === "input-streaming" || part.state === "input-available") {
		return (
			<WorkingLine
				text={part.state === "input-streaming" ? copy.preparing : copy.queueing}
			/>
		);
	}

	if (part.state === "output-error") {
		return (
			<div>
				<StatusMessageHeader
					avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
					kickerClass="text-destructive"
					kicker={copy.failedToStart}
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
			<VideoAttemptCard
				attemptId={part.output.attemptId}
				realtime={part.output.realtime}
				fallbackTitle={part.input.title}
				copy={copy}
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
function VideoAttemptCard({
	attemptId,
	realtime,
	fallbackTitle,
	copy,
}: {
	attemptId: string;
	realtime: TriggerRealtimeHandle | undefined;
	fallbackTitle: string;
	copy: VideoAttemptCopy;
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
				{copy.statusLoadError}
			</p>
		);
	}

	if (attempt?.status === "failed") {
		return (
			<div>
				<StatusMessageHeader
					avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
					kickerClass="text-destructive"
					kicker={copy.failedTitle}
				>
					<AlertTriangle className="size-3" aria-hidden />
				</StatusMessageHeader>
				<p
					dir="auto"
					className="text-[13px] text-muted-foreground leading-[1.5]"
				>
					{attempt.error ?? copy.failedBody}
				</p>
			</div>
		);
	}

	if (attempt?.status === "succeeded" && attempt.videoUrl) {
		return (
			<VideoResultCard
				attempt={attempt}
				copy={copy}
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
			copy={copy}
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
	copy,
	progress,
	title,
}: {
	attempt: MediaGenerationAttempt | undefined;
	copy: VideoAttemptCopy;
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
	const publishing = progress?.stage === "publishing" || phase === "publishing";
	const finishing = progress?.stage === "finishing" || phase === "finishing";
	const rendering =
		phase === "rendering" ||
		generating ||
		progress?.stage === "rendering" ||
		progress?.stage === "rendering-leg" ||
		progress?.stage === "extracting-frame" ||
		progress?.stage === "joining" ||
		progress?.stage === "soundtrack";
	// Still queued also shows the render row alive ("In queue") — an
	// all-pending checklist reads as a dead card.
	const renderState: "done" | "active" =
		publishing || finishing ? "done" : "active";
	const inQueue = renderState === "active" && !rendering;
	const publishState: "done" | "active" | "pending" = finishing
		? "done"
		: publishing
			? "active"
			: "pending";
	const elapsedMs = progress?.elapsedMs ?? 0;
	const activeStep = videoActiveStep(copy, progress, durationSeconds);
	const announcedStatus =
		publishState === "done"
			? copy.ready
			: publishState === "active"
				? copy.publishing
				: `${activeStep} ${inQueue ? copy.inQueue : `${percent}%`}`;

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
				<StepRow state="done">{copy.prepared}</StepRow>
				{promptExcerpt ? (
					<p
						dir="auto"
						className="ms-[25px] truncate text-[12px] text-muted-foreground italic"
					>
						{promptExcerpt}
					</p>
				) : null}
				<StepRow state={renderState}>
					{renderState === "done" ? copy.done(durationSeconds) : activeStep}
				</StepRow>
				{renderState === "active" ? (
					<p className="ms-[25px] font-mono text-[11px] text-ember-text uppercase tracking-[0.12em]">
						{inQueue ? copy.inQueue : `${percent}%`}
					</p>
				) : null}
				<StepRow state={publishState}>
					{publishState === "done"
						? copy.published
						: publishState === "active"
							? copy.publishing
							: copy.publish}
				</StepRow>
			</div>
			<span
				role="status"
				aria-live="polite"
				aria-atomic="true"
				className="sr-only"
			>
				{announcedStatus}
			</span>
		</div>
	);
}

function videoActiveStep(
	copy: VideoAttemptCopy,
	progress: VideoBuildProgress | undefined,
	durationSeconds: number,
): string {
	switch (progress?.stage) {
		case "rendering-leg":
			return copy.renderingPiece(videoPieceProgress(progress.headline));
		case "extracting-frame":
			return copy.extractingFrame(videoPieceProgress(progress.headline));
		case "joining":
			return copy.joining;
		case "soundtrack":
			return copy.narration;
		case "publishing":
			return copy.publishing;
		case "finishing":
			return copy.ready;
		default:
			// Unknown stages are caught to null by videoBuildProgressSchema and use
			// the established kind-generic wording.
			return copy.active(durationSeconds);
	}
}

function videoPieceProgress(headline: string): VideoPieceProgress | null {
	// Realtime does not expose structured leg indexes yet. Current workers put
	// the durable sequence in their headline; parse only that narrow shape and
	// fall back to localized non-numbered copy if it ever changes.
	const match = /\bpiece\s+(\d+)\s+of\s+(\d+)\b/i.exec(headline);
	if (!match) return null;

	const current = Number(match[1]);
	const total = Number(match[2]);
	if (
		!Number.isInteger(current) ||
		!Number.isInteger(total) ||
		current < 1 ||
		total < current
	) {
		return null;
	}

	return { current, total };
}

/* ---------- result card ---------- */

function VideoResultCard({
	attempt,
	copy,
	title,
	videoUrl,
}: {
	attempt: MediaGenerationAttempt;
	copy: VideoAttemptCopy;
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
	const narrationFailed =
		attempt.voiceover?.deliveryStatus === "failed"
			? copy.narrationFailed
			: undefined;

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
					aria-label={copy.play(title)}
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
					<span dir="ltr">{formatClock(attempt.durationSeconds * 1000)}</span>
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
				<p
					className={cn(
						"ms-[25px] text-[12px] text-muted-foreground",
						narrationFailed ? "mb-1" : "mb-3",
					)}
				>
					{copy.complete}
				</p>
				{narrationFailed ? (
					<p dir="auto" className="ms-[25px] mb-3 text-[12px] text-destructive">
						{narrationFailed}
					</p>
				) : null}
				<div className="flex gap-2">
					<Button asChild size="sm" className="h-9 flex-1 text-[13.5px]">
						<a
							href={mediaGenerationDownloadUrl(attempt.id)}
							download={filename}
						>
							<Download className="size-4" aria-hidden />
							{copy.download}
						</a>
					</Button>
					<Button
						size="sm"
						variant="outline"
						className="h-9 flex-1 text-[13.5px]"
						onClick={() => setTab("assets")}
					>
						<FolderOpen className="size-4" aria-hidden />
						{copy.viewAssets}
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
				{copy.ready}
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

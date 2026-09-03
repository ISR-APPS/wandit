// In-thread card for a generate_video call (native twin of web
// generate-video-part.tsx). The render runs in a background task; this card
// subscribes to the Trigger.dev run over Realtime (staged "progress" metadata,
// zero polling while healthy) and renders a cinematic "stage": a dark 16:9
// viewport with a pulsing equalizer while rendering, then the playable clip
// centered inside the same stage (a 9:16 video sits small and pillarboxed
// instead of stretching the card). The durable attempt row stays the source
// of truth: polled slowly as a safety net, fast when the subscription dies,
// so a crashed run still resolves via the reconciler.

import { useQueryClient } from "@tanstack/react-query";
import type {
	MediaGenerationAttempt,
	TriggerRealtimeHandle,
	VideoBuildProgress,
} from "@wandit/contracts";
import { videoBuildProgressSchema } from "@wandit/contracts";
import { useTranslation } from "@wandit/internationalization/react";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useThemeColor } from "heroui-native";
import { type ReactNode, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import Svg, {
	Defs,
	Rect,
	Stop,
	RadialGradient as SvgRadialGradient,
} from "react-native-svg";

import { WanditIcon } from "@/components/wandit-icon";
import { creditsKeys } from "@/features/credits";
import { mediaGenerationKeys } from "../api/generation.keys";
import {
	DURABLE_POLL_INTERVAL_MS,
	REALTIME_BACKSTOP_INTERVAL_MS,
	useMediaGenerationAttemptQuery,
} from "../api/generation.queries";
import { mediaGenerationDownloadUrl } from "../api/generation.requests";
import { projectAssetKeys } from "../api/project-assets.queries";
import { chatErrorPresentation, readAiErrorData } from "../lib/ai-error-copy";
import {
	downloadAndShareMedia,
	isMediaDownloadError,
} from "../lib/download-media";
import { useLiveRun } from "../lib/use-live-run";
import { ChatMediaViewer } from "./chat-media";
import { formatClock } from "./elapsed-timer";
import { SpinnerArc } from "./spinner-arc";
import { StatusMessageHeader } from "./status-message-header";

/** Subscribes to the run and picks the progress / result / failed view. */
export function VideoGenerationCard({
	attemptId,
	realtime,
	fallbackTitle,
	projectId,
	onPrefillComposer,
	originalPrompt,
}: {
	attemptId: string;
	realtime: TriggerRealtimeHandle | undefined;
	fallbackTitle: string | undefined;
	projectId: string;
	onPrefillComposer?: (prompt: string) => void;
	originalPrompt?: string;
}) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	// Flipped when the subscription dies OR the run settles: the poll re-checks
	// the attempt row until it is terminal (its interval stops by itself), so a
	// crashed run still resolves via the server's reconciler.
	const [pollFallback, setPollFallback] = useState(false);

	// Fast interval without a usable subscription; slow safety net with one —
	// a silently-dead Realtime stream must never freeze the card until reload.
	const intervalMs =
		!realtime || pollFallback
			? DURABLE_POLL_INTERVAL_MS.animate
			: REALTIME_BACKSTOP_INTERVAL_MS;
	const attemptQuery = useMediaGenerationAttemptQuery(attemptId, intervalMs);
	const attempt = attemptQuery.data;
	const attemptSettled =
		attempt?.status === "succeeded" || attempt?.status === "failed";
	const terminalStatus = attemptSettled ? attempt.status : null;

	useEffect(() => {
		if (!terminalStatus) return;
		void queryClient.invalidateQueries({ queryKey: creditsKeys.balance() });
		// A finished clip belongs in the Assets view the next time it opens.
		if (terminalStatus === "succeeded") {
			void queryClient.invalidateQueries({
				queryKey: projectAssetKeys.list(projectId),
			});
		}
	}, [queryClient, terminalStatus, projectId]);

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

	if (attemptQuery.error) {
		return (
			<Text className="text-[13px] text-muted leading-[19px]">
				{t("workspace.chat.generateVideo.statusLoadError")}
			</Text>
		);
	}

	if (attempt?.status === "failed") {
		const failure = readAiErrorData(attempt);
		const presentation = failure
			? chatErrorPresentation(null, failure, t)
			: null;
		return (
			<View className="gap-1.5">
				<StatusMessageHeader
					tone="danger"
					kicker={
						presentation?.kicker ??
						t("workspace.chat.generateVideo.failedTitle")
					}
				/>
				<Text
					className="text-[13px] text-muted leading-[19px]"
					style={{ writingDirection: "auto" }}
				>
					{presentation?.body ??
						attempt.error ??
						t("workspace.chat.generateVideo.failedBody")}
				</Text>
				{presentation?.attribution ? (
					<Text
						className="text-[11.5px] text-muted/80 leading-[17px]"
						style={{ writingDirection: "auto" }}
					>
						{presentation.attribution}
					</Text>
				) : null}
				{presentation?.retryable && originalPrompt && onPrefillComposer ? (
					<View className="mt-1 items-start gap-1">
						<Pressable
							accessibilityRole="button"
							onPress={() => onPrefillComposer(originalPrompt)}
							className="min-h-9 items-center justify-center rounded-lg border border-border px-3 active:bg-surface-secondary"
						>
							<Text className="font-sans-semibold text-[12px] text-foreground">
								{t("native.workspace.chat.aiError.tryAgainPrefill.video")}
							</Text>
						</Pressable>
						<Text className="text-[10.5px] text-muted leading-[15px]">
							{t("native.workspace.chat.aiError.tryAgainPrefill.hint")}
						</Text>
					</View>
				) : null}
			</View>
		);
	}

	if (attempt?.status === "succeeded" && attempt.videoUrl) {
		return (
			<VideoResultCard
				attempt={attempt}
				title={
					attempt.title ??
					fallbackTitle ??
					t("workspace.chat.generateVideo.title")
				}
				videoUrl={attempt.videoUrl}
				projectId={projectId}
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
			title={
				attempt?.title ??
				fallbackTitle ??
				t("workspace.chat.generateVideo.title")
			}
		/>
	);
}

/* ---------- the cinematic stage (shared by both states) ---------- */

// Theme-independent by design (web parity): the stage is a dark viewport in
// light mode too — do not tokenize.
const STAGE_BACKGROUND = "#171210";

/**
 * Fixed 16:9 dark viewport with a warm ember glow. Whatever plays inside is
 * centered and keeps its own ratio — a 9:16 clip stays a slim pillarboxed
 * phone frame instead of stretching the card to full width.
 */
function VideoStage({ children }: { children: ReactNode }) {
	return (
		<View
			className="relative w-full overflow-hidden"
			style={{ aspectRatio: 16 / 9, backgroundColor: STAGE_BACKGROUND }}
		>
			<Svg
				pointerEvents="none"
				style={{ position: "absolute", inset: 0 }}
				width="100%"
				height="100%"
			>
				<Defs>
					<SvgRadialGradient id="videoStageGlow" cx="50%" cy="100%" r="90%">
						<Stop offset="0" stopColor="rgba(198,95,51,0.35)" />
						<Stop offset="0.65" stopColor="rgba(23,18,16,0)" />
					</SvgRadialGradient>
				</Defs>
				<Rect
					x="0"
					y="0"
					width="100%"
					height="100%"
					fill="url(#videoStageGlow)"
				/>
			</Svg>
			<View className="absolute inset-0 items-center justify-center p-3">
				{children}
			</View>
		</View>
	);
}

function StageChip({
	position,
	children,
}: {
	position: "bottom-left" | "bottom-right" | "top-left";
	children: ReactNode;
}) {
	const positionStyle =
		position === "bottom-left"
			? { bottom: 10, left: 10 }
			: position === "bottom-right"
				? { bottom: 10, right: 10 }
				: { top: 10, left: 10 };

	return (
		<View
			pointerEvents="none"
			className="absolute z-10 max-w-[62%] flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
			style={[{ backgroundColor: "rgba(0,0,0,0.55)" }, positionStyle]}
		>
			{children}
		</View>
	);
}

function StageChipText({ children }: { children: ReactNode }) {
	return (
		<Text
			numberOfLines={1}
			className="font-mono text-[11px]"
			style={{ color: "rgba(255,255,255,0.85)" }}
		>
			{children}
		</Text>
	);
}

// Warm equalizer pulse while the provider renders — the "something is being
// made" signal. Bar geometry mirrors the web card: short ambers around a
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
		<View
			accessibilityElementsHidden
			className="flex-row items-center"
			style={{ gap: 7 }}
		>
			{EQ_BARS.map((bar, index) => (
				<Animated.View
					// biome-ignore lint/suspicious/noArrayIndexKey: static ordered geometry
					key={index}
					style={{
						width: 9,
						height: bar.height,
						borderRadius: 999,
						backgroundColor: bar.color,
						animationName: {
							"0%": { transform: [{ scaleY: 0.55 }] },
							"25%": { transform: [{ scaleY: 1 }] },
							"50%": { transform: [{ scaleY: 0.7 }] },
							"75%": { transform: [{ scaleY: 1 }] },
							"100%": { transform: [{ scaleY: 0.55 }] },
						},
						animationDuration: "1600ms",
						animationDelay: `${index * 130}ms`,
						animationIterationCount: "infinite",
						animationTimingFunction: "ease-in-out",
					}}
				/>
			))}
		</View>
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
	const { t } = useTranslation();
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
		<View
			className="overflow-hidden rounded-[14px] border border-border bg-background"
			accessibilityLiveRegion="polite"
		>
			<VideoStage>
				<EqualizerBars />
				<StageChip position="bottom-left">
					<StageChipText>
						{title}
						{"  "}· {aspect}
					</StageChipText>
				</StageChip>
				{elapsedMs > 0 ? (
					<StageChip position="bottom-right">
						<StageChipText>{formatClock(elapsedMs)}</StageChipText>
					</StageChip>
				) : null}
			</VideoStage>
			<View className="gap-[9px] p-[15px]">
				<StepRow state="done">
					{t("workspace.chat.generateVideo.directorsCut")}
				</StepRow>
				{promptExcerpt ? (
					<Text
						numberOfLines={1}
						className="ms-[25px] text-[12px] text-muted italic"
					>
						{promptExcerpt}
					</Text>
				) : null}
				<StepRow state={renderState}>
					{renderState === "done"
						? t("workspace.chat.generateVideo.renderedClip", {
								seconds: durationSeconds,
							})
						: t("workspace.chat.generateVideo.renderingClip", {
								seconds: durationSeconds,
							})}
				</StepRow>
				{renderState === "active" ? (
					// auto, not ltr: the AR inQueue phrase is RTL text; the percent
					// string is direction-neutral and renders the same either way.
					<Text
						className="ms-[25px] font-mono text-[11px] text-accent uppercase"
						style={{ letterSpacing: 1.3, writingDirection: "auto" }}
					>
						{inQueue
							? t("workspace.chat.generateVideo.inQueue")
							: `${percent}%`}
					</Text>
				) : null}
				<StepRow state={publishState}>
					{publishState === "done"
						? t("workspace.chat.generateVideo.published")
						: publishState === "active"
							? t("workspace.chat.generateVideo.publishing")
							: t("workspace.chat.generateVideo.publish")}
				</StepRow>
			</View>
		</View>
	);
}

/* ---------- result card ---------- */

function VideoResultCard({
	attempt,
	title,
	videoUrl,
	projectId,
}: {
	attempt: MediaGenerationAttempt;
	title: string;
	videoUrl: string;
	projectId: string;
}) {
	const { t } = useTranslation();
	const foreground = useThemeColor("foreground");
	// Tapping the stage opens the clip full screen INSIDE the app — the same
	// overlay the chat gallery uses.
	const [viewerOpen, setViewerOpen] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [downloadFailed, setDownloadFailed] = useState(false);
	const player = useVideoPlayer(videoUrl);
	const extension = attempt.videoMediaType === "video/webm" ? "webm" : "mp4";
	const filename = `wandit-video.${extension}`;
	const totalMs =
		attempt.completedAt !== null
			? new Date(attempt.completedAt).getTime() -
				new Date(attempt.createdAt).getTime()
			: null;
	const portrait = attempt.aspect !== "16:9";

	const handleDownload = async () => {
		if (downloading) return;
		setDownloading(true);
		setDownloadFailed(false);
		try {
			await downloadAndShareMedia({
				url: mediaGenerationDownloadUrl(attempt.id),
				filename,
				mimeType: attempt.videoMediaType ?? "video/mp4",
			});
		} catch (error) {
			// Only a real download/write failure is disclosed; the share sheet
			// closing stays silent. The card stays usable, the user can retry.
			if (isMediaDownloadError(error)) setDownloadFailed(true);
		} finally {
			setDownloading(false);
		}
	};

	return (
		<View
			className="overflow-hidden rounded-[14px] border border-border bg-background"
			accessibilityLiveRegion="polite"
		>
			<VideoStage>
				<View
					className={
						portrait
							? "h-full overflow-hidden rounded-[10px] border border-white/12"
							: "h-full w-full"
					}
					style={
						portrait
							? { aspectRatio: aspectRatioOf(attempt.aspect) }
							: undefined
					}
				>
					<VideoView
						player={player}
						contentFit="contain"
						nativeControls={false}
						style={{ width: "100%", height: "100%" }}
						accessibilityLabel={title}
					/>
				</View>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={t("workspace.chat.generateVideo.play", { title })}
					onPress={() => setViewerOpen(true)}
					className="absolute inset-0 z-[5] items-center justify-center"
				>
					<View
						className="h-12 w-12 items-center justify-center rounded-full"
						style={{ backgroundColor: "rgba(255,255,255,0.92)" }}
					>
						<WanditIcon name="play" size={20} color="#c65f33" />
					</View>
				</Pressable>
				<StageChip position="top-left">
					<StageChipText>{attempt.aspect}</StageChipText>
				</StageChip>
				<StageChip position="bottom-left">
					<StageChipText>{filename}</StageChipText>
				</StageChip>
				<StageChip position="bottom-right">
					<StageChipText>
						0:{String(attempt.durationSeconds).padStart(2, "0")}
					</StageChipText>
				</StageChip>
			</VideoStage>
			<View className="p-3">
				<View className="mb-1 flex-row items-center gap-2.5">
					<DoneCircle />
					<Text
						numberOfLines={1}
						className="min-w-0 flex-1 font-sans-medium text-[13.5px] text-foreground"
					>
						{title}
					</Text>
					{totalMs !== null ? (
						<Text
							className="shrink-0 font-mono text-[11px] text-muted"
							style={{ writingDirection: "ltr" }}
						>
							{formatClock(totalMs)}
						</Text>
					) : null}
				</View>
				<Text className="ms-[25px] mb-3 text-[12px] text-muted">
					{t("workspace.chat.generateVideo.allStepsDone")}
				</Text>
				{downloadFailed ? (
					<Text className="pb-2 text-[12px] text-danger leading-[17px]">
						{t("workspace.chat.media.downloadFailed")}
					</Text>
				) : null}
				<View className="flex-row gap-2">
					<Pressable
						accessibilityRole="button"
						onPress={() => void handleDownload()}
						disabled={downloading}
						className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-foreground active:opacity-85"
					>
						{downloading ? (
							<SpinnerArc size={14} />
						) : (
							<WanditIcon name="download" size={14} color="white" />
						)}
						<Text className="font-sans-semibold text-[13px] text-background">
							{t("workspace.chat.generateVideo.download")}
						</Text>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						onPress={() => router.push(`/project/${projectId}/assets`)}
						className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border border-border active:bg-surface-secondary"
					>
						<WanditIcon name="folder" size={14} color={foreground} />
						<Text className="font-sans-semibold text-[13px] text-foreground">
							{t("workspace.chat.generateVideo.viewInAssets")}
						</Text>
					</Pressable>
				</View>
			</View>
			{viewerOpen ? (
				<ChatMediaViewer
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
		</View>
	);
}

function aspectRatioOf(aspect: string): number {
	const [w, h] = aspect.split(":").map(Number);
	return w && h ? w / h : 9 / 16;
}

/* ---------- shared bits (same idiom as the scrape-leads card) ---------- */

function StepRow({
	state,
	children,
}: {
	state: "done" | "active" | "pending";
	children: ReactNode;
}) {
	const textClassName =
		state === "done"
			? "text-muted"
			: state === "active"
				? "font-sans-medium text-foreground"
				: "text-muted/60";

	return (
		<View className="flex-row items-center gap-2.5">
			{state === "done" ? (
				<DoneCircle />
			) : state === "active" ? (
				<SpinnerArc size={15} />
			) : (
				<PendingRing />
			)}
			<Text
				numberOfLines={1}
				className={`min-w-0 flex-1 text-[13.5px] ${textClassName}`}
			>
				{children}
			</Text>
		</View>
	);
}

function DoneCircle() {
	const success = useThemeColor("success");
	return (
		<View className="h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full bg-success/16">
			<WanditIcon name="check" size={9} color={success} strokeWidth={2.5} />
		</View>
	);
}

function PendingRing() {
	return (
		<View
			accessibilityElementsHidden
			className="h-[15px] w-[15px] shrink-0 rounded-full border-2 border-border"
		/>
	);
}

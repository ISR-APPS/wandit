// Live page-build card: subscribes to the Trigger run over Realtime (the
// Electric long-poll in use-live-run — zero interval polling) and folds the
// worker's metadata "progress" into the web card's checklist: art generated
// (thumbnails), page written (section chips), screenshot review passes (shot
// thumbnails + findings), fixes, handover. The whole checklist collapses to
// just the title row + progress bar: open by default while the build runs,
// folding shut when it settles, with a manual toggle that wins until the
// next transition — the same state model as the MCP receipt card.

import { useQueryClient } from "@tanstack/react-query";
import {
	type PageAttemptDetail,
	type PageBuildFailureCode,
	type PageBuildPhase,
	type PageBuildProgress,
	pageBuildProgressSchema,
	type TriggerRealtimeHandle,
} from "@wandit/contracts";
import { useTranslation } from "@wandit/internationalization/react";
import { router } from "expo-router";
import { useThemeColor } from "heroui-native";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

import { WanditIcon } from "@/components/wandit-icon";
import { creditsKeys, openBillingInBrowser } from "@/features/credits";
import { pageKeys } from "@/features/workspace/api/generation.keys";
import { projectAssetKeys } from "@/features/workspace/api/project-assets.queries";
import {
	useDismissPageAttempt,
	usePageAttemptQuery,
	useRetryPageAttempt,
} from "@/features/workspace/api/generation.queries";
import { PublishPanel } from "@/features/workspace/components/publish-panel";
import { useLiveRun } from "@/features/workspace/lib/use-live-run";

import { ElapsedTimer } from "./elapsed-timer";
import { SpinnerArc } from "./spinner-arc";
import { StatusMessageHeader } from "./status-message-header";

const REVEAL_EASE = Easing.bezier(0.32, 0.72, 0, 1);
const REVEAL_MS = 300;
// Matches the web bar's transition-[width] duration-700.
const BAR_MS = 700;

export type PageBuildRunState =
	| "building"
	| "succeeded"
	| "failed"
	| "disconnected";

/**
 * Subscribes to the run + polls the durable attempt row, and renders the
 * right card: live checklist, success, failed (classified, with Retry /
 * Dismiss), stopped (Resume / Discard), or the receipt line a dismissed
 * terminal card collapses into (web generate-page-part.tsx parity).
 */
export function PageBuildCard({
	attemptId,
	realtime: transcriptRealtime,
	versionNumber,
	projectId,
	fallback,
}: {
	attemptId: string | undefined;
	realtime: TriggerRealtimeHandle | undefined;
	versionNumber: number | undefined;
	projectId: string;
	/** Durable-truth rendering shown for legacy messages with neither an
	 * attempt row nor progress. */
	fallback: ReactNode;
}) {
	const { t } = useTranslation();
	const queryClient = useQueryClient();
	// A Retry/Resume replaces the transcript's dead handle for the rest of
	// this mount: with the new run's handle when the server minted one, or
	// with null (drop the old handle entirely) when it did not — the old
	// run's stream must never keep narrating a superseded build.
	const [handleOverride, setHandleOverride] = useState<
		TriggerRealtimeHandle | null | undefined
	>(undefined);
	const realtime =
		handleOverride === undefined
			? transcriptRealtime
			: (handleOverride ?? undefined);

	const live = useLiveRun({
		enabled: Boolean(realtime),
		handle: realtime,
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: creditsKeys.balance(),
			});
			void queryClient.invalidateQueries({
				queryKey: pageKeys.overview(projectId),
			});
			// Page builds emit media files too — the Assets view must see them.
			void queryClient.invalidateQueries({
				queryKey: projectAssetKeys.list(projectId),
			});
			if (attemptId) {
				void queryClient.invalidateQueries({
					queryKey: pageKeys.attempt(projectId, attemptId),
				});
			}
		},
	});

	const attemptQuery = usePageAttemptQuery(projectId, attemptId);
	const attempt = attemptQuery.data;

	const retryMutation = useRetryPageAttempt(projectId);
	const dismissMutation = useDismissPageAttempt(projectId);

	// The Realtime handle only speaks for the attempt's CURRENT run. After a
	// retry, the transcript still carries the OLD run's handle — its latched
	// FAILED/CANCELED must never paint terminal state over the live rebuild.
	// When the attempt row is unknown (fetch pending, legacy 404) the handle
	// is all we have, so it is trusted as before. A NULL run id while
	// GENERATING is trusted too (older server, lost link CAS); null while
	// QUEUED stays muted — that is the post-retry window.
	const liveIsCurrentRun =
		attempt === undefined ||
		(realtime !== undefined &&
			(attempt.triggerRunId === realtime.runId ||
				(attempt.triggerRunId === null && attempt.status === "generating")));
	const parsed = pageBuildProgressSchema.safeParse(
		liveIsCurrentRun ? live.metadata?.progress : undefined,
	);
	const progress = parsed.success ? parsed.data : undefined;

	// Durable terminal truth wins; a settled CURRENT run covers the polling
	// gap until the row catches up.
	const liveTerminal: PageAttemptDetail["status"] | undefined =
		liveIsCurrentRun && live.settled
			? live.status === "COMPLETED"
				? "succeeded"
				: live.status === "CANCELED"
					? "canceled"
					: "failed"
			: undefined;
	const attemptTerminal =
		attempt && attempt.status !== "queued" && attempt.status !== "generating"
			? attempt.status
			: undefined;
	const status = attemptTerminal ?? liveTerminal ?? attempt?.status;

	const frozenPercent =
		attempt?.lastProgressPercent ??
		(progress ? Math.round(progress.percent) : undefined);

	const retry =
		attemptId === undefined
			? undefined
			: () => {
					retryMutation.mutate(
						{ attemptId },
						{
							onSuccess: (response) => {
								// Only a retry that actually queued may replace the
								// handle. A no-op response (row unclaimable, run still
								// alive) must keep the old handle: dropping it would
								// mute the terminal card into a permanent building
								// line with no buttons.
								if (response.realtime || response.attempt.status === "queued") {
									setHandleOverride(response.realtime ?? null);
								}
							},
						},
					);
				};
	const dismiss =
		attemptId === undefined
			? undefined
			: () => dismissMutation.mutate({ attemptId });

	if (status === "canceled") {
		if (attempt?.dismissed) {
			return (
				<ReceiptLine
					text={
						frozenPercent !== undefined
							? t("workspace.chat.pageBuild.receiptStoppedAt", {
									percent: frozenPercent,
								})
							: t("workspace.chat.pageBuild.receiptStopped")
					}
				/>
			);
		}

		return (
			<StoppedBuildCard
				discarding={dismissMutation.isPending}
				onDiscard={dismiss}
				onResume={retry}
				percent={frozenPercent ?? 0}
				resuming={retryMutation.isPending}
				versionNumber={versionNumber}
			/>
		);
	}

	if (status === "failed") {
		if (attempt?.dismissed) {
			return (
				<ReceiptLine text={t("workspace.chat.pageBuild.receiptDismissed")} />
			);
		}

		return (
			<FailedBuildCard
				dismissing={dismissMutation.isPending}
				failureCode={attempt?.failureCode ?? null}
				onDismiss={dismiss}
				onRetry={retry}
				retrying={retryMutation.isPending}
			/>
		);
	}

	if (status === "succeeded") {
		return (
			<PageBuildProgressView
				progress={progress}
				runState="succeeded"
				versionNumber={versionNumber}
				livePanel={
					<View className="gap-2">
						<PublishPanel projectId={projectId} />
						<OpenPageTabButton projectId={projectId} />
					</View>
				}
			/>
		);
	}

	// No metadata yet (worker cold start, no realtime handle, expired token
	// after a reload, dead subscription): the static line says everything an
	// empty card would, without flashing a bogus 2% checklist.
	if (!progress && !(liveIsCurrentRun && live.settled)) {
		if (attempt?.createdAt) {
			return (
				<StaticBuildingLine
					startedAt={attempt.createdAt}
					versionNumber={versionNumber}
				/>
			);
		}
		return fallback;
	}

	return (
		<PageBuildProgressView
			progress={progress}
			runState={liveIsCurrentRun && live.failed ? "disconnected" : "building"}
			startedAt={attempt?.createdAt}
			versionNumber={versionNumber}
		/>
	);
}

/** Quiet building line for the pre-progress stretch: ember spinner, the
 * version label, and the live elapsed clock (web StaticBuildingLine parity).
 * Keyed by startedAt so a retry resets the clock. */
function StaticBuildingLine({
	startedAt,
	versionNumber,
}: {
	startedAt: string;
	versionNumber: number | undefined;
}) {
	const { t } = useTranslation();

	return (
		<View className="gap-1.5">
			<StatusMessageHeader
				tone="working"
				kicker={t("workspace.chat.pageBuild.headline.starting")}
			/>
			<View className="flex-row items-center gap-2">
				<Text className="min-w-0 flex-1 text-[13px] text-muted leading-[19px]">
					{versionNumber
						? `${t("workspace.chat.versionCardKind")} · v${versionNumber}`
						: t("workspace.chat.pageBuild.buildingNoVersion")}
				</Text>
				<ElapsedTimer
					key={startedAt}
					since={startedAt}
					className="font-mono text-[11px] text-muted"
				/>
			</View>
		</View>
	);
}

/** Classified failure with Retry / Dismiss (web FailedBuildCard). For
 * insufficient_credits the primary action is Top up — it opens web billing in
 * the system browser — and Retry demotes to the outline slot, which still
 * works once credits land. Native has no purchases-paused signal yet, so the
 * Top up promotion is unconditional (web gates it on purchasesEnabled). */
function FailedBuildCard({
	dismissing = false,
	failureCode,
	onDismiss,
	onRetry,
	retrying = false,
}: {
	/** Each action owns its pending label — a dismiss must never read "Retrying…". */
	dismissing?: boolean;
	failureCode: PageBuildFailureCode | null;
	onDismiss: (() => void) | undefined;
	onRetry: (() => void) | undefined;
	retrying?: boolean;
}) {
	const { t } = useTranslation();
	const background = useThemeColor("background");
	const code = failureCode ?? "internal_error";
	const retryable = failureCode !== "member_limit";
	const outOfCredits = failureCode === "insufficient_credits";
	const busy = retrying || dismissing;

	return (
		<View className="gap-1.5">
			<StatusMessageHeader
				tone="danger"
				kicker={t(`workspace.chat.pageBuildFailure.${code}.kicker`)}
			/>
			<View className="rounded-[14px] border border-danger/30 bg-danger/5 p-3.5">
				<Text className="mb-1 font-sans-medium text-[13.5px] text-foreground">
					{t(`workspace.chat.pageBuildFailure.${code}.title`)}
				</Text>
				<Text className="mb-2 text-[13px] text-muted leading-[19px]">
					{t(`workspace.chat.pageBuildFailure.${code}.message`)}
				</Text>
				{failureCode ? (
					// auto, not ltr: the AR template is "خطأ · {code}" — RTL text
					// around an ASCII code, which bidi keeps intact as its own run.
					<Text
						className="mb-3 font-mono text-[10.5px] text-muted/70"
						style={{ writingDirection: "auto" }}
					>
						{t("workspace.chat.pageBuild.errorCode", { code: failureCode })}
					</Text>
				) : (
					<View className="mb-1.5" />
				)}
				<View className="flex-row gap-2">
					{outOfCredits ? (
						<Pressable
							accessibilityRole="button"
							disabled={busy}
							onPress={openBillingInBrowser}
							className="h-8 flex-1 flex-row items-center justify-center rounded-full bg-foreground active:opacity-85"
						>
							<Text className="font-sans-semibold text-[12.5px] text-background">
								{t("workspace.chat.pageBuild.topUp")}
							</Text>
						</Pressable>
					) : retryable && onRetry ? (
						<Pressable
							accessibilityRole="button"
							disabled={busy}
							onPress={onRetry}
							className="h-8 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-foreground active:opacity-85"
						>
							<WanditIcon name="undo" size={13} color={background} />
							<Text className="font-sans-semibold text-[12.5px] text-background">
								{retrying
									? t("workspace.chat.pageBuild.retrying")
									: t("workspace.chat.pageBuild.retry")}
							</Text>
						</Pressable>
					) : null}
					{outOfCredits && onRetry ? (
						<Pressable
							accessibilityRole="button"
							disabled={busy}
							onPress={onRetry}
							className="h-8 flex-row items-center justify-center rounded-full border border-border px-3.5 active:bg-surface-secondary"
						>
							<Text className="font-sans-semibold text-[12.5px] text-foreground">
								{retrying
									? t("workspace.chat.pageBuild.retrying")
									: t("workspace.chat.pageBuild.retry")}
							</Text>
						</Pressable>
					) : onDismiss ? (
						<Pressable
							accessibilityRole="button"
							disabled={busy}
							onPress={onDismiss}
							className="h-8 flex-row items-center justify-center rounded-full border border-border px-3.5 active:bg-surface-secondary"
						>
							<Text className="font-sans-semibold text-[12.5px] text-foreground">
								{dismissing
									? t("workspace.chat.pageBuild.dismissing")
									: t("workspace.chat.pageBuild.dismiss")}
							</Text>
						</Pressable>
					) : null}
				</View>
			</View>
		</View>
	);
}

/** Stopped mid-build: frozen stone percent bar, Resume, Discard. */
function StoppedBuildCard({
	discarding = false,
	onDiscard,
	onResume,
	percent,
	resuming = false,
	versionNumber,
}: {
	/** Each action owns its pending label — a discard must never read "Resuming…". */
	discarding?: boolean;
	onDiscard: (() => void) | undefined;
	onResume: (() => void) | undefined;
	percent: number;
	resuming?: boolean;
	versionNumber: number | undefined;
}) {
	const { t } = useTranslation();
	const muted = useThemeColor("muted");
	const clamped = Math.min(100, Math.max(0, Math.round(percent)));
	const busy = resuming || discarding;

	return (
		<View className="gap-1.5">
			<StatusMessageHeader
				tone="muted"
				kicker={t("workspace.chat.pageBuild.stoppedKicker")}
			/>
			<View className="rounded-[14px] border border-border bg-background p-3.5">
				<View className="mb-2 flex-row items-center justify-between gap-3">
					<Text
						numberOfLines={1}
						className="min-w-0 flex-1 font-sans-medium text-[13.5px] text-foreground"
					>
						{versionNumber
							? `${t("workspace.chat.versionCardKind")} · v${versionNumber}`
							: t("workspace.chat.pageBuild.stoppedFallbackTitle")}
					</Text>
					<Text
						className="shrink-0 font-mono text-[11.5px] text-muted"
						style={{ writingDirection: "ltr" }}
					>
						{clamped}%
					</Text>
				</View>
				<View className="mb-[11px] h-[5px] overflow-hidden rounded-full bg-surface-tertiary">
					{/* Stone (not ember): a stopped bar must not promise liveness. */}
					<View
						className="h-full rounded-full bg-muted/50"
						style={{ width: `${clamped}%` }}
					/>
				</View>
				<View className="mb-3 flex-row items-center gap-[7px]">
					<WanditIcon name="squareStop" size={11} color={muted} />
					<Text className="text-[13px] text-muted leading-[19px]">
						{t("workspace.chat.pageBuild.stoppedBody")}
					</Text>
				</View>
				<View className="flex-row gap-2">
					{onResume ? (
						<Pressable
							accessibilityRole="button"
							disabled={busy}
							onPress={onResume}
							className="h-8 flex-1 items-center justify-center rounded-full bg-foreground active:opacity-85"
						>
							<Text className="font-sans-semibold text-[12.5px] text-background">
								{resuming
									? t("workspace.chat.pageBuild.resuming")
									: t("workspace.chat.pageBuild.resume")}
							</Text>
						</Pressable>
					) : null}
					{onDiscard ? (
						<Pressable
							accessibilityRole="button"
							disabled={busy}
							onPress={onDiscard}
							className="h-8 flex-row items-center justify-center rounded-full border border-border px-3.5 active:bg-surface-secondary"
						>
							<Text className="font-sans-semibold text-[12.5px] text-foreground">
								{discarding
									? t("workspace.chat.pageBuild.discarding")
									: t("workspace.chat.pageBuild.discard")}
							</Text>
						</Pressable>
					) : null}
				</View>
			</View>
		</View>
	);
}

/** The quiet one-liner a dismissed terminal card collapses into. */
function ReceiptLine({ text }: { text: string }) {
	return <Text className="text-[13px] text-muted leading-[19px]">{text}</Text>;
}

/** Navigation payoff on a succeeded build: straight to the Page tab. */
function OpenPageTabButton({ projectId }: { projectId: string }) {
	const { t } = useTranslation();
	const foreground = useThemeColor("foreground");

	return (
		<Pressable
			accessibilityRole="button"
			onPress={() => router.push(`/project/${projectId}/page`)}
			className="h-9 flex-row items-center justify-center gap-1.5 rounded-full border border-border active:bg-surface-secondary"
		>
			<Text className="font-sans-semibold text-[12.5px] text-foreground">
				{t("workspace.chat.pageBuild.openPageTab")}
			</Text>
			<WanditIcon name="arrowRight" size={12} color={foreground} />
		</Pressable>
	);
}

/* ---------- presentational checklist ---------- */

const PHASE_RANK: Record<PageBuildPhase, number> = {
	art: 1,
	finishing: 5,
	fixing: 4,
	reviewing: 3,
	starting: 0,
	writing: 2,
};

export type RowState = "pending" | "active" | "done" | "hidden";

export function PageBuildProgressView({
	progress,
	runState,
	startedAt,
	versionNumber,
	livePanel,
}: {
	progress: PageBuildProgress | undefined;
	runState: PageBuildRunState;
	startedAt?: string;
	versionNumber: number | undefined;
	/** Publish/live payoff rendered below the bar once the build succeeds —
	 * always visible, outside the collapsible checklist. */
	livePanel?: ReactNode;
}) {
	const { t } = useTranslation();
	const danger = useThemeColor("danger");
	const mutedColor = useThemeColor("muted");

	// A dead subscription freezes the card at its last snapshot — active
	// rows must stop spinning, or the card promises liveness it no longer
	// has.
	const animationLive = runState === "building";

	const phase = progress?.phase ?? "starting";
	const rank = PHASE_RANK[phase];
	const images = progress?.images ?? [];
	const videos = progress?.videos ?? 0;
	const sections = progress?.sections ?? [];
	const shots = progress?.shots ?? [];
	const findings = progress?.findings ?? [];
	const fixes = progress?.fixes ?? 0;
	const reviewPasses = progress?.reviewPasses ?? 0;
	const reviewTarget = progress?.reviewTarget ?? 2;
	const succeeded = runState === "succeeded";
	const failed = runState === "failed";
	const ended = succeeded || failed;
	const percent = succeeded ? 100 : (progress?.percent ?? 2);

	// Open while the run is alive, folded once it settles; a manual toggle
	// wins until the next lifecycle transition resets it.
	const holdOpen = !ended;
	const [manualOpen, setManualOpen] = useState<boolean | null>(null);
	const [previousHoldOpen, setPreviousHoldOpen] = useState(holdOpen);
	if (previousHoldOpen !== holdOpen) {
		setPreviousHoldOpen(holdOpen);
		if (manualOpen !== null) setManualOpen(null);
	}
	const open = manualOpen ?? holdOpen;

	// Row states survive phase recurrence (review → fix → review): each row
	// judges its own evidence instead of a strict linear rank.
	const artState: RowState =
		!ended && phase === "art"
			? "active"
			: images.length > 0 || videos > 0
				? "done"
				: rank <= 1 && !ended
					? "pending"
					: "hidden";
	const pageState: RowState =
		!ended && phase === "writing"
			? "active"
			: (progress?.pageBytes ?? 0) > 0 || rank > 2
				? "done"
				: ended
					? "hidden"
					: "pending";
	const reviewState: RowState =
		!ended && phase === "reviewing"
			? "active"
			: reviewPasses > 0
				? "done"
				: ended
					? "hidden"
					: "pending";
	const fixState: RowState =
		!ended && phase === "fixing" ? "active" : fixes > 0 ? "done" : "hidden";
	const finishState: RowState = succeeded
		? "done"
		: failed
			? "hidden"
			: phase === "finishing"
				? "active"
				: "pending";

	const kind = t("workspace.chat.versionCardKind");
	const title = succeeded
		? versionNumber
			? t("workspace.chat.pageBuild.readyTitle", { n: versionNumber })
			: t("workspace.chat.pageBuild.readyNoVersion")
		: failed
			? t("workspace.chat.pageBuild.failedTitle")
			: versionNumber
				? `${kind} · v${versionNumber}`
				: t("workspace.chat.pageBuild.buildingNoVersion");
	const headline = succeeded
		? t("workspace.chat.pageBuild.succeededHeadline")
		: failed
			? t("workspace.chat.pageBuild.failedHeadline")
			: runState === "disconnected"
				? t("workspace.chat.pageBuild.disconnectedHeadline")
				: t(`workspace.chat.pageBuild.headline.${phase}`);

	return (
		<View className="rounded-[16px] border border-border bg-surface p-3.5">
			<Pressable
				accessibilityRole="button"
				accessibilityState={{ expanded: open }}
				onPress={() => setManualOpen(!open)}
			>
				<View className="flex-row items-center gap-2">
					<Text
						numberOfLines={1}
						className={`min-w-0 flex-1 font-sans-semibold text-[13.5px] ${
							failed ? "text-danger" : "text-foreground"
						}`}
					>
						{title}
					</Text>
					{failed ? (
						<WanditIcon name="close" size={14} color={danger} />
					) : (
						<View className="shrink-0 flex-row items-center gap-2">
							{startedAt && !ended ? (
								<ElapsedTimer
									key={startedAt}
									since={startedAt}
									className="font-mono text-[11px] text-muted tabular-nums"
								/>
							) : null}
							<Text
								className="font-mono text-[11px] text-accent tabular-nums"
								style={{ writingDirection: "ltr" }}
							>
								{Math.round(percent)}%
							</Text>
						</View>
					)}
					<View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
						<WanditIcon name="caretDown" size={12} color={mutedColor} />
					</View>
				</View>
				{failed ? null : <ProgressBar percent={percent} />}
			</Pressable>
			{livePanel}
			<Reveal open={open}>
				<View className="pt-2.5">
					<Text className="text-[12px] text-muted leading-[17px]">
						{headline}
					</Text>
					<View className="gap-[9px] pt-2.5">
						{artState === "hidden" ? null : (
							<View>
								<StepRow
									state={artState}
									live={animationLive}
									badge={
										images.length > 0
											? [
													t("workspace.chat.pageBuild.imagesCount", {
														count: images.length,
													}),
													videos > 0
														? t("workspace.chat.pageBuild.videosCount", {
																count: videos,
															})
														: undefined,
												]
													.filter(Boolean)
													.join(" · ")
											: undefined
									}
								>
									{artState === "active"
										? t("workspace.chat.pageBuild.steps.artActive")
										: artState === "done"
											? t("workspace.chat.pageBuild.steps.artDone")
											: t("workspace.chat.pageBuild.steps.artPending")}
								</StepRow>
								{images.length > 0 ? (
									<View className="flex-row flex-wrap gap-1.5 ps-[25px] pt-2">
										{images.slice(0, 6).map((image) => (
											<Image
												key={image.url}
												accessibilityLabel={image.role}
												className="h-11 w-11 rounded-[7px] border border-border bg-surface-tertiary"
												resizeMode="cover"
												source={{ uri: image.url }}
											/>
										))}
										{images.length > 6 ? (
											<View className="h-11 w-11 items-center justify-center rounded-[7px] border border-border">
												<Text className="text-[11px] text-muted">
													+{images.length - 6}
												</Text>
											</View>
										) : null}
									</View>
								) : null}
							</View>
						)}
						{pageState === "hidden" ? null : (
							<View>
								<StepRow
									state={pageState}
									live={animationLive}
									badge={
										sections.length > 0 && pageState !== "pending"
											? t("workspace.chat.pageBuild.sectionsCount", {
													count: sections.length,
												})
											: undefined
									}
								>
									{pageState === "active"
										? t("workspace.chat.pageBuild.steps.pageActive")
										: pageState === "done"
											? t("workspace.chat.pageBuild.steps.pageDone")
											: t("workspace.chat.pageBuild.steps.pagePending")}
								</StepRow>
								{sections.length > 0 && pageState !== "pending" ? (
									<View className="flex-row flex-wrap gap-1.5 ps-[25px] pt-2">
										{sections.map((section) => (
											<View
												key={section}
												className="rounded-full border border-border px-2.5 py-0.5"
											>
												<Text className="text-[11px] text-muted">
													{section}
												</Text>
											</View>
										))}
									</View>
								) : null}
							</View>
						)}
						{reviewState === "hidden" ? null : (
							<View>
								<StepRow
									state={reviewState}
									live={animationLive}
									badge={
										reviewState !== "pending"
											? t("workspace.chat.pageBuild.passOf", {
													current: Math.max(
														1,
														Math.min(
															reviewState === "active"
																? (progress?.currentPass ?? reviewPasses + 1)
																: reviewPasses,
															reviewTarget,
														),
													),
													target: reviewTarget,
												})
											: undefined
									}
								>
									{reviewState === "active"
										? t("workspace.chat.pageBuild.steps.reviewActive")
										: reviewState === "done"
											? t("workspace.chat.pageBuild.steps.reviewDone")
											: t("workspace.chat.pageBuild.steps.reviewPending")}
								</StepRow>
								{shots.length > 0 ? (
									<View className="flex-row flex-wrap items-end gap-1.5 ps-[25px] pt-2">
										{shots.map((shot) => (
											<Image
												key={shot.url}
												accessibilityLabel={shot.viewport}
												className="h-12 rounded-[6px] border border-border bg-surface-tertiary"
												resizeMode="cover"
												source={{ uri: shot.url }}
												style={{
													width: shot.viewport === "desktop" ? 76 : 28,
												}}
											/>
										))}
									</View>
								) : null}
								{findings.length > 0 && !ended ? (
									<View className="ms-[25px] mt-2 rounded-[9px] border border-accent/20 bg-accent/5 px-2.5 py-1.5">
										<Text className="text-[12px] text-muted leading-[17px]">
											{findings.join(" · ")}
										</Text>
									</View>
								) : null}
							</View>
						)}
						{fixState === "hidden" ? null : (
							<StepRow
								state={fixState}
								live={animationLive}
								badge={
									fixes > 0
										? t("workspace.chat.pageBuild.fixesBadge", {
												count: fixes,
											})
										: undefined
								}
							>
								{fixState === "active"
									? t("workspace.chat.pageBuild.steps.fixesActive")
									: t("workspace.chat.pageBuild.steps.fixesDone", {
											count: fixes,
										})}
							</StepRow>
						)}
						{finishState === "hidden" ? null : (
							<StepRow state={finishState} live={animationLive}>
								{finishState === "done"
									? t("workspace.chat.pageBuild.steps.finishDone")
									: finishState === "active"
										? t("workspace.chat.pageBuild.steps.finishActive")
										: t("workspace.chat.pageBuild.steps.finishPending")}
							</StepRow>
						)}
					</View>
				</View>
			</Reveal>
		</View>
	);
}

/* ---------- shared bits (also used by the lead-scrape card) ---------- */

export function ProgressBar({ percent }: { percent: number }) {
	const clamped = Math.min(100, Math.max(0, percent));
	const width = useSharedValue(clamped);

	useEffect(() => {
		width.value = withTiming(clamped, { duration: BAR_MS });
	}, [clamped, width]);

	const animatedStyle = useAnimatedStyle(() => ({
		width: `${width.value}%`,
	}));

	return (
		<View className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-tertiary">
			<Animated.View
				className="h-full rounded-full bg-accent"
				style={animatedStyle}
			/>
		</View>
	);
}

export function StepRow({
	state,
	live,
	badge,
	children,
}: {
	state: RowState;
	/** False freezes the active spinner (dead subscription). */
	live: boolean;
	badge?: string;
	children: ReactNode;
}) {
	const success = useThemeColor("success");

	return (
		<View className="flex-row items-center gap-2.5">
			{state === "done" ? (
				<View className="h-[15px] w-[15px] items-center justify-center rounded-full bg-success/15">
					<WanditIcon name="check" size={9} color={success} />
				</View>
			) : state === "active" && live ? (
				<SpinnerArc size={15} />
			) : (
				<View className="h-[15px] w-[15px] rounded-full border-2 border-border" />
			)}
			<Text
				numberOfLines={1}
				className={`min-w-0 flex-1 text-[13px] ${
					state === "active"
						? "font-sans-semibold text-foreground"
						: state === "done"
							? "text-muted"
							: "text-muted/60"
				}`}
			>
				{children}
			</Text>
			{badge ? (
				<View className="rounded-full border border-accent/35 bg-accent/5 px-2 py-0.5">
					<Text className="font-mono text-[10px] text-accent">{badge}</Text>
				</View>
			) : null}
		</View>
	);
}

/** Measured-height reveal, same technique as the MCP receipt card: the
 * content lays out absolutely at its natural height, and that measurement
 * drives the animated container. */
function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
	const contentHeight = useSharedValue(0);
	const height = useSharedValue(0);
	const opacity = useSharedValue(open ? 1 : 0);
	const hasPaintedOpen = useRef(false);
	const openRef = useRef(open);
	openRef.current = open;

	useEffect(() => {
		height.value = withTiming(open ? contentHeight.value : 0, {
			duration: REVEAL_MS,
			easing: REVEAL_EASE,
		});
		opacity.value = withTiming(open ? 1 : 0, { duration: REVEAL_MS });
	}, [open, contentHeight, height, opacity]);

	const animatedStyle = useAnimatedStyle(() => ({
		height: height.value,
		opacity: opacity.value,
	}));

	return (
		<Animated.View
			style={[animatedStyle, { pointerEvents: open ? "auto" : "none" }]}
			className="overflow-hidden"
			aria-hidden={!open}
		>
			<View
				style={{ position: "absolute", top: 0, left: 0, right: 0 }}
				onLayout={(event) => {
					const next = event.nativeEvent.layout.height;
					contentHeight.value = next;
					if (!openRef.current) return;
					if (!hasPaintedOpen.current) {
						hasPaintedOpen.current = true;
						height.value = next;
						return;
					}
					height.value = withTiming(next, {
						duration: REVEAL_MS,
						easing: REVEAL_EASE,
					});
				}}
			>
				{children}
			</View>
		</Animated.View>
	);
}

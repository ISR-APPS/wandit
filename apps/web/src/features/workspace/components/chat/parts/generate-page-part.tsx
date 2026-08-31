// In-thread card for a generate_page call. The build runs in a background
// Trigger.dev task; this part subscribes to the run over Realtime and folds
// the worker's metadata "progress" object into a live checklist — art
// generated (thumbnails), page written (section chips), screenshot review
// passes (shot thumbnails + findings), fixes, handover — prototype-14 style.
// The durable attempt row (polled through usePageAttemptQuery) is the card's
// terminal source of truth: it carries the bounded failure code, the frozen
// percent for a stopped build, and it keeps working when the Realtime handle
// is absent (old history) or dead. Stop/Retry/Resume/Discard act on that
// same attempt row, so the card survives reloads without transcript edits.
// Chrome strings hardcoded English this pass, same rule as the tray files.

import { useQueryClient } from "@tanstack/react-query";
import {
	type PageAttemptDetail,
	type PageBuildFailureCode,
	type PageBuildPhase,
	type PageBuildProgress,
	pageBuildProgressSchema,
	type TriggerRealtimeHandle,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import {
	AlertTriangle,
	Check,
	ExternalLink,
	RotateCcw,
	Square,
} from "lucide-react";
import { useState } from "react";
import { useStopwatch } from "react-timer-hook";

import { useBillingModal } from "@/features/billing/components/billing-modal-provider";
import { usePurchasesEnabled } from "@/features/billing/lib/purchases";
import { invalidateBalanceAfterGenerationTerminal } from "@/features/credits/lib/terminal-balance-invalidation";
import { useTranslation } from "@/lib/i18n";
import {
	pageKeys,
	useDismissPageAttempt,
	usePageAttemptQuery,
	useRetryPageAttempt,
} from "../../../api/pages.queries";
import {
	durableAiErrorPresentation,
	findToolAiError,
	toolOutputAiError,
} from "../../../lib/ai-error-copy";
import { buildFailureCopy } from "../../../lib/build-failure-copy";
import { useWorkspace } from "../../../lib/store";
import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { useLiveRun } from "../../../lib/use-live-run";
import { SpinnerArc } from "../request-tray/tray-signals";
import { StatusMessageHeader } from "../status-message-header";

type GeneratePageToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-generate_page" }
>;

export function GeneratePagePart({
	part,
	messageParts,
}: {
	part: GeneratePageToolPart;
	messageParts?: WanditUIMessage["parts"];
}) {
	const { t } = useTranslation();
	// The brief streams in first (it's long), then the tool executes server-side.
	if (part.state === "input-streaming" || part.state === "input-available") {
		return (
			<WorkingLine
				text={
					part.state === "input-streaming"
						? "Working on your page brief…"
						: "Queueing the build…"
				}
			/>
		);
	}

	if (part.state === "output-error") {
		const failure = findToolAiError(messageParts, part.toolCallId);
		if (failure) {
			const copy = durableAiErrorPresentation(failure, t);
			return <PageToolFailure copy={copy} />;
		}

		return (
			<div>
				<StatusMessageHeader
					avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
					kickerClass="text-destructive"
					kicker={t("workspace.chat.pageBuild.failedTitle")}
				>
					<AlertTriangle className="size-3" aria-hidden />
				</StatusMessageHeader>
				<p
					dir="auto"
					className="text-[13px] text-muted-foreground leading-[1.5]"
				>
					{t("workspace.chat.pageBuild.failedHeadline")}
				</p>
			</div>
		);
	}

	if (part.state !== "output-available") return null;
	const outputFailure = toolOutputAiError(part.output);
	if (outputFailure) {
		return (
			<PageToolFailure copy={durableAiErrorPresentation(outputFailure, t)} />
		);
	}

	if (part.output.status === "queued") {
		if (part.output.attemptId || part.output.realtime) {
			return (
				<PageBuildCard
					attemptId={part.output.attemptId}
					realtime={part.output.realtime}
					versionNumber={part.output.versionNumber}
				/>
			);
		}

		// Very old messages without even an attempt id: the static line.
		return <StaticBuildingLine versionNumber={part.output.versionNumber} />;
	}

	// "needs-input" relays the corrective ask; "unavailable" relays the honest
	// infrastructure blocker. Neither status should look like a queued build.
	return (
		<p dir="auto" className="text-[13px] text-muted-foreground leading-[1.5]">
			{part.output.message}
		</p>
	);
}

function PageToolFailure({
	copy,
}: {
	copy: ReturnType<typeof durableAiErrorPresentation>;
}) {
	return (
		<div>
			<StatusMessageHeader
				avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
				kickerClass="text-destructive"
				kicker={copy.kicker}
			>
				<AlertTriangle className="size-3" aria-hidden />
			</StatusMessageHeader>
			<p dir="auto" className="text-[13px] text-muted-foreground leading-[1.5]">
				{copy.body}
			</p>
			{copy.attribution ? (
				<p dir="auto" className="mt-1 text-[11.5px] text-muted-foreground">
					{copy.attribution}
				</p>
			) : null}
		</div>
	);
}

/* ---------- live card ---------- */

export type PageBuildRunState =
	| "building"
	| "succeeded"
	| "failed"
	| "disconnected";

/** Subscribes to the run + polls the durable attempt row, and renders the
 *  right card: live checklist, success, failed (classified), or stopped. */
function PageBuildCard({
	attemptId,
	realtime: transcriptRealtime,
	versionNumber,
}: {
	attemptId: string | undefined;
	realtime: TriggerRealtimeHandle | undefined;
	versionNumber: number | undefined;
}) {
	const { projectId } = useWorkspace();
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
		handle: realtime,
		enabled: Boolean(realtime),
		onSettled: () => {
			invalidateBalanceAfterGenerationTerminal(queryClient, "settled");
			// The Page tab's overview poll also notices on its own — this just
			// makes the switch instant.
			void queryClient.invalidateQueries({
				queryKey: pageKeys.overview(projectId),
			});
			void queryClient.invalidateQueries({
				queryKey: pageKeys.versions(projectId),
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
	// retry, the transcript still carries the OLD run's handle (persisted in
	// the tool output, 2h token) — its latched FAILED/CANCELED must never
	// paint terminal state over the live rebuild after a reload. When the
	// attempt row is unknown (fetch pending, legacy 404) the handle is all
	// we have, so it is trusted as before. A NULL run id while GENERATING is
	// trusted too: it means the row link was never written (older server, a
	// lost link CAS) and muting the only live signal would freeze the card on
	// the static line for the whole build. Null while QUEUED stays muted —
	// that is the post-retry window where the old handle must not narrate.
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
					text={`Build stopped${frozenPercent !== undefined ? ` at ${frozenPercent}%` : ""} — discarded.`}
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
			return <ReceiptLine text="Failed build dismissed." />;
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
			/>
		);
	}

	// No metadata yet (worker cold start, no realtime handle, expired token
	// after a reload, dead subscription): the static line says everything an
	// empty card would, without flashing a bogus 2% checklist.
	// No onStop on purpose — user-initiated stopping is disabled for now
	// (product decision); the stopped card itself stays, because a run can
	// still be canceled from the Trigger dashboard.
	if (!progress && !(liveIsCurrentRun && live.settled)) {
		return (
			<StaticBuildingLine
				startedAt={attempt?.createdAt}
				versionNumber={versionNumber}
			/>
		);
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

/* ---------- presentational checklist (exported for tests) ---------- */

const PHASE_RANK: Record<PageBuildPhase, number> = {
	art: 1,
	finishing: 5,
	fixing: 4,
	reviewing: 3,
	starting: 0,
	writing: 2,
};

type RowState = "pending" | "active" | "done" | "hidden";

export function PageBuildProgressView({
	progress,
	runState,
	versionNumber,
	onStop,
	startedAt,
	stopping = false,
}: {
	progress: PageBuildProgress | undefined;
	runState: PageBuildRunState;
	versionNumber: number | undefined;
	/** Present while the build can still be stopped — renders the Stop chip. */
	onStop?: () => void;
	/** Attempt creation time — renders the running elapsed clock. */
	startedAt?: string;
	stopping?: boolean;
}) {
	const { setTab } = useWorkspace();

	// A dead subscription freezes the card at its last snapshot — active rows
	// must stop spinning, or the card promises liveness it no longer has.
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

	const buildTitle = versionNumber
		? `Building v${versionNumber}`
		: "Building your page";
	const header = succeeded
		? versionNumber
			? `v${versionNumber} is ready`
			: "Your page is ready"
		: failed
			? "Build failed"
			: buildTitle;
	const headline = succeeded
		? "It's live in the Page tab."
		: failed
			? "The build stopped before finishing — ask me to retry."
			: runState === "disconnected"
				? "Live progress lost — it will still appear in the Page tab."
				: (progress?.headline ?? "Starting up…");

	return (
		<div className="rounded-xl border border-border bg-background p-[15px]">
			<span
				role="status"
				aria-live="polite"
				aria-atomic="true"
				className="sr-only"
			>
				{`${header}. ${headline}`}
			</span>
			<div className="mb-2.5 flex items-center justify-between gap-3">
				<span className="min-w-0 truncate text-sm">
					<span
						className={cn(
							"font-medium",
							failed ? "text-destructive" : "text-foreground",
						)}
					>
						{header}
					</span>
					<span className="text-muted-foreground"> · {headline}</span>
				</span>
				{failed ? (
					<AlertTriangle
						className="size-4 shrink-0 text-destructive"
						aria-hidden
					/>
				) : (
					<span className="flex shrink-0 items-center gap-2">
						{onStop && !ended ? (
							<button
								type="button"
								onClick={onStop}
								disabled={stopping}
								className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-60"
							>
								<Square
									className="size-2.5 fill-current"
									strokeWidth={0}
									aria-hidden
								/>
								{stopping ? "Stopping…" : "Stop"}
							</button>
						) : null}
						{startedAt && !ended ? (
							<ElapsedTimer key={startedAt} since={startedAt} />
						) : null}
						<span className="font-mono text-ember-text text-xs">
							{Math.round(percent)}%
						</span>
					</span>
				)}
			</div>
			{failed ? null : (
				<div className="mb-[13px] h-1 overflow-hidden rounded-full bg-border">
					<div
						className="h-full rounded-full bg-gradient-ember transition-[width] duration-700"
						style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
					/>
				</div>
			)}
			<div className="flex flex-col gap-[9px] text-[13.5px]">
				{artState === "hidden" ? null : (
					<div>
						<StepRow
							state={artState}
							live={animationLive}
							badge={
								images.length > 0 ? (
									<CountBadge>
										{images.length} {images.length === 1 ? "image" : "images"}
										{videos > 0
											? ` · ${videos} ${videos === 1 ? "video" : "videos"}`
											: ""}
									</CountBadge>
								) : undefined
							}
						>
							{artState === "active"
								? "Generating the product art…"
								: artState === "done"
									? "Generated the product art"
									: "Generate the product art"}
						</StepRow>
						{images.length > 0 ? (
							<div className="mt-2 flex flex-wrap gap-1.5 ps-[25px]">
								{images.slice(0, 6).map((image) => (
									<img
										key={image.url}
										src={image.url}
										alt={`Generated ${image.role} art`}
										loading="lazy"
										className="h-11 w-11 rounded-[7px] border border-border object-cover"
									/>
								))}
								{images.length > 6 ? (
									<span className="grid h-11 w-11 place-items-center rounded-[7px] border border-border text-[11px] text-muted-foreground">
										+{images.length - 6}
									</span>
								) : null}
							</div>
						) : null}
					</div>
				)}
				{pageState === "hidden" ? null : (
					<div>
						<StepRow
							state={pageState}
							live={animationLive}
							badge={
								sections.length > 0 && pageState !== "pending" ? (
									<CountBadge>
										{sections.length}{" "}
										{sections.length === 1 ? "section" : "sections"}
									</CountBadge>
								) : undefined
							}
						>
							{pageState === "active"
								? "Writing the page…"
								: pageState === "done"
									? "Wrote the page"
									: "Write the page"}
						</StepRow>
						{sections.length > 0 && pageState !== "pending" ? (
							<div className="mt-2 flex flex-wrap gap-1.5 ps-[25px]">
								{sections.map((section) => (
									<span
										key={section}
										dir="auto"
										className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11.5px] text-muted-foreground"
									>
										{section}
									</span>
								))}
							</div>
						) : null}
					</div>
				)}
				{reviewState === "hidden" ? null : (
					<div>
						<StepRow
							state={reviewState}
							live={animationLive}
							badge={
								reviewState !== "pending" ? (
									<CountBadge>
										pass{" "}
										{Math.max(
											1,
											Math.min(
												reviewState === "active"
													? (progress?.currentPass ?? reviewPasses + 1)
													: reviewPasses,
												reviewTarget,
											),
										)}{" "}
										of {reviewTarget}
									</CountBadge>
								) : undefined
							}
						>
							{reviewState === "active"
								? (progress?.headline ?? "Reviewing the page…")
								: reviewState === "done"
									? "Screenshot-reviewed the page"
									: "Screenshot & review the page"}
						</StepRow>
						{shots.length > 0 ? (
							<div className="mt-2 flex flex-wrap items-end gap-1.5 ps-[25px]">
								{shots.map((shot) => (
									<img
										key={shot.url}
										src={shot.url}
										alt={`${shot.viewport} render`}
										loading="lazy"
										className={cn(
											"h-12 rounded-[6px] border border-border object-cover object-top",
											shot.viewport === "desktop" ? "w-[76px]" : "w-7",
										)}
									/>
								))}
							</div>
						) : null}
						{findings.length > 0 && !ended ? (
							<p className="ms-[25px] mt-2 rounded-[9px] border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[12px] text-muted-foreground">
								{findings.join(" · ")}
							</p>
						) : null}
					</div>
				)}
				{fixState === "hidden" ? null : (
					<StepRow
						state={fixState}
						live={animationLive}
						badge={fixes > 0 ? <CountBadge>×{fixes}</CountBadge> : undefined}
					>
						{fixState === "active"
							? "Applying fixes…"
							: fixes === 1
								? "Applied 1 fix"
								: `Applied ${fixes} fixes`}
					</StepRow>
				)}
				{finishState === "hidden" ? null : (
					<StepRow state={finishState} live={animationLive}>
						{finishState === "done"
							? "Handed over — it's in the Page tab"
							: finishState === "active"
								? "Publishing the page…"
								: "Final check & handover"}
					</StepRow>
				)}
			</div>
			{succeeded ? (
				<button
					type="button"
					onClick={() => setTab("page")}
					className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/5 px-3 py-1.5 text-[12.5px] text-ember-text transition-colors hover:bg-primary/10"
				>
					<ExternalLink className="size-3.5" aria-hidden />
					Open the Page tab
				</button>
			) : null}
		</div>
	);
}

/**
 * Live elapsed clock for a running build — "how long has this been going"
 * is the question every waiting merchant actually has. react-timer-hook's
 * stopwatch, seeded with the time already elapsed since the attempt was
 * queued so a page reload keeps the true age instead of restarting at 0:00.
 * Call sites key this by `since` — the offset is read once at mount, and a
 * Retry (which restarts the attempt clock) must remount it.
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
		<span className="font-mono text-[11px] text-muted-foreground tabular-nums">
			{totalMinutes}:{seconds.toString().padStart(2, "0")}
		</span>
	);
}

/* ---------- terminal cards (design gallery 12 / 16 / 09) ---------- */

/** Design card 12 — classified failure with Retry (or Top up for credits). */
export function FailedBuildCard({
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
	const { openPlanPicker } = useBillingModal();
	const purchasesEnabled = usePurchasesEnabled();
	const copy = buildFailureCopy(failureCode);
	// While all purchases are paused (beta), the top-up CTA is a dead end —
	// fall through to Retry, which works once an admin grants credits.
	const outOfCredits =
		failureCode === "insufficient_credits" && purchasesEnabled !== false;
	const retryable = failureCode !== "member_limit";
	const busy = retrying || dismissing;

	return (
		<div>
			<StatusMessageHeader
				avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
				kickerClass="text-destructive"
				kicker={copy.kicker}
			>
				<AlertTriangle className="size-3" aria-hidden />
			</StatusMessageHeader>
			<div className="rounded-[14px] border border-destructive/30 bg-destructive/5 p-[14px]">
				<p className="mb-1 font-medium text-foreground text-sm">{copy.title}</p>
				<p className="mb-2 text-[13px] text-muted-foreground leading-[1.5]">
					{copy.message}
				</p>
				{failureCode ? (
					<p className="mb-[13px] font-mono text-[10.5px] text-muted-foreground/70">
						error · {failureCode}
					</p>
				) : (
					<span className="mb-[13px] block" />
				)}
				<div className="flex gap-2">
					{outOfCredits ? (
						<Button
							size="sm"
							className="h-8 flex-1 text-[13px]"
							disabled={busy}
							onClick={() => openPlanPicker("generate_page")}
						>
							Top up wallet
						</Button>
					) : retryable && onRetry ? (
						<Button
							size="sm"
							className="h-8 flex-1 text-[13px]"
							disabled={busy}
							onClick={onRetry}
						>
							<RotateCcw className="size-3.5" aria-hidden />
							{retrying ? "Retrying…" : "Retry"}
						</Button>
					) : null}
					{outOfCredits && onRetry ? (
						<Button
							size="sm"
							variant="outline"
							className="h-8 text-[13px]"
							disabled={busy}
							onClick={onRetry}
						>
							Retry
						</Button>
					) : onDismiss ? (
						<Button
							size="sm"
							variant="outline"
							className="h-8 text-[13px]"
							disabled={busy}
							onClick={onDismiss}
						>
							{dismissing ? "Dismissing…" : "Dismiss"}
						</Button>
					) : null}
				</div>
			</div>
		</div>
	);
}

/** Design card 16 — stopped mid-build: frozen percent, Resume, Discard. */
export function StoppedBuildCard({
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
	const clamped = Math.min(100, Math.max(0, Math.round(percent)));
	const busy = resuming || discarding;

	return (
		<div>
			<StatusMessageHeader
				avatarClass="border-border bg-muted text-muted-foreground"
				kickerClass="text-muted-foreground"
				kicker="Stopped"
			>
				<Square className="size-2.5 fill-current" strokeWidth={0} aria-hidden />
			</StatusMessageHeader>
			<div className="rounded-[14px] border border-border bg-background p-[14px]">
				<div className="mb-2 flex items-center justify-between gap-3">
					<span className="min-w-0 truncate font-medium text-foreground text-sm">
						{versionNumber ? `Landing page · v${versionNumber}` : "Your page"}
					</span>
					<span className="shrink-0 font-mono text-muted-foreground text-xs">
						{clamped}%
					</span>
				</div>
				<div className="mb-[11px] h-[5px] overflow-hidden rounded-full bg-border">
					<div
						className="h-full rounded-full bg-stone"
						style={{ width: `${clamped}%` }}
					/>
				</div>
				<p className="mb-[13px] flex items-center gap-[7px] text-[13px] text-muted-foreground leading-[1.5]">
					<Square
						className="size-3 shrink-0 fill-current text-muted-foreground"
						strokeWidth={0}
						aria-hidden
					/>
					You stopped this build.
				</p>
				<div className="flex gap-2">
					{onResume ? (
						<Button
							size="sm"
							className="h-8 flex-1 text-[13px]"
							disabled={busy}
							onClick={onResume}
						>
							{resuming ? "Resuming…" : "Resume"}
						</Button>
					) : null}
					{onDiscard ? (
						<Button
							size="sm"
							variant="outline"
							className="h-8 text-[13px]"
							disabled={busy}
							onClick={onDiscard}
						>
							{discarding ? "Discarding…" : "Discard"}
						</Button>
					) : null}
				</div>
			</div>
		</div>
	);
}

/** The quiet one-liner a dismissed terminal card collapses into. */
function ReceiptLine({ text }: { text: string }) {
	return (
		<p className="text-[13px] text-muted-foreground leading-[1.5]">{text}</p>
	);
}

/* ---------- shared bits (same idiom as the scrape-leads card) ---------- */

function StepRow({
	state,
	live = true,
	badge,
	children,
}: {
	state: RowState;
	/** False freezes the active spinner (dead subscription). */
	live?: boolean;
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
			) : state === "active" && live ? (
				<SpinnerArc className="size-[15px] shrink-0" />
			) : (
				<PendingRing />
			)}
			<span className="min-w-0 flex-1 truncate">{children}</span>
			{badge}
		</div>
	);
}

function CountBadge({ children }: { children: React.ReactNode }) {
	return (
		<span className="ms-auto shrink-0 rounded-full border border-primary/35 bg-primary/5 px-2 py-0.5 font-mono text-[11px] text-ember-text">
			{children}
		</span>
	);
}

/** Success-tinted check circle for completed build steps. */
function DoneCircle() {
	return (
		<span className="grid size-[15px] shrink-0 place-items-center rounded-full bg-success/16">
			<Check className="size-2.5 text-success" strokeWidth={2.5} aria-hidden />
		</span>
	);
}

/** Stone ring for pending checklist rows. */
function PendingRing() {
	return (
		<span
			aria-hidden
			className="size-[15px] shrink-0 rounded-full border-2 border-stone"
		/>
	);
}

/** The pre-Realtime static state — also the fallback for old messages.
 *  Still stoppable: the durable attempt row is what a Stop acts on, so the
 *  control must not depend on a live progress stream existing. */
function StaticBuildingLine({
	onStop,
	startedAt,
	stopping = false,
	versionNumber,
}: {
	onStop?: () => void;
	startedAt?: string;
	stopping?: boolean;
	versionNumber: number | undefined;
}) {
	return (
		<div>
			<StatusMessageHeader
				avatarClass="border-primary/38 bg-primary/12 text-ember-text"
				kickerClass="text-ember-text"
				kicker="Building your page"
			>
				<SpinnerArc className="size-3" />
			</StatusMessageHeader>
			<div className="flex min-w-0 items-center gap-2">
				<p
					dir="auto"
					className="min-w-0 flex-1 text-[13px] text-muted-foreground leading-[1.5]"
				>
					{versionNumber
						? `Building v${versionNumber} — it will appear in the Page tab.`
						: "Building your page — it will appear in the Page tab."}
				</p>
				{startedAt ? <ElapsedTimer key={startedAt} since={startedAt} /> : null}
				{onStop ? (
					<button
						type="button"
						onClick={onStop}
						disabled={stopping}
						className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-60"
					>
						<Square
							className="size-2.5 fill-current"
							strokeWidth={0}
							aria-hidden
						/>
						{stopping ? "Stopping…" : "Stop"}
					</button>
				) : null}
			</div>
		</div>
	);
}

/** Quiet spinner + line while the tool call is still in flight. */
function WorkingLine({ text }: { text: string }) {
	return (
		<div className="flex items-center gap-2 text-[13px] text-muted-foreground">
			<SpinnerArc className="size-3.5" />
			<span>{text}</span>
		</div>
	);
}

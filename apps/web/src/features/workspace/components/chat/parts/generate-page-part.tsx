// In-thread card for a generate_page call. The build runs in a background
// Trigger.dev task; this part subscribes to the run over Realtime and folds
// the worker's metadata "progress" object into a live checklist — art
// generated (thumbnails), page written (section chips), screenshot review
// passes (shot thumbnails + findings), fixes, handover — prototype-14 style.
// Messages without a realtime handle (old history, minting failure) or with
// a dead subscription keep the original static status line; the Page tab's
// own overview poll remains the source of truth for the finished page.
// Chrome strings hardcoded English this pass, same rule as the tray files.

import { useQueryClient } from "@tanstack/react-query";
import {
	type PageBuildPhase,
	type PageBuildProgress,
	pageBuildProgressSchema,
	type TriggerRealtimeHandle,
} from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";
import { AlertTriangle, Check, Code, ExternalLink } from "lucide-react";
import { useState } from "react";

import { pageKeys } from "../../../api/pages.queries";
import { useWorkspace } from "../../../lib/store";
import type { WanditUIMessage } from "../../../lib/use-ai-chat";
import { useLiveRun } from "../../../lib/use-live-run";
import { SpinnerArc } from "../request-tray/tray-signals";
import { StatusMessageHeader } from "../status-message-header";

type GeneratePageToolPart = Extract<
	WanditUIMessage["parts"][number],
	{ type: "tool-generate_page" }
>;

export function GeneratePagePart({ part }: { part: GeneratePageToolPart }) {
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
		return (
			<div>
				<StatusMessageHeader
					avatarClass="border-destructive/38 bg-destructive/14 text-destructive"
					kickerClass="text-destructive"
					kicker="Page build failed to start"
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

	if (part.output.status === "queued") {
		if (part.output.realtime) {
			return (
				<PageBuildCard
					realtime={part.output.realtime}
					versionNumber={part.output.versionNumber}
				/>
			);
		}

		// Old messages (or a failed token mint): the original static line.
		return <StaticBuildingLine versionNumber={part.output.versionNumber} />;
	}

	// "unavailable" — the server is missing R2/Trigger credentials; relay the
	// tool's honest message instead of pretending a page is coming.
	return (
		<p dir="auto" className="text-[13px] text-muted-foreground leading-[1.5]">
			{part.output.message}
		</p>
	);
}

/* ---------- live card ---------- */

export type PageBuildRunState =
	| "building"
	| "succeeded"
	| "failed"
	| "disconnected";

/** Subscribes to the build run and renders the live checklist. */
function PageBuildCard({
	realtime,
	versionNumber,
}: {
	realtime: TriggerRealtimeHandle;
	versionNumber: number | undefined;
}) {
	const { projectId } = useWorkspace();
	const queryClient = useQueryClient();
	const [settled, setSettled] = useState(false);

	const live = useLiveRun({
		handle: realtime,
		enabled: !settled,
		onSettled: () => {
			setSettled(true);
			// The Page tab's overview poll also notices on its own — this just
			// makes the switch instant.
			void queryClient.invalidateQueries({
				queryKey: pageKeys.overview(projectId),
			});
			void queryClient.invalidateQueries({
				queryKey: pageKeys.versions(projectId),
			});
		},
	});

	const parsed = pageBuildProgressSchema.safeParse(live.metadata?.progress);
	const progress = parsed.success ? parsed.data : undefined;

	const runState: PageBuildRunState = live.settled
		? live.status === "COMPLETED"
			? "succeeded"
			: "failed"
		: live.failed
			? "disconnected"
			: "building";

	// No metadata yet (worker cold start, expired token after a reload, dead
	// subscription): the static line says everything an empty card would,
	// without flashing a bogus 2% checklist. The card appears with the first
	// real snapshot — or on settle, which needs the final states.
	if (!progress && !live.settled) {
		return <StaticBuildingLine versionNumber={versionNumber} />;
	}

	return (
		<PageBuildProgressView
			progress={progress}
			runState={runState}
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
}: {
	progress: PageBuildProgress | undefined;
	runState: PageBuildRunState;
	versionNumber: number | undefined;
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
					<span className="shrink-0 font-mono text-ember-text text-xs">
						{Math.round(percent)}%
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
			) : ended ? null : (
				<div className="mt-[11px] inline-flex items-center gap-[7px] rounded-full border border-border bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
					<Code className="size-3 text-primary" aria-hidden />
					tool · generate_page
				</div>
			)}
		</div>
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

/** The pre-Realtime static state — also the fallback for old messages. */
function StaticBuildingLine({
	versionNumber,
}: {
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
			<p dir="auto" className="text-[13px] text-muted-foreground leading-[1.5]">
				{versionNumber
					? `Building v${versionNumber} — it will appear in the Page tab.`
					: "Building your page — it will appear in the Page tab."}
			</p>
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

/**
 * The one working row under the chat list while a turn runs. Before the
 * reply has parts, it starts with the Wandit byline, so it reads as the
 * start of the reply. Then the pixel grid and a label: the preparation
 * title with a stepping detail line, "Thinking", or the stream phase.
 * Rendered by chat-pane.tsx with the state of liveActivityOf (turn-parts.ts).
 */

import type { TurnStreamPhase } from "@wandit/contracts";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useState } from "react";

import { type TranslationKey, useTranslation } from "@/lib/i18n";
import { BOOT_EASE, DETAIL_STEP_MS } from "../../lib/constants";
import type { LiveActivity } from "../../lib/turn-parts";
import { AssistantByline } from "./chat-message";
import { ShimmerText } from "./shimmer-text";

// The first turn creates the sandbox from the template. A later turn wakes
// a stopped sandbox and restores its files.
const DETAIL_LINES = {
	setup: [
		"appBuilder.chat.preparing.workspace",
		"appBuilder.chat.preparing.files",
		"appBuilder.chat.preparing.install",
		"appBuilder.chat.preparing.firstTime",
	],
	wake: [
		"appBuilder.chat.preparing.waking",
		"appBuilder.chat.preparing.restoring",
	],
} as const satisfies Record<"setup" | "wake", readonly TranslationKey[]>;

// A 3 by 3 grid. Each pixel starts later along the diagonal, so the shimmer runs corner to corner.
const PIXEL_GRID = [0, 1, 2].flatMap((row) =>
	[0, 1, 2].map((column) => ({
		key: `${row}${column}`,
		delayMs: (row + column) * 120,
	})),
);

/** Props of the working row, as chat-pane.tsx passes them. */
export type WorkingRowProps = {
	/** What the running turn shows now, from liveActivityOf. Picks the label and the byline. */
	activity: LiveActivity;
	/** Phase of the running turn, from useBuilderThread. Names the row when `activity.kind` is "phase"; null shows "Wandit is working…". */
	phase: TurnStreamPhase | null;
	/** True shows the seconds since the row appeared. Only in local dev or for staff. */
	showsElapsed: boolean;
};

/**
 * The row of the running turn. chat-pane.tsx keeps it in one slot, and the
 * counter keeps its place when the byline goes. So the seconds never restart.
 */
export function WorkingRow({ activity, phase, showsElapsed }: WorkingRowProps) {
	const { t } = useTranslation();
	const { kind } = activity;
	const isPreparing = kind === "setup" || kind === "wake";

	return (
		<div role="status" className="flex flex-col gap-3">
			{activity.hasVisibleReply ? null : <AssistantByline />}
			<div className="flex items-start gap-2 font-grotesk text-[13px] text-night/70 leading-5 dark:text-foreground/70">
				<span
					aria-hidden
					className="mt-[3px] grid size-3.5 shrink-0 grid-cols-3 gap-px"
				>
					{PIXEL_GRID.map((pixel) => (
						<span
							key={pixel.key}
							className="animate-pulse-soft rounded-[1px] bg-ember motion-reduce:animate-none dark:bg-spark"
							style={{ animationDelay: `${pixel.delayMs}ms` }}
						/>
					))}
				</span>
				<span className="flex min-w-0 flex-col gap-0.5">
					<span className="flex items-baseline gap-2.5">
						{isPreparing ? (
							<ShimmerText>{t("appBuilder.chat.preparing.title")}</ShimmerText>
						) : kind === "thinking" ? (
							<ShimmerText>{t("appBuilder.chat.thinking")}</ShimmerText>
						) : (
							<span>
								{phase === null
									? t("appBuilder.chat.working")
									: t(`appBuilder.chat.phases.${phase}`)}
							</span>
						)}
						{showsElapsed ? <ElapsedSeconds /> : null}
					</span>
					{/* A new kind starts its own list at the first line. */}
					{isPreparing ? (
						<DetailLine key={kind} lines={DETAIL_LINES[kind]} />
					) : null}
				</span>
			</div>
		</div>
	);
}

/**
 * The muted line under the preparation title. It shows each line for
 * DETAIL_STEP_MS and keeps the last one: a loop would read as "it started
 * again".
 */
function DetailLine({ lines }: { lines: readonly TranslationKey[] }) {
	const { t } = useTranslation();
	const [index, setIndex] = useState(0);
	const lastIndex = lines.length - 1;
	// The effect stops at lastIndex, and a new kind remounts this line, so the index stays in range.
	const line = lines[index];

	useEffect(() => {
		if (index >= lastIndex) return;
		const timer = setTimeout(() => setIndex(index + 1), DETAIL_STEP_MS);
		return () => clearTimeout(timer);
	}, [index, lastIndex]);

	return (
		// The line changes every few seconds. The screen reader hears only the title.
		<span
			aria-hidden
			className="font-sans text-[12.5px] text-night/50 leading-[18px] dark:text-foreground/50"
		>
			<MotionConfig reducedMotion="user">
				<AnimatePresence mode="wait" initial={false}>
					<motion.span
						key={line}
						className="inline-block"
						initial={{ opacity: 0, y: 3 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -3 }}
						transition={{ duration: 0.2, ease: BOOT_EASE }}
					>
						{t(line)}
					</motion.span>
				</AnimatePresence>
			</MotionConfig>
		</span>
	);
}

/** Seconds since the row appeared, with one decimal. */
function ElapsedSeconds() {
	const { t, locale } = useTranslation();
	const [startedAt] = useState(() => Date.now());
	const [elapsedMs, setElapsedMs] = useState(0);

	// One tick per 100 ms reads the clock, so a slow tab does not drift the counter.
	useEffect(() => {
		const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), 100);
		return () => clearInterval(timer);
	}, [startedAt]);

	const seconds = new Intl.NumberFormat(locale, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	}).format(elapsedMs / 1000);

	return (
		<span className="font-grotesk text-[12px] text-night/45 tabular-nums dark:text-foreground/45">
			{t("appBuilder.chat.elapsed", { seconds })}
		</span>
	);
}

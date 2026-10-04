/**
 * The status line of the running turn, under the chat list. It starts with
 * the Wandit byline, then the pixel grid and the latest step in plain
 * words: the preparation title with a stepping detail line, "Thinking",
 * "Updating the styles", and so on. When the live reply has steps, a click
 * opens the details panel, outside the developer view. Rendered by chat-pane.tsx with the status of
 * liveStatusOf (turn-parts.ts).
 */

import { ChevronRight } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useState } from "react";

import { type TranslationKey, useTranslation } from "@/lib/i18n";
import { BOOT_EASE, DETAIL_STEP_MS } from "../../lib/constants";
import type { LiveStatus } from "../../lib/turn-parts";
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

/** Props of the status line, as chat-pane.tsx passes them. */
export type WorkingRowProps = {
	/** What the running turn does now, from liveStatusOf. Picks the label. */
	status: LiveStatus;
	/** True starts the line with the Wandit byline. The developer view hides it once the live reply shows its own. */
	showsByline: boolean;
	/** True shows the seconds since the line appeared. Developer view only. */
	showsElapsed: boolean;
	/** Opens the details panel of the live reply. Null while the reply has no thought, step, or note, and always in the developer view; the line is then not a button. */
	onOpen: (() => void) | null;
};

/**
 * The dictionary key of a status label. An edit names the part of the app
 * it changes; every other step kind has one plain label.
 */
function labelKeyOf(status: LiveStatus): TranslationKey {
	switch (status.kind) {
		case "setup":
		case "wake":
			return "appBuilder.chat.preparing.title";
		case "thinking":
			return "appBuilder.chat.thinking";
		case "writing":
			return "appBuilder.chat.status.writing";
		case "saving":
			return "appBuilder.chat.phases.committing";
		case "step":
			return status.stepKind === "edit"
				? `appBuilder.chat.status.edit.${status.area ?? "code"}`
				: `appBuilder.chat.status.${status.stepKind}`;
	}
}

/**
 * The line of the running turn. chat-pane.tsx keeps it in one slot, and the
 * counter keeps its place when the byline goes. So the seconds never restart.
 */
export function WorkingRow({
	status,
	showsByline,
	showsElapsed,
	onOpen,
}: WorkingRowProps) {
	const { t } = useTranslation();
	const { kind } = status;
	const isPreparing = kind === "setup" || kind === "wake";
	const label = t(labelKeyOf(status));

	const content = (
		<>
			<span
				aria-hidden
				className="mt-[3px] grid size-3.5 shrink-0 grid-cols-3 gap-px"
			>
				{PIXEL_GRID.map((pixel) => (
					<span
						key={pixel.key}
						className="animate-pulse-soft rounded-[1px] bg-primary motion-reduce:animate-none"
						style={{ animationDelay: `${pixel.delayMs}ms` }}
					/>
				))}
			</span>
			<span className="flex min-w-0 flex-col gap-0.5">
				<span className="flex min-w-0 items-baseline gap-2.5">
					{/* A new label fades in, like the detail line, so a fast step change does not flash. */}
					<AnimatePresence mode="wait" initial={false}>
						<motion.span
							key={label}
							dir="auto"
							className="min-w-0 truncate"
							initial={{ opacity: 0, y: 3 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -3 }}
							transition={{ duration: 0.2, ease: BOOT_EASE }}
						>
							<ShimmerText>{label}</ShimmerText>
						</motion.span>
					</AnimatePresence>
					{onOpen !== null ? (
						<ChevronRight
							className="size-3.5 shrink-0 self-center text-muted-foreground transition-colors group-hover:text-foreground rtl:-scale-x-100"
							aria-hidden
						/>
					) : null}
					{showsElapsed ? <ElapsedSeconds /> : null}
				</span>
				{/* A new kind starts its own list at the first line. */}
				{isPreparing ? (
					<DetailLine key={kind} lines={DETAIL_LINES[kind]} />
				) : null}
			</span>
		</>
	);

	return (
		<MotionConfig reducedMotion="user">
			<div role="status" className="flex flex-col gap-3">
				{showsByline ? <AssistantByline /> : null}
				{onOpen !== null ? (
					<button
						type="button"
						onClick={onOpen}
						className="group flex min-w-0 items-start gap-2.5 self-start rounded-md text-start text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						{content}
					</button>
				) : (
					<div className="flex items-start gap-2.5 text-muted-foreground text-sm">
						{content}
					</div>
				)}
			</div>
		</MotionConfig>
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
		<span aria-hidden className="text-[13px] leading-[18px]">
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
		<span className="font-mono text-xs tabular-nums">
			{t("appBuilder.chat.elapsed", { seconds })}
		</span>
	);
}

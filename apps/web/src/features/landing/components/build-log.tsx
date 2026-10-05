/**
 * The build log card of the hero stage: four steps that tick while the app
 * builds. hero.tsx renders it next to the device, one card per build run.
 * When the wand sweep is done, the last step turns into an amber chip. The
 * chip is a QR code for a mobile app and a live address for a web app.
 * Decorative only.
 */

import type { TargetPlatform } from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";
import { Check, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { Spark } from "@/components/logo";

/** Time of one log step, in ms: a step spins this long, then it gets its check. */
export const LOG_STEP_MS = 420;

type BuildLogProps = {
	/** The four steps of landing.hero.log.<id>. The last step names the result. */
	lines: string[];
	/** Platform of the app. It picks the chip: QR code (mobile) or live address (web). */
	platform: TargetPlatform;
	/** Time from mount to the first step, in ms. The hero waits for its typing. */
	startDelayMs: number;
	/** True when the wand sweep is done. It turns the last step into the chip. */
	isBuilt: boolean;
	/** True under reduced motion: every step shows as done, with no timers. */
	isStill: boolean;
	/** Text of the mobile chip, from landing.hero.scanToOpen. */
	scanLabel: string;
};

/** A night card that lists the build steps and ends on the result chip. */
export function BuildLog({
	lines,
	platform,
	startDelayMs,
	isBuilt,
	isStill,
	scanLabel,
}: BuildLogProps) {
	const lastIndex = lines.length - 1;
	// Index of the step that spins now. -1 before the first step starts.
	const [activeIndex, setActiveIndex] = useState(isStill ? lastIndex : -1);

	useEffect(() => {
		if (isStill) return;
		const timers = lines.map((_, index) =>
			window.setTimeout(
				() => setActiveIndex(index),
				startDelayMs + index * LOG_STEP_MS,
			),
		);
		return () => {
			for (const timer of timers) window.clearTimeout(timer);
		};
	}, [isStill, lines, startDelayMs]);

	// The bar fills one quarter per step and is full when the app is built.
	const progress = isBuilt ? 1 : Math.max(activeIndex, 0) / lines.length;

	return (
		<motion.div
			initial={isStill ? false : { opacity: 0, scale: 0.94 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.25 } }}
			transition={{
				// The card shows with the first step. Motion takes the delay in seconds.
				delay: isStill ? 0 : startDelayMs / 1000,
				type: "spring",
				bounce: 0.25,
				duration: 0.5,
			}}
			className="w-[15rem] origin-bottom-left rounded-[1.375rem] bg-night p-3.5 text-white shadow-[0_34px_70px_-28px_rgba(40,10,0,0.75),0_12px_24px_-14px_rgba(40,10,0,0.5)] ring-1 ring-white/10 md:w-[17.5rem] rtl:origin-bottom-right"
		>
			<div className="flex items-center gap-3">
				<Spark
					className={cn(
						"size-4 text-spark",
						!isBuilt && !isStill && "motion-safe:animate-spin",
					)}
				/>
				<span className="h-1 flex-1 overflow-hidden rounded-full bg-white/12">
					<motion.span
						className="block h-full origin-left rounded-full bg-spark rtl:origin-right"
						initial={false}
						animate={{ scaleX: progress }}
						transition={{ duration: 0.45, ease: "easeOut" }}
					/>
				</span>
			</div>
			<ol className="mt-3 flex flex-col gap-2.5 font-medium text-[0.8125rem] leading-snug lg:mt-4 lg:text-sm">
				{lines.map((line, index) => {
					const isDone = index < activeIndex || (isBuilt && index < lastIndex);
					const isActive = index === activeIndex;
					// Below lg the card is compact: it shows only the current step, so the phone stays visible.
					const isCurrent =
						index === (isBuilt ? lastIndex : Math.max(activeIndex, 0));
					if (index === lastIndex && isBuilt) {
						return (
							<li key={line} className={cn(!isCurrent && "max-lg:hidden")}>
								<ResultChip
									platform={platform}
									label={platform === "mobile" ? scanLabel : line}
									isStill={isStill}
								/>
							</li>
						);
					}
					return (
						<li
							key={line}
							className={cn(
								"flex min-h-5 items-center gap-2.5 transition-colors duration-300",
								isDone || isActive ? "text-white" : "text-white/50",
								!isCurrent && "max-lg:hidden",
							)}
						>
							<StepIcon
								state={isDone ? "done" : isActive ? "active" : "idle"}
							/>
							{line}
						</li>
					);
				})}
			</ol>
		</motion.div>
	);
}

/** A step is idle (not started), active (spinning) or done (checked). */
type StepState = "idle" | "active" | "done";

/** A ring, a spinner, or the amber check. The new icon pops in over the old one. */
function StepIcon({ state }: { state: StepState }) {
	return (
		<span className="relative grid size-4 shrink-0 place-items-center">
			<AnimatePresence initial={false} mode="popLayout">
				<motion.span
					key={state}
					initial={{ scale: 0.4, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					exit={{ scale: 0.4, opacity: 0 }}
					transition={{ type: "spring", bounce: 0.45, duration: 0.35 }}
					className="grid size-4 place-items-center"
				>
					{state === "idle" ? (
						<span className="size-3 rounded-full border-[1.5px] border-white/25" />
					) : null}
					{state === "active" ? (
						<LoaderCircle
							className="size-4 text-spark motion-safe:animate-spin"
							strokeWidth={2.75}
						/>
					) : null}
					{state === "done" ? (
						<Check className="size-4 text-spark" strokeWidth={3.2} />
					) : null}
				</motion.span>
			</AnimatePresence>
		</span>
	);
}

type ResultChipProps = {
	platform: TargetPlatform;
	/** "Scan to open" for a mobile app, the "Live on <address>" step for a web app. */
	label: string;
	/** True under reduced motion: the chip shows at once, without its pop. */
	isStill: boolean;
};

/** The amber result of the build: where the visitor opens the new app. */
function ResultChip({ platform, label, isStill }: ResultChipProps) {
	return (
		<motion.span
			initial={isStill ? false : { scale: 0.85, opacity: 0 }}
			animate={{ scale: 1, opacity: 1 }}
			transition={{ type: "spring", bounce: 0.4, duration: 0.5 }}
			className={cn(
				"flex origin-left items-center gap-3 bg-spark font-semibold text-night lg:mt-1 rtl:origin-right",
				platform === "mobile"
					? "rounded-2xl p-1.5 pe-3"
					: "rounded-full px-3 py-2",
			)}
		>
			{platform === "mobile" ? (
				<svg
					viewBox="-1 -1 23 23"
					aria-hidden="true"
					shapeRendering="crispEdges"
					className="size-12 shrink-0 rounded-[0.625rem] bg-white p-1 text-night"
				>
					<path d={QR_PATH} fill="currentColor" />
				</svg>
			) : (
				<span className="relative flex size-2.5 shrink-0">
					<span className="absolute inset-0 animate-ping rounded-full bg-night/50 motion-reduce:animate-none" />
					<span className="relative size-2.5 rounded-full bg-night" />
				</span>
			)}
			<span className="min-w-0 leading-tight">{label}</span>
		</motion.span>
	);
}

/** Modules per side of the fake QR code: the size of a version 1 code. */
const QR_SIZE = 21;
/** Top start corners of the three finder squares, like on a real code. */
const QR_FINDERS = [
	[0, 0],
	[14, 0],
	[0, 14],
] as const;

/** True when the module at (x, y) is dark. The pattern looks like a QR code and encodes nothing. */
function isQrModuleOn(x: number, y: number) {
	for (const [finderX, finderY] of QR_FINDERS) {
		const dx = x - finderX;
		const dy = y - finderY;
		// A finder is a dark 7 x 7 ring, a light ring, and a dark 3 x 3 core.
		if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
			return Math.max(Math.abs(dx - 3), Math.abs(dy - 3)) !== 2;
		}
		// One light module around each finder separates it from the data.
		if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) return false;
	}
	// A fixed hash, so the pattern is the same on every render. About 45% of the modules are dark.
	return (x * 31 + y * 17 + x * y * 7 + ((x ^ y) & 3)) % 11 < 5;
}

/**
 * One SVG path for all dark modules of the fake QR code, one unit square each.
 * builder-window.tsx draws it too. Use viewBox "-1 -1 23 23" for a one-module margin.
 */
export const QR_PATH = Array.from({ length: QR_SIZE * QR_SIZE }, (_, index) => {
	const x = index % QR_SIZE;
	const y = Math.floor(index / QR_SIZE);
	return isQrModuleOn(x, y) ? `M${x} ${y}h1v1h-1z` : "";
}).join("");

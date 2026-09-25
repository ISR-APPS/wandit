/**
 * The screen over the preview while the app is not on screen yet: the
 * Wandit Spark and the app drawing, the real start-up steps, and an
 * elapsed timer; or the asleep note while the app sleeps. PreviewPanel
 * renders it until the iframe loads. It reads its content from
 * lib/boot-state.ts and draws with BootPlan.
 */

import { cn } from "@wandit/ui/lib/utils";
import { Check, CircleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { type TranslationKey, useTranslation } from "@/lib/i18n";
import {
	type BootContext,
	type BootScene,
	type BootStep,
	type BootView,
	bootViewOf,
	formatElapsed,
	INITIAL_BOOT_MEMORY,
	rememberBoot,
	sceneOf,
} from "../../lib/boot-state";
import { BOOT_EASE } from "../../lib/constants";
import { BootPlan } from "./boot-plan";

/** How long a first `waking` answer shows the mark before the asleep note, ms. The chat stream of a new project connects in about a second. */
const ASLEEP_DELAY_MS = 1200;
/** Time each detail line stays before the next one, ms. The last line then stays. */
const DETAIL_STEP_MS = 3200;
/** Tick of the elapsed timer, ms. Four ticks per second keep the seconds on time in a slow tab. */
const TIMER_TICK_MS = 250;

/** Opacity of the ember wash behind the picture, per scene. It is brightest when the app opens and lowest when it did not start. */
const WASH_OPACITY: Record<BootScene, string> = {
	loading: "opacity-30",
	create: "opacity-55",
	wake: "opacity-40",
	open: "opacity-100",
	asleep: "opacity-22",
	stopped: "opacity-12",
};

/** Props of the boot screen. PreviewPanel passes them. */
export type PreviewBootScreenProps = {
	/** Status of the preview token, without `error`: PreviewPanel shows its own alert for it. */
	tokenStatus: "loading" | "waking" | "ready";
	/** The running turn and the backend state, from app-builder-page.tsx through PreviewPanel. */
	bootContext: BootContext;
};

/**
 * Keeps the boot memory and the shown variant, and renders the stage. A
 * first `waking` answer waits 1.2 s before the asleep note: on a new
 * project the running turn often connects in that time.
 */
export function PreviewBootScreen({
	tokenStatus,
	bootContext,
}: PreviewBootScreenProps) {
	const { t } = useTranslation();
	const signals = { ...bootContext, tokenStatus };

	const [memory, setMemory] = useState(INITIAL_BOOT_MEMORY);
	const nextMemory = rememberBoot(memory, signals);
	if (nextMemory !== memory) setMemory(nextMemory);
	const view = bootViewOf(signals, nextMemory);

	const [shownVariant, setShownVariant] =
		useState<BootView["variant"]>("loading");
	const waitsForAsleep =
		view.variant === "asleep" && shownVariant === "loading";
	if (!waitsForAsleep && shownVariant !== view.variant) {
		setShownVariant(view.variant);
	}
	useEffect(() => {
		if (!waitsForAsleep) return;
		const timer = setTimeout(() => setShownVariant("asleep"), ASLEEP_DELAY_MS);
		return () => clearTimeout(timer);
	}, [waitsForAsleep]);
	const shown: BootView = waitsForAsleep ? { variant: "loading" } : view;
	const scene = sceneOf(shown);

	return (
		// The stage is the dark output world in both themes, so the dark tokens apply inside.
		<div className="dark @container-size relative flex size-full items-center justify-center overflow-hidden bg-void text-white/92">
			<p role="status" className="sr-only">
				{announcementOf(shown, t)}
			</p>
			{/* On wide stages the frame edges and the text edges line up; the width follows the stage height. */}
			<motion.div
				variants={{ leave: { scale: 1.04 } }}
				transition={{ duration: 0.26, ease: BOOT_EASE }}
				className="relative flex @max-[560px]:w-[min(300px,calc(100cqw_-_48px))] w-[clamp(280px,calc(100cqh_-_300px),420px)] flex-col"
			>
				{/* data-scene names the picture for the specs. */}
				<div className="relative" data-scene={scene}>
					<div
						aria-hidden="true"
						className={cn(
							"-translate-1/2 pointer-events-none absolute top-1/2 left-1/2 @max-[560px]:size-[440px] h-[460px] w-[640px] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--ember-2)_22%,transparent),transparent)] transition-opacity duration-800",
							WASH_OPACITY[scene],
						)}
					/>
					<BootPlan scene={scene} />
				</div>
				{/* The reserved height holds the longest step list, so a late row or a variant change never moves the drawing. */}
				<motion.div
					variants={{ leave: { opacity: 0, transition: { duration: 0.12 } } }}
					className="relative @max-[560px]:mt-6 mt-8 @max-[560px]:min-h-[236px] min-h-[214px]"
				>
					<AnimatePresence mode="popLayout">
						<motion.div
							key={shown.variant}
							initial={{ opacity: 0 }}
							animate={{
								opacity: 1,
								transition: { duration: 0.3, delay: 0.25, ease: BOOT_EASE },
							}}
							exit={{
								opacity: 0,
								transition: { duration: 0.15, ease: BOOT_EASE },
							}}
						>
							<BootCopy view={shown} />
						</motion.div>
					</AnimatePresence>
				</motion.div>
			</motion.div>
		</div>
	);
}

/** The text a screen reader hears. The timer and the cycling detail stay silent, so it does not speak every few seconds. */
function announcementOf(
	view: BootView,
	t: (key: TranslationKey) => string,
): string {
	switch (view.variant) {
		case "loading":
			return t("appBuilder.preview.boot.loading");
		case "asleep":
			return view.stopped
				? `${t("appBuilder.preview.boot.stopped.title")}. ${t("appBuilder.preview.boot.stopped.body")}`
				: `${t("appBuilder.preview.boot.asleep.title")}. ${t("appBuilder.preview.boot.asleep.body")}`;
		case "booting": {
			const active = view.steps.find(
				(step) => step.state === "active" && step.id !== "database",
			);
			return active === undefined
				? t("appBuilder.preview.boot.title")
				: `${t("appBuilder.preview.boot.title")}. ${t(active.label)}`;
		}
	}
}

/** The text under the drawing. The loading variant shows none. */
function BootCopy({ view }: { view: BootView }) {
	const { t } = useTranslation();

	if (view.variant === "loading") return null;

	if (view.variant === "asleep") {
		return (
			<div>
				<h2 className="text-balance font-medium @max-[560px]:text-[17px] text-[20px] text-white/92 leading-[1.25]">
					{t(
						view.stopped
							? "appBuilder.preview.boot.stopped.title"
							: "appBuilder.preview.boot.asleep.title",
					)}
				</h2>
				<p className="mt-2 text-pretty @max-[560px]:text-[13.5px] text-[14px] text-white/62 leading-normal">
					{t(
						view.stopped
							? "appBuilder.preview.boot.stopped.body"
							: "appBuilder.preview.boot.asleep.body",
					)}
				</p>
			</div>
		);
	}

	return (
		<div>
			<div className="flex items-baseline justify-between gap-3">
				<h2 className="text-balance font-medium @max-[560px]:text-[17px] text-[20px] text-white/92 leading-[1.25]">
					{t("appBuilder.preview.boot.title")}
				</h2>
				<ElapsedTime />
			</div>
			<ol className="mt-3.5">
				{view.steps.map((step) => (
					<StepRow key={step.id} step={step} />
				))}
			</ol>
		</div>
	);
}

/** Label color of a main step, per state. */
const LABEL_CLASSES: Record<BootStep["state"], string> = {
	pending: "text-white/50",
	active: "font-medium text-white/92",
	done: "text-white/62",
	failed: "text-white/62",
};

/** One step: its icon, its label, and its detail line. The database row runs in the background, so it is quieter. */
function StepRow({ step }: { step: BootStep }) {
	const { t } = useTranslation();
	const isDatabase = step.id === "database";

	return (
		<li
			className={cn(
				"grid grid-cols-[16px_1fr] gap-x-3 py-[7px]",
				isDatabase && "mt-2 border-white/9 border-t pt-[15px]",
			)}
		>
			<span className="grid h-5 w-4 place-items-center">
				<AnimatePresence mode="popLayout" initial={false}>
					<motion.span
						key={step.state}
						className="grid place-items-center"
						initial={{ opacity: 0, scale: 0.6 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.24, ease: BOOT_EASE }}
					>
						<StepIcon state={step.state} isDatabase={isDatabase} />
					</motion.span>
				</AnimatePresence>
			</span>
			<span
				className={cn(
					"@max-[560px]:text-[13.5px] text-[14px] leading-5 transition-colors duration-150",
					isDatabase && step.state === "active"
						? "text-white/66"
						: LABEL_CLASSES[step.state],
				)}
			>
				{t(step.label)}
			</span>
			{step.details.length > 0 ? (
				<DetailLine
					lines={step.details}
					// The caret marks the one main step that works now.
					withCaret={step.state === "active" && !isDatabase}
				/>
			) : null}
		</li>
	);
}

/** The icon of a step state. The database spinner turns three times slower. */
function StepIcon({
	state,
	isDatabase,
}: {
	state: BootStep["state"];
	/** True for the background database row. */
	isDatabase: boolean;
}) {
	switch (state) {
		case "pending":
			return (
				<span className="size-[13px] rounded-full border-[1.5px] border-white/22" />
			);
		case "active":
			return (
				<svg
					viewBox="0 0 16 16"
					aria-hidden="true"
					className={cn(
						"size-4 motion-reduce:animate-none",
						isDatabase ? "animate-spin-slow" : "animate-spin",
					)}
				>
					<circle
						cx="8"
						cy="8"
						r="6.25"
						fill="none"
						strokeWidth="1.5"
						className="stroke-white/12"
					/>
					<path
						d="M8 1.75A6.25 6.25 0 0 1 14.25 8"
						fill="none"
						strokeWidth="1.5"
						strokeLinecap="round"
						className={isDatabase ? "stroke-ember-1/75" : "stroke-ember-1"}
					/>
				</svg>
			);
		case "done":
			return (
				<span className="grid size-4 place-items-center rounded-full bg-gradient-ember">
					<Check
						className="size-2.5 text-void"
						strokeWidth={3}
						aria-hidden="true"
					/>
				</span>
			);
		case "failed":
			return (
				<CircleAlert
					className="size-4 text-destructive"
					strokeWidth={1.75}
					aria-hidden="true"
				/>
			);
	}
}

/**
 * The detail under a label. It shows each line for 3.2 s and keeps the
 * last one: a loop would read as "it started again". A shorter new list
 * shows its last line.
 */
function DetailLine({
	lines,
	withCaret,
}: {
	lines: TranslationKey[];
	/** True for the main active step: an ember caret blinks after the text. */
	withCaret: boolean;
}) {
	const { t } = useTranslation();
	const [index, setIndex] = useState(0);
	const lastIndex = lines.length - 1;
	const line = lines[Math.min(index, lastIndex)];

	useEffect(() => {
		if (index >= lastIndex) return;
		const timer = setTimeout(() => setIndex(index + 1), DETAIL_STEP_MS);
		return () => clearTimeout(timer);
	}, [index, lastIndex]);

	return (
		// A cycling line stays silent: the status line already names the step.
		<span
			aria-hidden={lines.length > 1}
			className="relative col-start-2 text-pretty text-[12.5px] text-white/50 leading-[18px]"
		>
			<AnimatePresence mode="popLayout" initial={false}>
				<motion.span
					key={line}
					className="inline-block"
					initial={{ opacity: 0, y: 3 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -3 }}
					transition={{ duration: 0.2, ease: BOOT_EASE }}
				>
					{line === undefined ? null : t(line)}
				</motion.span>
			</AnimatePresence>
			{withCaret ? (
				<span className="ms-[3px] inline-block h-[11px] w-px animate-caret bg-ember-1 align-[-1px] motion-reduce:animate-none" />
			) : null}
		</span>
	);
}

/** `m:ss` since the step list showed. It restarts when the list mounts again, for example after the asleep note. */
function ElapsedTime() {
	const [startedAt] = useState(() => Date.now());
	const [elapsedMs, setElapsedMs] = useState(0);

	useEffect(() => {
		const timer = setInterval(
			() => setElapsedMs(Date.now() - startedAt),
			TIMER_TICK_MS,
		);
		return () => clearInterval(timer);
	}, [startedAt]);

	return (
		<span
			dir="ltr"
			aria-hidden="true"
			className="shrink-0 font-mono text-[12.5px] text-white/50 tabular-nums leading-none tracking-normal"
		>
			{formatElapsed(elapsedMs)}
		</span>
	);
}

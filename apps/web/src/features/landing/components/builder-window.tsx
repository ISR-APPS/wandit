/**
 * The Wandit builder window of the "How it works" section: a dark product UI
 * with a chat column and a live preview. It shows one state per step.
 * how-it-works.tsx renders it sticky on wide screens and once per step on
 * small screens. It uses the screens kit: DeviceFrame, FitScreen, WandSweep, MiniApp.
 */

import { cn } from "@wandit/ui/lib/utils";
import {
	ArrowUp,
	Check,
	ChevronDown,
	Cloud,
	CodeXml,
	Eye,
	Globe,
	LoaderCircle,
	Monitor,
	Scissors,
	Smartphone,
} from "lucide-react";
import {
	AnimatePresence,
	motion,
	useInView,
	useReducedMotion,
} from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { Spark } from "@/components/logo";
import { type Locale, useDictionary, useTranslation } from "@/lib/i18n";

import { QR_PATH } from "./build-log";
import { DeviceFrame } from "./device-frame";
import { FitScreen } from "./fit-screen";
import { MINI_APP_SIZE, MiniApp } from "./mini-apps";
import { WandSweep } from "./wand-sweep";

/** Index of a step in landing.howItWorks.steps: 0 describe, 1 build, 2 phone, 3 publish. */
export type BuilderStep = 0 | 1 | 2 | 3;

type BuilderWindowProps = {
	step: BuilderStep;
	/**
	 * "story" plays the beats of each step while the window is in view. In
	 * step 2, a real phone also slides up outside the window. "still" shows the
	 * last beat of the step at once, for the stacked layout on small screens.
	 */
	mode: "story" | "still";
};

/** Time to type the prompt in step 0, in ms. The speed adapts to the length in each language. */
const PROMPT_TYPING_MS = 1800;
/** Time to type the edit request in step 2, in ms. It is a short sentence. */
const EDIT_TYPING_MS = 1000;
/** Time between two agent rows in step 1, in ms. */
const ROW_MS = 520;
/**
 * The skeleton holds while the four rows tick, then the wand sweep reveals the app.
 * The extra 150 ms lets the last check show before the sweep starts.
 */
const BUILD_HOLD_MS = 4 * ROW_MS + 150;

/*
 * Gaps between the beats of each step, in ms. Beat 0 starts with the step.
 * Step 0: 0 the prompt types, 1 it is sent. Step 1: 1 to 4 one more row is
 * done, 5 the "ready" message. Step 2: 0 the QR code scans, 1 the phone
 * slides up, 2 the edit types, 3 it is sent, 4 the reply, 5 the gold button.
 * Step 3: 1 publish is pressed, 2 the app is live.
 */
const BEAT_GAPS_MS = {
	0: [PROMPT_TYPING_MS + 450],
	1: [ROW_MS, ROW_MS, ROW_MS, ROW_MS, 1300],
	2: [1100, 900, EDIT_TYPING_MS + 400, 800, 450],
	3: [700, 900],
} as const satisfies Record<BuilderStep, readonly number[]>;

/** The demo project. Its name and address are brand-like, so they are not translated. */
const APP_NAME = "Fade Studio";
const APP_URL = "fade-studio.wandit.app";
/** Design size of the barber app screen, in CSS px: 360 x 780. */
const PHONE_SCREEN = MINI_APP_SIZE.mobile;

/** What the preview phone shows. "build" plays the wand sweep from the skeleton to the app. */
type PhoneScreen = "blank" | "skeleton" | "build" | "app";

/** The entrance of chat items, the preview stage and the popover: quick, with a small overshoot. */
const ENTER_SPRING = { type: "spring", bounce: 0.18, duration: 0.55 } as const;

/** The builder window in the state of one step. Decorative: the step list carries the content. */
export function BuilderWindow({ step, mode }: BuilderWindowProps) {
	const { landing } = useDictionary();
	const { locale, dir } = useTranslation();
	const demo = landing.howItWorks.demo;
	const reduceMotion = useReducedMotion() ?? false;
	const rootRef = useRef<HTMLDivElement>(null);
	const isInView = useInView(rootRef, { amount: 0.4 });
	const isStory = mode === "story";
	const beat = useBeat(step, isInView, !isStory || reduceMotion);
	const isRtl = dir === "rtl";

	// True once the window has played the beat `atBeat` of the step `atStep`.
	const reached = (atStep: BuilderStep, atBeat: number) =>
		step > atStep || (step === atStep && beat >= atBeat);

	const prompt = `${landing.hero.leadStart} ${landing.hero.platforms.mobile} ${landing.ideas.items.barber.text}`;
	// Text types only on screen, so the visitor sees it from the first letter.
	let typing: Typing | null = null;
	if (isStory && isInView && step === 0 && beat === 0) {
		typing = { text: prompt, durationMs: PROMPT_TYPING_MS };
	}
	if (isStory && isInView && step === 2 && beat === 2) {
		typing = { text: demo.edit, durationMs: EDIT_TYPING_MS };
	}
	const isGold = reached(2, 5);
	const isRealPhoneUp = isStory && step === 2 && beat >= 1;
	// In the story the QR card replaces the preview phone, and the real phone takes over.
	const isScanStage = isStory && step === 2;

	let screen: PhoneScreen = "app";
	if (step === 0) screen = beat === 0 ? "blank" : "skeleton";
	// The still window shows the last beat of step 1: the app is ready.
	if (step === 1 && isStory) screen = "build";

	return (
		<div ref={rootRef} aria-hidden="true" className="relative">
			<div
				dir={dir}
				className="@container/window relative flex flex-col overflow-hidden rounded-[1.25rem] bg-night font-sans text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_color-mix(in_oklab,var(--color-night)_90%,transparent),0_60px_100px_-50px_color-mix(in_oklab,var(--color-ember-deep)_55%,transparent),0_34px_60px_-34px_color-mix(in_oklab,var(--color-night)_60%,transparent)]"
			>
				<TopBar
					tabs={demo.tabs}
					publishLabel={demo.publish}
					isPublishOpen={step === 3}
				/>
				<div className="flex @lg/window:h-[32rem] h-[21rem]">
					<div className="flex @lg/window:w-[40%] w-[45%] shrink-0 flex-col border-white/[0.07] border-e">
						{/* The log starts at the top. When it is taller than the column, it grows from the bottom edge.
						    Then a new item pushes the older items up and out under the fade. */}
						<div className="relative min-h-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,#000_1.25rem)]">
							<div className="absolute inset-x-0 bottom-0 flex min-h-full flex-col @lg/window:gap-4 gap-3 @lg/window:px-4 px-3 @lg/window:pt-6 pt-4 pb-2 @lg/window:text-[13px] text-[10.5px] leading-[1.5]">
								<AnimatePresence initial={false}>
									{reached(0, 1) ? (
										<ChatItem key="prompt" side="user">
											{prompt}
										</ChatItem>
									) : null}
									{reached(1, 0) ? (
										<ChatItem key="build" side="agent">
											<BuildCard
												rows={demo.working}
												doneCount={
													step === 1
														? Math.min(beat, demo.working.length)
														: demo.working.length
												}
											/>
										</ChatItem>
									) : null}
									{reached(1, 5) ? (
										<ChatItem key="done" side="agent">
											{demo.done}
										</ChatItem>
									) : null}
									{reached(2, 3) ? (
										<ChatItem key="edit" side="user">
											{demo.edit}
										</ChatItem>
									) : null}
									{reached(2, 4) ? (
										<ChatItem key="edit-done" side="agent">
											<span className="flex items-start gap-2">
												<span className="mt-[0.3em] size-[0.85em] shrink-0 rounded-full bg-[#d4a24c] shadow-[0_0_0_3px_rgba(212,162,76,0.22)]" />
												{demo.editDone}
											</span>
										</ChatItem>
									) : null}
								</AnimatePresence>
							</div>
						</div>
						<Composer typing={typing} placeholder={demo.composer} />
					</div>

					<div className="relative min-w-0 flex-1 overflow-hidden bg-[#0f1540] bg-[radial-gradient(70%_55%_at_50%_55%,color-mix(in_oklab,var(--color-spark)_12%,transparent),transparent_70%)] [container-type:size]">
						<PreviewToolbar />
						<AnimatePresence mode="popLayout">
							{isScanStage ? (
								<motion.div
									key="scan"
									initial={{ opacity: 0, scale: 0.9, y: 16 }}
									animate={{ opacity: 1, scale: 1, y: 0 }}
									exit={{ opacity: 0, scale: 0.94 }}
									transition={ENTER_SPRING}
									// The real phone covers the end side, so the card sits in the start part.
									className="absolute inset-y-0 start-0 flex w-[50%] items-center justify-center pt-[6cqh]"
								>
									<div className="w-[min(40cqw,11rem)]">
										<ScanCard title={demo.scanTitle} isScanning={beat === 0} />
									</div>
								</motion.div>
							) : (
								<motion.div
									key="phone"
									initial={{ opacity: 0, scale: 0.94, y: 18 }}
									animate={{ opacity: 1, scale: 1, y: 0 }}
									exit={{ opacity: 0, scale: 0.94, y: 18 }}
									transition={ENTER_SPRING}
									className="absolute inset-0 flex items-center justify-center @lg/window:pt-[8cqh] pt-[4cqh]"
								>
									<PreviewPhone
										screen={screen}
										language={locale}
										isGold={isGold}
									/>
									{!isStory && step === 2 ? (
										// The card covers the top of the phone, so the gold book button stays in view.
										<div className="absolute start-[4%] top-[7%] w-[min(46cqw,10.5rem)] -rotate-3 rtl:rotate-3">
											<ScanCard title={demo.scanTitle} isScanning={false} />
										</div>
									) : null}
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>

				<AnimatePresence>
					{step === 3 ? (
						<PublishPopover
							key="publish"
							labels={demo}
							isPressed={beat === 1}
							isLive={beat >= 2}
							isPulsing={isStory && isInView && !reduceMotion}
						/>
					) : null}
				</AnimatePresence>
			</div>

			<AnimatePresence>
				{isRealPhoneUp ? (
					<motion.div
						key="real-phone"
						initial={{ opacity: 0, y: "110%", rotate: 0 }}
						animate={{ opacity: 1, y: 0, rotate: isRtl ? 5 : -5 }}
						exit={{ opacity: 0, y: "110%", rotate: 0 }}
						transition={{ type: "spring", bounce: 0.2, duration: 0.85 }}
						// The phone breaks out of the window at the bottom end corner, like a device held in front of the screen.
						className="absolute end-[-0.75rem] -bottom-16 z-10 w-[clamp(11rem,34%,13.5rem)] min-[1400px]:end-[-2.5rem]"
					>
						<DeviceFrame platform="mobile" className="w-full">
							<FitScreen
								width={PHONE_SCREEN.width}
								height={PHONE_SCREEN.height}
							>
								<MiniApp
									id="barber"
									language={locale}
									bookAccent={isGold ? "gold" : "default"}
								/>
							</FitScreen>
						</DeviceFrame>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	);
}

/**
 * The beat of the current step. It restarts at 0 on each step change and
 * moves on by BEAT_GAPS_MS while `isPlaying`. With `isInstant` (a still
 * window, or reduced motion) it is the last beat of the step at once.
 */
function useBeat(step: BuilderStep, isPlaying: boolean, isInstant: boolean) {
	const gaps = BEAT_GAPS_MS[step];
	const [current, setCurrent] = useState({ step, beat: 0 });
	// A new step restarts its beats. React allows this state update during render.
	if (current.step !== step) setCurrent({ step, beat: 0 });
	const beat = current.step === step ? current.beat : 0;

	useEffect(() => {
		if (isInstant || !isPlaying || beat >= gaps.length) return;
		const timer = window.setTimeout(
			() => setCurrent({ step, beat: beat + 1 }),
			gaps[beat],
		);
		return () => window.clearTimeout(timer);
	}, [step, beat, gaps, isPlaying, isInstant]);

	return isInstant ? gaps.length : beat;
}

type TopBarProps = {
	/** Labels of the three editor tabs, from landing.howItWorks.demo.tabs. */
	tabs: { preview: string; code: string; cloud: string };
	/** Label of the top bar button, from landing.howItWorks.demo.publish. */
	publishLabel: string;
	/** True in step 3: the publish popover hangs from this button. */
	isPublishOpen: boolean;
};

function TopBar({ tabs, publishLabel, isPublishOpen }: TopBarProps) {
	const tabItems = [
		{ key: "preview", label: tabs.preview, Icon: Eye },
		{ key: "code", label: tabs.code, Icon: CodeXml },
		{ key: "cloud", label: tabs.cloud, Icon: Cloud },
	] as const;

	return (
		<div className="flex @lg/window:grid @lg/window:h-12 h-11 shrink-0 @lg/window:grid-cols-[1fr_auto_1fr] items-center gap-2.5 border-white/[0.07] border-b bg-[#080c29] @lg/window:px-4 px-3">
			<div className="flex min-w-0 items-center gap-3">
				<span className="@xl/window:flex hidden gap-1.5">
					<span className="size-2.5 rounded-full bg-white/[0.14]" />
					<span className="size-2.5 rounded-full bg-white/[0.14]" />
					<span className="size-2.5 rounded-full bg-white/[0.14]" />
				</span>
				<span className="flex min-w-0 items-center gap-2">
					<span className="grid size-6 shrink-0 place-items-center rounded-[7px] bg-[#111] ring-1 ring-[#d4a24c]/45">
						<Scissors className="size-3.5 text-[#e8c37a]" strokeWidth={2.2} />
					</span>
					<span className="truncate font-semibold text-[12.5px] tracking-[-0.01em]">
						{APP_NAME}
					</span>
					<ChevronDown className="size-3.5 shrink-0 text-white/40" />
				</span>
			</div>

			<div className="@lg/window:flex hidden items-center gap-0.5 rounded-[10px] bg-white/[0.05] p-[3px] ring-1 ring-white/[0.07]">
				{tabItems.map(({ key, label, Icon }) => (
					<span
						key={key}
						className={cn(
							"flex h-7 items-center gap-1.5 rounded-[7px] px-2.5 font-medium text-[11.5px]",
							key === "preview"
								? "bg-white/[0.11] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
								: "text-white/50",
						)}
					>
						<Icon
							className="@xl/window:block hidden size-3.5"
							strokeWidth={2}
						/>
						{label}
					</span>
				))}
			</div>

			<div className="ms-auto flex items-center justify-end">
				<span
					className={cn(
						"flex h-7 items-center rounded-lg bg-spark px-3 font-semibold text-[12px] text-night transition-[translate,box-shadow] duration-200",
						isPublishOpen
							? "translate-y-[2px] shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-spark)_28%,transparent)]"
							: "shadow-[0_2px_0_var(--color-spark-deep)]",
					)}
				>
					{publishLabel}
				</span>
			</div>
		</div>
	);
}

type ChatItemProps = {
	/** "user" is a bubble on the end side. "agent" is plain text under the Wandit avatar. */
	side: "user" | "agent";
	children: ReactNode;
};

function ChatItem({ side, children }: ChatItemProps) {
	return (
		<motion.div
			layout="position"
			initial={{ opacity: 0, y: 14, scale: 0.98 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, transition: { duration: 0.15 } }}
			transition={ENTER_SPRING}
			className={
				side === "user"
					? "max-w-[92%] self-end rounded-2xl rounded-ee-md bg-white/[0.09] @lg/window:px-3.5 px-3 @lg/window:py-2.5 py-2 text-white ring-1 ring-white/[0.06]"
					: "flex flex-col gap-1.5 self-stretch"
			}
		>
			{side === "agent" ? (
				<>
					<span className="flex items-center gap-1.5 font-semibold text-[0.9em] text-white/55">
						<span className="grid size-[1.6em] place-items-center rounded-full bg-spark/15">
							<Spark className="size-[1em] text-spark" />
						</span>
						Wandit
					</span>
					<div className="text-white/85">{children}</div>
				</>
			) : (
				children
			)}
		</motion.div>
	);
}

type BuildCardProps = {
	/** Labels of the agent work, from landing.howItWorks.demo.working. */
	rows: string[];
	/** How many rows are done. The next row spins; the rest wait. */
	doneCount: number;
};

/** The agent's work list: each row spins, then ticks. A thin bar fills with the progress. */
function BuildCard({ rows, doneCount }: BuildCardProps) {
	return (
		<div className="overflow-hidden rounded-xl bg-white/[0.035] ring-1 ring-white/[0.08]">
			<ul className="flex flex-col gap-0.5 @lg/window:p-2 p-1.5">
				{rows.map((row, index) => {
					let state: RowState = "waiting";
					if (index < doneCount) state = "done";
					else if (index === doneCount) state = "active";
					return (
						<li
							key={row}
							className={cn(
								"flex items-start gap-2 rounded-md px-1.5 py-1 transition-colors duration-300",
								state === "active" && "bg-white/[0.05]",
							)}
						>
							<RowIcon state={state} />
							<span
								className={cn(
									"transition-colors duration-300",
									state === "waiting" && "text-white/35",
									state === "active" && "text-white",
									state === "done" && "text-white/70",
								)}
							>
								{row}
							</span>
						</li>
					);
				})}
			</ul>
			<div className="h-[2px] bg-white/[0.06]">
				<div
					className="h-full origin-left bg-spark transition-transform duration-500 ease-out rtl:origin-right"
					style={{ transform: `scaleX(${doneCount / rows.length})` }}
				/>
			</div>
		</div>
	);
}

type RowState = "done" | "active" | "waiting";

function RowIcon({ state }: { state: RowState }) {
	if (state === "active") {
		return (
			<LoaderCircle
				className="mt-[0.15em] size-[1.25em] shrink-0 text-spark motion-safe:animate-spin"
				strokeWidth={2.5}
			/>
		);
	}
	if (state === "waiting") {
		return (
			<span className="mt-[0.15em] size-[1.25em] shrink-0 rounded-full border border-white/20 border-dashed" />
		);
	}
	return (
		<motion.span
			initial={{ scale: 0.3, opacity: 0 }}
			animate={{ scale: 1, opacity: 1 }}
			transition={{ type: "spring", bounce: 0.5, duration: 0.45 }}
			className="mt-[0.15em] grid size-[1.25em] shrink-0 place-items-center rounded-full bg-spark text-night"
		>
			<Check className="size-[0.8em]" strokeWidth={3.5} />
		</motion.span>
	);
}

/** A message that types itself in the composer: the prompt in step 0, the edit request in step 2. */
type Typing = {
	text: string;
	/** Time to type the whole text, in ms. */
	durationMs: number;
};

type ComposerProps = {
	/** The message that types itself now, or null for the empty box. */
	typing: Typing | null;
	/** Grey hint of the empty box, from landing.howItWorks.demo.composer. */
	placeholder: string;
};

/** The message box under the chat. A message types here, then it leaves as a bubble. */
function Composer({ typing, placeholder }: ComposerProps) {
	return (
		<div className="@lg/window:m-3 m-2 flex items-end gap-2 rounded-xl bg-white/[0.06] @lg/window:p-2.5 p-2 ring-1 ring-white/[0.09]">
			<p className="min-h-[3em] min-w-0 flex-1 @lg/window:text-[12.5px] text-[10.5px] leading-[1.5]">
				{typing ? (
					<TypedText key={typing.text} {...typing} />
				) : (
					<span className="text-white/35">{placeholder}</span>
				)}
			</p>
			<span
				className={cn(
					"grid @lg/window:size-7 size-6 shrink-0 place-items-center rounded-lg transition-colors duration-300",
					typing ? "bg-spark text-night" : "bg-white/[0.08] text-white/40",
				)}
			>
				<ArrowUp className="size-3.5" strokeWidth={2.6} />
			</span>
		</div>
	);
}

/** Types `text` one letter at a time over `durationMs`, with a spark caret. */
function TypedText({ text, durationMs }: Typing) {
	const [count, setCount] = useState(0);

	useEffect(() => {
		if (count >= text.length) return;
		const timer = window.setTimeout(
			() => setCount(count + 1),
			durationMs / text.length,
		);
		return () => window.clearTimeout(timer);
	}, [count, text, durationMs]);

	return (
		<>
			{text.slice(0, count)}
			<span className="ms-px inline-block h-[1.15em] w-[1.5px] translate-y-[0.2em] bg-spark motion-safe:animate-pulse" />
		</>
	);
}

/** A device switch on top of the preview, like the real builder. Wide windows only. */
function PreviewToolbar() {
	return (
		<div className="absolute inset-x-0 top-3 z-10 @lg/window:flex hidden justify-center">
			<span className="flex items-center gap-0.5 rounded-full bg-white/[0.05] p-[3px] ring-1 ring-white/[0.08]">
				<span className="grid size-6 place-items-center rounded-full bg-white/[0.12] text-white">
					<Smartphone className="size-3.5" strokeWidth={2} />
				</span>
				<span className="grid size-6 place-items-center rounded-full text-white/40">
					<Monitor className="size-3.5" strokeWidth={2} />
				</span>
			</span>
		</div>
	);
}

type PreviewPhoneProps = {
	screen: PhoneScreen;
	/** Language of the barber app. It follows the page locale. */
	language: Locale;
	/** True after the edit in step 2: the book button turns gold. */
	isGold: boolean;
};

/** The phone inside the preview area, sized to fit the area in both directions. */
function PreviewPhone({ screen, language, isGold }: PreviewPhoneProps) {
	return (
		// 2.087 is the height-to-width ratio of the phone frame, so 39cqh keeps it inside the area.
		<DeviceFrame platform="mobile" className="w-[min(64cqw,39cqh)]">
			<FitScreen width={PHONE_SCREEN.width} height={PHONE_SCREEN.height}>
				<div className="grid">
					<AnimatePresence>
						<motion.div
							key={screen}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.35 }}
							className="[grid-area:1/1]"
						>
							{screen === "blank" ? <BlankScreen /> : null}
							{screen === "skeleton" ? (
								<MiniApp id="barber" language={language} skeleton />
							) : null}
							{screen === "build" ? (
								<WandSweep
									runKey="build"
									holdMs={BUILD_HOLD_MS}
									skeleton={
										<MiniApp id="barber" language={language} skeleton />
									}
								>
									<MiniApp id="barber" language={language} />
								</WandSweep>
							) : null}
							{screen === "app" ? (
								<MiniApp
									id="barber"
									language={language}
									bookAccent={isGold ? "gold" : "default"}
								/>
							) : null}
						</motion.div>
					</AnimatePresence>
				</div>
			</FitScreen>
		</DeviceFrame>
	);
}

/** The phone before the prompt is sent: a dark screen with a slow Wandit spark. */
function BlankScreen() {
	return (
		<div
			className="grid place-items-center bg-[#0b0b0e]"
			style={{ width: PHONE_SCREEN.width, height: PHONE_SCREEN.height }}
		>
			<Spark className="size-16 text-spark/80 motion-safe:animate-pulse" />
		</div>
	);
}

type ScanCardProps = {
	/** "Open on your phone", from landing.howItWorks.demo.scanTitle. */
	title: string;
	/** True while the story waits for the phone: a spark line scans the code. */
	isScanning: boolean;
};

/** The Expo Go card with the QR code. Its width comes from the parent. */
function ScanCard({ title, isScanning }: ScanCardProps) {
	return (
		<div className="flex flex-col items-center gap-[0.7em] rounded-[1.1em] bg-white p-[0.9em] @lg/window:text-[12.5px] text-[10px] text-night shadow-[0_24px_50px_-20px_rgba(0,0,0,0.65)]">
			<div className="relative w-full">
				<svg
					aria-hidden="true"
					viewBox="-1 -1 23 23"
					className="block aspect-square w-full"
				>
					<path d={QR_PATH} fill="currentColor" />
				</svg>
				{/* The Wandit mark in the middle of the code, like a branded QR code. 22% covers the 5 x 5 middle modules. */}
				<span className="absolute inset-0 grid place-items-center">
					<span className="grid size-[22%] place-items-center rounded-[22%] bg-white">
						<Spark className="size-[78%] text-ember" />
					</span>
				</span>
				{isScanning ? (
					// The wrapper has the height of the code, so a move of 100% takes the line from top to bottom.
					<motion.span
						className="absolute inset-x-[-4%] top-0 h-full"
						animate={{ y: ["0%", "100%", "0%"] }}
						transition={{
							duration: 1.6,
							ease: "easeInOut",
							repeat: Number.POSITIVE_INFINITY,
						}}
					>
						<span className="block h-[2px] rounded-full bg-spark shadow-[0_0_12px_2px_color-mix(in_oklab,var(--color-spark)_70%,transparent)]" />
					</motion.span>
				) : null}
			</div>
			<p className="text-balance text-center font-semibold leading-tight">
				{title}
			</p>
			<span className="flex items-center gap-1 rounded-full bg-night/[0.06] px-[0.8em] py-[0.3em] font-medium text-[0.85em] text-night/70">
				<Smartphone className="size-[1.1em]" strokeWidth={2.2} />
				Expo Go
			</span>
		</div>
	);
}

type PublishPopoverProps = {
	/** landing.howItWorks.demo: publish, published and android labels. */
	labels: { publish: string; published: string; android: string };
	/** Beat 1 of step 3: the publish button is down and spins. */
	isPressed: boolean;
	/** Beat 2 of step 3: the address is live and the Android build is ready. */
	isLive: boolean;
	/** The live dot pulses only on screen and without reduced motion. */
	isPulsing: boolean;
};

/** The publish popover that hangs from the top bar button in step 3. */
function PublishPopover({
	labels,
	isPressed,
	isLive,
	isPulsing,
}: PublishPopoverProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: -10, scale: 0.96 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			exit={{ opacity: 0, y: -10, scale: 0.96 }}
			transition={ENTER_SPRING}
			className="absolute @lg/window:end-3 end-2 @lg/window:top-[3.6rem] top-[3.1rem] z-20 @lg/window:w-[19.5rem] w-[min(15.5rem,calc(100%-1rem))] origin-top-right rounded-2xl bg-[#161c4b] @lg/window:p-2.5 p-2 @lg/window:text-[12.5px] text-[10.5px] shadow-[0_30px_60px_-16px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/[0.12] rtl:origin-top-left"
		>
			<div className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] @lg/window:p-2.5 p-2 ring-1 ring-white/[0.07]">
				<span className="grid size-[2.4em] shrink-0 place-items-center rounded-lg bg-white/[0.08]">
					<Globe className="size-[1.3em] text-white/80" strokeWidth={2} />
				</span>
				{/* The badge sits at the end of the address, or wraps below it when the popover is narrow. */}
				<span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1">
					<span
						dir="ltr"
						className={cn(
							"font-medium transition-colors duration-500",
							isLive ? "text-white" : "text-white/45",
						)}
					>
						{APP_URL}
					</span>
					<AnimatePresence>
						{isLive ? (
							<motion.span
								key="live"
								initial={{ opacity: 0, scale: 0.6 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ type: "spring", bounce: 0.45, duration: 0.5 }}
								className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#2fd27a]/12 px-2 py-0.5 font-semibold text-[#5be39a]"
							>
								<LiveDot isPulsing={isPulsing} />
								{labels.published}
							</motion.span>
						) : null}
					</AnimatePresence>
				</span>
			</div>

			{/* The row keeps its space before the build is ready, so the popover does not jump. */}
			<motion.div
				initial={false}
				animate={{ opacity: isLive ? 1 : 0, y: isLive ? 0 : 4 }}
				transition={{ duration: 0.35, ease: "easeOut" }}
				className="mt-1.5 flex items-center gap-2.5 rounded-xl @lg/window:px-2.5 px-2 py-1.5"
			>
				<span className="grid size-[2.4em] shrink-0 place-items-center rounded-lg bg-white/[0.08]">
					<Smartphone className="size-[1.3em] text-white/80" strokeWidth={2} />
				</span>
				<span className="min-w-0 flex-1 text-white/80">{labels.android}</span>
				<span className="grid size-[1.5em] shrink-0 place-items-center rounded-full bg-spark text-night">
					<Check className="size-[0.95em]" strokeWidth={3.5} />
				</span>
			</motion.div>

			<span
				className={cn(
					"mt-2 flex h-[2.9em] items-center justify-center gap-1.5 rounded-xl bg-spark font-semibold text-night transition-[translate,box-shadow] duration-150",
					isPressed
						? "translate-y-[3px] shadow-none"
						: "shadow-[0_3px_0_var(--color-spark-deep)]",
				)}
			>
				{isPressed ? (
					<LoaderCircle
						className="size-[1.2em] motion-safe:animate-spin"
						strokeWidth={2.6}
					/>
				) : null}
				{isLive ? <Check className="size-[1.2em]" strokeWidth={3} /> : null}
				{labels.publish}
			</span>
		</motion.div>
	);
}

/** A green dot with a soft ring that grows and fades, the sign of a live address. */
function LiveDot({ isPulsing }: { isPulsing: boolean }) {
	return (
		<span className="relative grid size-[0.6em] place-items-center">
			{isPulsing ? (
				<span className="absolute inset-0 animate-ping rounded-full bg-[#2fd27a]/55" />
			) : null}
			<span className="relative size-full rounded-full bg-[#2fd27a]" />
		</span>
	);
}

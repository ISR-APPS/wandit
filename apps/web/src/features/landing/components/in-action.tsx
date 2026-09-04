import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import { cn } from "@wandit/ui/lib/utils";
import {
	ArrowUp,
	Check,
	Compass,
	Globe,
	Image as ImageIcon,
	Plus,
} from "lucide-react";
import {
	AnimatePresence,
	motion,
	useInView,
	useReducedMotion,
	type Variants,
} from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";

/** How long each step of the showcase plays before auto-advancing. */
const STEP_MS = 5600;

const ARTIFACT_ICONS = [Globe, ImageIcon, Compass];

const URLS = ["wandit.app", "aures-honey.wandit.app"];

const scene: Variants = {
	hidden: { opacity: 0, y: 14 },
	show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
	exit: { opacity: 0, y: -10, transition: { duration: 0.25, ease: "easeIn" } },
};

/** Types the given text one glyph at a time (instant when motion is reduced). */
function useTypewriter(text: string, play: boolean) {
	const reduced = useReducedMotion();
	const glyphs = useMemo(() => Array.from(text), [text]);
	const [count, setCount] = useState(0);

	useEffect(() => {
		if (!play) return;
		if (reduced) {
			setCount(glyphs.length);
			return;
		}
		setCount(0);
		const id = setInterval(() => {
			setCount((current) => {
				if (current >= glyphs.length) {
					clearInterval(id);
					return current;
				}
				return current + 1;
			});
		}, 26);
		return () => clearInterval(id);
	}, [glyphs, play, reduced]);

	return {
		typed: glyphs.slice(0, count).join(""),
		done: count >= glyphs.length,
	};
}

function SceneDescribe({
	prompt,
	play,
	onAdvance,
}: {
	prompt: string;
	play: boolean;
	onAdvance: () => void;
}) {
	const { typed, done } = useTypewriter(prompt, play);
	const [pressed, setPressed] = useState(false);

	// Replay the full type -> glow -> press sequence on re-entry.
	useEffect(() => {
		if (!done || !play) setPressed(false);
	}, [done, play]);

	// Story beat: finish typing, press send, then the build scene answers.
	useEffect(() => {
		if (!done || !play) return;
		const press = setTimeout(() => setPressed(true), 650);
		const advance = setTimeout(onAdvance, 1150);
		return () => {
			clearTimeout(press);
			clearTimeout(advance);
		};
	}, [done, play, onAdvance]);

	return (
		<motion.div
			variants={scene}
			initial="hidden"
			animate="show"
			exit="exit"
			className="absolute inset-0 flex items-center justify-center p-5 md:p-8"
		>
			{/* Faint stage floor so the scene reads as a designed canvas */}
			<div aria-hidden className="absolute inset-0 bg-dots" />
			{/* Ghost of the site to come — the send press "develops" it */}
			<div
				aria-hidden
				className="absolute inset-x-12 inset-y-8 flex flex-col rounded-xl border border-foreground/5 p-3 md:inset-x-20"
			>
				<span className="h-1.5 w-10 rounded-full bg-foreground/5" />
				<span className="mt-2.5 h-12 rounded-lg bg-foreground/5" />
				<span className="mt-2.5 h-1.5 w-3/4 rounded-full bg-foreground/5" />
				<span className="mt-1.5 h-1.5 w-1/2 rounded-full bg-foreground/5" />
			</div>
			<div className="relative w-full max-w-md rounded-2xl border border-border bg-background p-4 shadow-composer">
				<p className="min-h-16 text-start text-foreground/90 text-sm leading-relaxed">
					{typed}
					<span
						aria-hidden
						className="ms-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 bg-primary motion-safe:animate-caret"
					/>
				</p>
				<div className="mt-3 flex items-center justify-between">
					<span className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground">
						<Plus className="size-4" />
					</span>
					<motion.span
						animate={pressed ? { scale: [1, 0.85, 1] } : { scale: 1 }}
						transition={{ duration: 0.28, ease: "easeInOut" }}
						className={cn(
							"flex size-8 items-center justify-center rounded-full bg-gradient-ember text-primary-foreground",
							done && !pressed && "motion-safe:animate-glow-ember",
						)}
					>
						<ArrowUp className="size-4" />
					</motion.span>
				</div>
			</div>
		</motion.div>
	);
}

function SceneBuild({ artifacts }: { artifacts: string[] }) {
	const isRtl =
		typeof document !== "undefined" && document.documentElement.dir === "rtl";

	return (
		<motion.div
			variants={scene}
			initial="hidden"
			animate="show"
			exit="exit"
			className="absolute inset-0 grid grid-cols-[1fr_1.1fr] gap-3 p-5 md:grid-cols-[1.5fr_1fr] md:gap-4 md:p-6"
		>
			{/* The page assembling itself */}
			<motion.div
				initial="hidden"
				animate="show"
				variants={{
					hidden: {},
					show: { transition: { staggerChildren: 0.22, delayChildren: 0.25 } },
				}}
				className="flex flex-col overflow-hidden rounded-xl border border-border bg-background"
			>
				<motion.div
					variants={scene}
					className="flex h-7 shrink-0 items-center gap-1.5 border-border border-b px-2.5"
				>
					<span className="size-1.5 rounded-full bg-primary" />
					<span className="ms-auto h-1.5 w-6 rounded-full bg-muted" />
					<span className="h-1.5 w-6 rounded-full bg-muted" />
					<span className="h-1.5 w-6 rounded-full bg-muted" />
				</motion.div>
				<motion.div
					variants={scene}
					className="relative mx-2.5 mt-2.5 h-16 overflow-hidden rounded-lg bg-gradient-ember-deep md:h-24"
				>
					<span
						aria-hidden
						className="absolute inset-0 bg-[length:200%_100%] bg-[linear-gradient(110deg,transparent_35%,rgba(255,255,255,0.35),transparent_65%)] motion-safe:animate-shimmer"
					/>
				</motion.div>
				<motion.span
					variants={scene}
					className="mx-2.5 mt-3 h-2 w-3/4 rounded-full bg-muted"
				/>
				<motion.span
					variants={scene}
					className="mx-2.5 mt-2 h-2 w-1/2 rounded-full bg-muted"
				/>
				<motion.span
					variants={scene}
					className="mx-2.5 mt-3 flex h-6 w-20 items-center justify-center rounded-full bg-primary"
				/>
				<motion.div
					variants={scene}
					className="mx-2.5 mt-3 mb-2.5 grid min-h-0 flex-1 grid-cols-3 gap-1.5"
				>
					<span className="rounded-md bg-gradient-ember-deep opacity-80" />
					<span className="rounded-md bg-bubble" />
					<span className="rounded-md bg-muted" />
				</motion.div>
			</motion.div>

			{/* Everything else the AI produces alongside the page */}
			<div className="flex flex-col justify-center gap-2">
				{artifacts.map((artifact, index) => {
					const Icon = ARTIFACT_ICONS[index % ARTIFACT_ICONS.length];
					return (
						<motion.div
							key={artifact}
							initial={{ opacity: 0, x: isRtl ? -12 : 12 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: 0.5 + index * 0.35, duration: 0.4 }}
							className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2"
						>
							<Icon className="size-3.5 shrink-0 text-muted-foreground" />
							<span className="truncate font-medium text-[11px] max-md:whitespace-normal">
								{artifact}
							</span>
							<motion.span
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								transition={{
									delay: 1.1 + index * 0.35,
									type: "spring",
									stiffness: 400,
									damping: 20,
								}}
								className="ms-auto flex size-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-success-text"
							>
								<Check className="size-2.5" />
							</motion.span>
						</motion.div>
					);
				})}
			</div>
		</motion.div>
	);
}

function SceneLaunch({
	campaignsLabel,
	liveLabel,
	publishedToast,
	events,
}: {
	campaignsLabel: string;
	liveLabel: string;
	publishedToast: string;
	events: string[];
}) {
	return (
		<motion.div
			variants={scene}
			initial="hidden"
			animate="show"
			exit="exit"
			className="absolute inset-0 flex flex-col gap-2.5 p-5 md:gap-3 md:p-6"
		>
			<div className="flex items-center gap-2.5">
				<span className="font-medium text-xs">{campaignsLabel}</span>
				<span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-success-text uppercase tracking-[0.08em] rtl:tracking-normal">
					<span className="size-1.5 rounded-full bg-success motion-safe:animate-pulse-soft" />
					{liveLabel}
				</span>
				<motion.span
					initial={{ opacity: 0, y: -8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.5, duration: 0.4 }}
					className="ms-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px]"
				>
					<span className="flex size-3.5 items-center justify-center rounded-full bg-success/15 text-success-text">
						<Check className="size-2" />
					</span>
					{publishedToast}
				</motion.span>
			</div>

			{/* The chart keeps LTR reading order in every locale */}
			<div
				dir="ltr"
				className="relative min-h-0 flex-1 rounded-xl border border-border bg-background p-3"
			>
				<div className="relative size-full">
					<svg
						viewBox="0 0 300 96"
						preserveAspectRatio="none"
						className="absolute inset-0 size-full"
						role="presentation"
						aria-hidden
					>
						{[24, 48, 72].map((y) => (
							<line
								key={y}
								x1="0"
								y1={y}
								x2="300"
								y2={y}
								className="stroke-border"
								strokeWidth="1"
								strokeDasharray="3 5"
								vectorEffect="non-scaling-stroke"
							/>
						))}
					</svg>
					{/* The finished line revealed by a left-to-right wipe — a
					   pathLength draw cannot compose with non-scaling-stroke on a
					   stretched viewBox (the dash calibration breaks in Chromium) */}
					<motion.div
						aria-hidden
						initial={{ clipPath: "inset(0 100% 0 0)" }}
						animate={{ clipPath: "inset(0 0% 0 0)" }}
						transition={{ duration: 1.6, ease: "easeOut", delay: 0.3 }}
						className="absolute inset-0"
					>
						<svg
							viewBox="0 0 300 96"
							preserveAspectRatio="none"
							className="size-full"
							role="presentation"
						>
							<path
								d="M0,86 C36,82 58,66 88,60 C118,54 138,62 168,46 C198,30 228,36 258,18 L300,9"
								fill="none"
								className="stroke-primary"
								strokeWidth="2.5"
								strokeLinecap="round"
								vectorEffect="non-scaling-stroke"
							/>
						</svg>
					</motion.div>
					{/* Endpoint dot as HTML so the stretched viewBox cannot squash it */}
					<motion.span
						aria-hidden
						initial={{ scale: 0, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						transition={{ delay: 1.9, type: "spring", stiffness: 300 }}
						className="absolute top-[9%] -right-1 size-2 -translate-y-1/2 rounded-full bg-primary"
					/>
				</div>
			</div>

			<div className="flex flex-col gap-1.5">
				{events.map((event, index) => (
					<motion.div
						key={event}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.8 + index * 0.45, duration: 0.4 }}
						className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-[11px]"
					>
						<span
							className={cn(
								"size-1.5 rounded-full",
								index === 0 ? "bg-success" : "bg-primary/70",
							)}
						/>
						{event}
					</motion.div>
				))}
			</div>
		</motion.div>
	);
}

export function InAction() {
	const { t } = useTranslation();
	const howItWorks = useDictionary().landing.howItWorks;
	const reduced = useReducedMotion();

	const stageRef = useRef<HTMLDivElement>(null);
	const inView = useInView(stageRef, { amount: 0.35 });
	const [active, setActive] = useState(0);

	const stepCount = howItWorks.steps.length;
	const advance = useCallback(
		() => setActive((step) => (step + 1) % stepCount),
		[stepCount],
	);
	// The describe scene advances itself right after its send beat. Idempotent
	// (only ever moves 0 -> 1) so a stale timer firing during the exit
	// animation cannot double-advance past the build scene.
	const advanceFromScene = useCallback(() => {
		if (!reduced) setActive((step) => (step === 0 ? 1 : step));
	}, [reduced]);

	const activeUrl = active === 0 ? URLS[0] : URLS[1];

	return (
		<section
			id="how-it-works"
			className="scroll-mt-20 overflow-x-clip px-4 pt-12 pb-20 md:pt-16 md:pb-28"
		>
			<div className="mx-auto max-w-6xl">
				<SectionHeader
					align="start"
					kicker={t("landing.howItWorks.kicker")}
					title={t("landing.howItWorks.title")}
				/>

				<div
					ref={stageRef}
					className="grid items-center gap-8 md:grid-cols-[1.08fr_0.92fr] md:gap-14"
				>
					{/* Steps first in the DOM so readers get context before the demo;
					   the window still leads visually on desktop via md:order-first */}
					<Reveal delay={0.1}>
						<ol className="flex flex-col gap-6 md:gap-9">
							{howItWorks.steps.map((step, index) => {
								const isActive = index === active;
								return (
									<li key={step.title}>
										<button
											type="button"
											onClick={() => setActive(index)}
											aria-current={isActive ? "step" : undefined}
											className="group w-full cursor-pointer text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
										>
											<h3
												className={cn(
													"font-display font-semibold text-xl tracking-[-0.01em] transition-colors duration-300 md:text-2xl rtl:tracking-normal",
													isActive
														? "text-foreground"
														: "text-muted-foreground group-hover:text-foreground/80",
												)}
											>
												{step.title}
											</h3>
											<p
												className={cn(
													"mt-1.5 max-w-md text-pretty text-muted-foreground text-sm leading-relaxed md:text-base",
													!isActive && "max-md:hidden",
												)}
											>
												{step.body}
											</p>
											<span className="mt-3.5 block h-0.5 overflow-hidden rounded-full bg-border transition-colors group-hover:bg-stone">
												{isActive && inView && !reduced ? (
													// The rail is the showcase clock: when its fill
													// completes, the next scene starts. The describe
													// scene may cut in earlier via its send beat.
													<motion.span
														key={`progress-${active}`}
														initial={{ scaleX: 0 }}
														animate={{ scaleX: 1 }}
														transition={{
															duration: STEP_MS / 1000,
															ease: "linear",
														}}
														onAnimationComplete={(definition) => {
															if (
																(definition as { scaleX?: number }).scaleX === 1
															) {
																advance();
															}
														}}
														className="block h-full origin-left bg-gradient-ember rtl:origin-right"
													/>
												) : null}
											</span>
										</button>
									</li>
								);
							})}
						</ol>
					</Reveal>

					<Reveal className="relative md:order-first">
						{/* Ember halo behind the demo window */}
						<div
							aria-hidden
							className="absolute -inset-4 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--color-primary)_12%,transparent),transparent_70%)] md:-inset-8"
						/>
						<div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-card">
							<div className="flex items-center gap-1.5 border-border border-b bg-sand/60 px-4 py-2.5">
								<span className="size-2.5 rounded-full bg-stone" />
								<span className="size-2.5 rounded-full bg-stone" />
								<span className="size-2.5 rounded-full bg-stone" />
								{/* Both URLs share one grid cell: the pill keeps the width
								   of the longest and only opacity moves on scene change */}
								<span
									dir="ltr"
									className="mx-auto grid rounded-full border border-border bg-background px-3 py-0.5 font-mono text-[10px] text-muted-foreground"
								>
									{URLS.map((url) => (
										<motion.span
											key={url}
											animate={{ opacity: url === activeUrl ? 1 : 0 }}
											transition={{ duration: 0.3 }}
											className="col-start-1 row-start-1 text-center"
										>
											{url}
										</motion.span>
									))}
								</span>
								<span aria-hidden className="w-[42px]" />
							</div>
							<div className="relative aspect-[4/3] sm:aspect-[16/10]">
								<AnimatePresence mode="wait" initial={false}>
									{active === 0 ? (
										<SceneDescribe
											key="describe"
											prompt={howItWorks.demo.prompt}
											play={inView}
											onAdvance={advanceFromScene}
										/>
									) : active === 1 ? (
										<SceneBuild
											key="build"
											artifacts={howItWorks.demo.artifacts}
										/>
									) : (
										<SceneLaunch
											key="launch"
											campaignsLabel={howItWorks.demo.campaignsLabel}
											liveLabel={howItWorks.demo.liveLabel}
											publishedToast={howItWorks.demo.publishedToast}
											events={howItWorks.demo.events}
										/>
									)}
								</AnimatePresence>
							</div>
						</div>
					</Reveal>
				</div>
			</div>
		</section>
	);
}

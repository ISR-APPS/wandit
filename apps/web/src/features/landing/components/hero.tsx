/**
 * The hero panel of the landing page (id "hero"). pages/landing-page.tsx
 * renders it. The giant sentence "Build me a [mobile app]" flows into a
 * prompt box, where an idle loop types app ideas. The device next to it
 * morphs and builds each app with the wand sweep and a build log.
 * The visitor writes their own idea; useLandingCreate starts the project.
 */

import { projectPromptMaxLength, type TargetPlatform } from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";
import { AnimatePresence, useInView, useReducedMotion } from "motion/react";
import {
	type FormEvent,
	useEffect,
	useEffectEvent,
	useRef,
	useState,
} from "react";

import { Spark } from "@/components/logo";
import { useSession } from "@/features/auth";
import { InsufficientCreditsDialog, useOutOfCredits } from "@/features/credits";
import { useDictionary, useTranslation } from "@/lib/i18n";

import { HERO_IDEA_IDS, type HeroIdeaId } from "../lib/constants";
import { HERO_PANEL_ID } from "../lib/scroll";
import { useLandingCreate } from "../lib/use-landing-create";
import { BuildLog, LOG_STEP_MS } from "./build-log";
import { DeviceFrame } from "./device-frame";
import { FitScreen } from "./fit-screen";
import { HeroSentence } from "./hero-sentence";
import { MINI_APP_PLATFORM, MINI_APP_SIZE, MiniApp } from "./mini-apps";
import { WandSweep } from "./wand-sweep";

/** An idea the ideas wall puts into the hero prompt box. */
export type HeroPrefill = {
	/** Increments on each use, so the same idea twice still applies. */
	key: number;
	platform: TargetPlatform;
	/** The rest of the sentence after the platform word. */
	text: string;
};

type HeroProps = {
	/** The last idea picked on the ideas wall, or null before any pick. */
	prefill: HeroPrefill | null;
};

/** Typing speed of the idle loop, in ms per character. */
const CHAR_MS = 28;
/** Pause before the first letter, in ms, so the device morph settles first. */
const PRE_TYPE_MS = 450;
/** Time a built app stays on screen before the loop erases its idea, in ms. */
const BUILT_HOLD_MS = 3000;
/** Time the idea shows as selected before it clears, in ms. */
const SELECTED_MS = 420;
/** Log delay of a build that the visitor starts (token or ideas wall), in ms. It lets the morph finish. */
const MANUAL_LOG_DELAY_MS = 550;

/** Address in the browser bar of each web app. Mobile apps have no bar. */
const WEB_APP_URL = {
	barber: undefined,
	invoices: "ledgerly.wandit.app",
	running: undefined,
	yoga: "studiosol.wandit.app",
} as const satisfies Record<HeroIdeaId, string | undefined>;

/**
 * Place of the build log card on the device corner. It hangs off the bottom
 * start corner; on the phone it overlaps less, so the built app stays visible.
 */
const LOG_POSITION_CLASS = {
	mobile: "-start-8 -bottom-8 sm:-start-24 lg:-start-32 lg:bottom-10",
	web: "start-3 -bottom-20 sm:-start-6 lg:-bottom-24",
} as const satisfies Record<TargetPlatform, string>;

/** One step of the idle loop. "building" also covers the hold after the sweep. */
type LoopStep = "typing" | "building" | "erasing";

/** The app on the stage and its current build run. */
type StageBuild = {
	/** Increments on each build, so WandSweep and BuildLog replay from the start. */
	runKey: number;
	stageId: HeroIdeaId;
	/** Time from the start of the run to the first log step, in ms. */
	logDelayMs: number;
	/** True when WandSweep reports the end of the sweep. */
	isBuilt: boolean;
	/**
	 * True after an ideas wall pick that has no mini app. The stage then shows
	 * a built app of that platform, with no sweep and no build log.
	 */
	isStandIn: boolean;
};

/** The next hero app after `fromId`, in loop order, that has `platform`. */
function nextStageFor(platform: TargetPlatform, fromId: HeroIdeaId) {
	const start = HERO_IDEA_IDS.indexOf(fromId);
	for (let offset = 1; offset <= HERO_IDEA_IDS.length; offset += 1) {
		const id = HERO_IDEA_IDS[(start + offset) % HERO_IDEA_IDS.length];
		if (id && MINI_APP_PLATFORM[id] === platform) return id;
	}
	return fromId;
}

/** The hero panel: the sentence, the prompt box, and the stage. Section id "hero" also drives the nav colors. */
export function Hero({ prefill }: HeroProps) {
	const landing = useDictionary().landing;
	const { hero, ideas } = landing;
	const { locale } = useTranslation();
	const { data: session } = useSession();
	// Signed-out visitors are never locked here: their submit goes through
	// sign-in, not a credit debit.
	const { outOfCredits } = useOutOfCredits();
	const promptLocked = Boolean(session?.user) && outOfCredits;
	const sectionRef = useRef<HTMLElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	// The submit lock. isCreating turns false before create() ends its navigation,
	// and a second POST then makes a twin project and holds credits twice.
	const submitInFlightRef = useRef(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	// The loops run only while a quarter of the panel is on screen, to save CPU.
	const isInView = useInView(sectionRef, { amount: 0.25 });
	const reduceMotion = useReducedMotion() ?? false;

	const [build, setBuild] = useState<StageBuild>({
		runKey: 0,
		stageId: HERO_IDEA_IDS[0],
		logDelayMs: MANUAL_LOG_DELAY_MS,
		isBuilt: false,
		isStandIn: false,
	});
	const [step, setStep] = useState<LoopStep>("typing");
	const [typedCount, setTypedCount] = useState(0);
	const [value, setValue] = useState("");
	// True after the visitor focuses the box, flips the token or picks an idea.
	// The idle loop then stops for good, so it never overwrites their choice.
	const [isTakenOver, setIsTakenOver] = useState(false);

	const platform = MINI_APP_PLATFORM[build.stageId];
	const ideaText = ideas.items[build.stageId].text;
	const isLooping = !isTakenOver && !reduceMotion && isInView;
	const { create, isCreating, insufficientOpen, setInsufficientOpen } =
		useLandingCreate(platform);

	// The full prompt must fit the server limit with the longer platform word.
	const promptPrefixLength = Math.max(
		`${hero.leadStart} ${hero.platforms.mobile} `.length,
		`${hero.leadStart} ${hero.platforms.web} `.length,
	);
	const maxLength = projectPromptMaxLength - promptPrefixLength;

	function startBuild(stageId: HeroIdeaId, logDelayMs: number) {
		setBuild((current) => ({
			runKey: current.runKey + 1,
			stageId,
			logDelayMs,
			isBuilt: false,
			isStandIn: false,
		}));
	}

	function startIdea(stageId: HeroIdeaId) {
		startBuild(
			stageId,
			PRE_TYPE_MS + ideas.items[stageId].text.length * CHAR_MS,
		);
		setTypedCount(0);
		setStep("typing");
	}

	// The loop restarts the current idea each time it resumes, for example
	// when the hero scrolls back into view.
	const restartIdea = useEffectEvent(() => startIdea(build.stageId));
	useEffect(() => {
		if (isLooping) restartIdea();
	}, [isLooping]);

	// Typing: one more letter every CHAR_MS after a short pause.
	useEffect(() => {
		if (!isLooping || step !== "typing") return;
		const startedAt = performance.now() + PRE_TYPE_MS;
		const timer = window.setInterval(() => {
			const count = Math.floor((performance.now() - startedAt) / CHAR_MS);
			if (count >= ideaText.length) {
				setTypedCount(ideaText.length);
				setStep("building");
			} else {
				setTypedCount(Math.max(count, 0));
			}
		}, CHAR_MS);
		return () => window.clearInterval(timer);
	}, [isLooping, step, ideaText]);

	// After the sweep, hold the built app, select the idea, then go to the next one.
	const nextIdea = useEffectEvent(() => {
		const index = HERO_IDEA_IDS.indexOf(build.stageId);
		startIdea(
			HERO_IDEA_IDS[(index + 1) % HERO_IDEA_IDS.length] ?? build.stageId,
		);
	});
	useEffect(() => {
		if (!isLooping) return;
		if (step === "building" && build.isBuilt) {
			const timer = window.setTimeout(() => setStep("erasing"), BUILT_HOLD_MS);
			return () => window.clearTimeout(timer);
		}
		if (step === "erasing") {
			const timer = window.setTimeout(nextIdea, SELECTED_MS);
			return () => window.clearTimeout(timer);
		}
	}, [isLooping, step, build.isBuilt]);

	// The ideas wall fills the box and sets the platform token and the stage.
	const applyPrefill = useEffectEvent((next: HeroPrefill) => {
		setIsTakenOver(true);
		setValue(next.text.slice(0, maxLength));
		const heroId = HERO_IDEA_IDS.find(
			(id) => ideas.items[id].text === next.text,
		);
		if (heroId) {
			startBuild(heroId, MANUAL_LOG_DELAY_MS);
		} else {
			// Another idea has no app of its own, so a replayed build and its log
			// would name a different app. The stage shows a built app of the idea platform.
			setBuild((current) => ({
				...current,
				stageId:
					MINI_APP_PLATFORM[current.stageId] === next.platform
						? current.stageId
						: nextStageFor(next.platform, current.stageId),
				isBuilt: true,
				isStandIn: true,
			}));
		}
		textareaRef.current?.focus({ preventScroll: true });
	});
	useEffect(() => {
		if (prefill) applyPrefill(prefill);
	}, [prefill]);

	function flipPlatform() {
		setIsTakenOver(true);
		const nextPlatform = platform === "mobile" ? "web" : "mobile";
		startBuild(nextStageFor(nextPlatform, build.stageId), MANUAL_LOG_DELAY_MS);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		// Enter in the box submits the form even when the button is disabled.
		if (promptLocked || isCreating || submitInFlightRef.current) return;
		submitInFlightRef.current = true;
		setIsSubmitting(true);
		// An empty box sends the idea that the placeholder shows. The cut keeps
		// a value typed under another locale prefix inside the server limit.
		const text = (value.trim() || ideaText).slice(0, maxLength);
		try {
			await create(`${hero.leadStart} ${hero.platforms[platform]} ${text}`);
		} finally {
			// A create that does not navigate away (the auth modal, a refused
			// create) ends here, so the visitor can send again.
			submitInFlightRef.current = false;
			setIsSubmitting(false);
		}
	}

	const ghost = isTakenOver
		? null
		: {
				// After the typing step the full text shows, also after a language change.
				text:
					reduceMotion || step !== "typing"
						? ideaText
						: ideaText.slice(0, typedCount),
				// Off screen the caret stops, so no endless animation runs out of view.
				isBlinking: isInView && !(isLooping && step === "typing"),
				isSelected: isLooping && step === "erasing",
			};
	const screenSize = MINI_APP_SIZE[platform];
	const showLog = !build.isStandIn && !(isLooping && step === "erasing");

	return (
		<section
			id={HERO_PANEL_ID}
			ref={sectionRef}
			className="relative m-2 overflow-hidden rounded-[2rem] bg-ember text-white md:m-3 md:rounded-[2.75rem]"
		>
			{/* The only decoration: a huge outline of the spark, one turn per minute. */}
			<div
				aria-hidden
				className="pointer-events-none absolute -end-[34rem] top-[38rem] size-[70rem] animate-spin [animation-duration:60s] motion-reduce:animate-none lg:-end-[26rem] lg:top-1/2 lg:-translate-y-1/2"
				style={{ animationPlayState: isInView ? "running" : "paused" }}
			>
				<Spark className="size-full fill-none stroke-cream/30 [stroke-width:2px] [&_path]:[vector-effect:non-scaling-stroke]" />
			</div>

			<div className="relative mx-auto grid min-h-[calc(100svh-1rem)] max-w-7xl gap-y-14 px-4 pt-28 pb-12 md:min-h-[calc(100svh-1.5rem)] md:px-8 lg:grid-cols-[minmax(0,8fr)_minmax(0,7fr)] lg:gap-x-12 lg:pb-14">
				<form onSubmit={handleSubmit} className="flex flex-col justify-center">
					<h1 className="sr-only">{landing.meta.title}</h1>
					<HeroSentence
						platform={platform}
						onFlipPlatform={flipPlatform}
						value={value}
						onValueChange={setValue}
						ghost={ghost}
						placeholder={ideaText}
						reservedTexts={HERO_IDEA_IDS.map((id) => ideas.items[id].text)}
						maxLength={maxLength}
						onFocus={() => setIsTakenOver(true)}
						textareaRef={textareaRef}
						disabled={promptLocked}
						isSubmitting={isCreating || isSubmitting}
					/>
					<p className="mt-9 max-w-xl text-lg text-night leading-relaxed md:text-xl">
						{hero.sub}
					</p>
				</form>

				<div
					role="img"
					aria-label={hero.stageLabel}
					className="relative flex h-[36rem] items-center justify-center sm:h-[42rem] lg:h-auto lg:justify-end"
				>
					{/* The box takes the size of the device, so the log card stays on its corner.
					    On desktop the phone width follows the viewport height. 2.09 is the
					    height to width ratio of the phone frame. 12rem is the panel padding and
					    margin, so the phone fits the stage and the panel fits one screen. */}
					<div
						className={cn(
							"relative",
							platform === "mobile"
								? "w-[15rem] sm:w-[17rem] lg:w-[min(20rem,calc((100svh-12rem)/2.09))] 2xl:w-[min(22rem,calc((100svh-12rem)/2.09))]"
								: "w-full max-w-[40rem]",
						)}
					>
						<DeviceFrame
							platform={platform}
							url={WEB_APP_URL[build.stageId]}
							className="w-full"
						>
							<FitScreen width={screenSize.width} height={screenSize.height}>
								{build.isStandIn ? (
									<MiniApp id={build.stageId} language={locale} />
								) : (
									<WandSweep
										runKey={build.runKey}
										// The sweep starts with the last log step, so that step ends with the sweep.
										holdMs={
											build.logDelayMs +
											(hero.log[build.stageId].length - 1) * LOG_STEP_MS
										}
										// The exiting screen of a flip still runs its old sweep. Its onDone must not mark the new run.
										onDone={() =>
											setBuild((current) =>
												current.runKey === build.runKey
													? { ...current, isBuilt: true }
													: current,
											)
										}
										skeleton={
											<MiniApp id={build.stageId} language={locale} skeleton />
										}
									>
										<MiniApp id={build.stageId} language={locale} />
									</WandSweep>
								)}
							</FitScreen>
						</DeviceFrame>

						<div className={cn("absolute z-10", LOG_POSITION_CLASS[platform])}>
							<AnimatePresence>
								{showLog ? (
									<BuildLog
										key={build.runKey}
										lines={hero.log[build.stageId]}
										platform={platform}
										// A card that mounts after the build, for example on focus during the erase step, shows at once.
										startDelayMs={build.isBuilt ? 0 : build.logDelayMs}
										isBuilt={build.isBuilt || reduceMotion}
										isStill={reduceMotion}
										scanLabel={hero.scanToOpen}
									/>
								) : null}
							</AnimatePresence>
						</div>
					</div>
				</div>
			</div>

			<InsufficientCreditsDialog
				open={insufficientOpen}
				onOpenChange={setInsufficientOpen}
			/>
		</section>
	);
}

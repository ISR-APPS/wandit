/**
 * The "How it works" section (id "how-it-works") of the landing page.
 * pages/landing-page.tsx renders it. On wide screens the four steps scroll by
 * and a sticky BuilderWindow plays the state of the active step. On small
 * screens each step shows a still BuilderWindow below its text.
 */

import { cn } from "@wandit/ui/lib/utils";
import {
	type MotionValue,
	motion,
	useMotionValueEvent,
	useScroll,
	useTransform,
} from "motion/react";
import { useId, useRef, useState, useSyncExternalStore } from "react";

import { useDictionary } from "@/lib/i18n";
import { SECTION_TITLE_CLASS } from "../lib/constants";
import { type BuilderStep, BuilderWindow } from "./builder-window";

/** Indexes of landing.howItWorks.steps, in order. */
const STEPS = [0, 1, 2, 3] as const satisfies readonly BuilderStep[];

/** The sticky story needs the two-column layout, from the Tailwind `lg` breakpoint. */
const WIDE_QUERY = "(min-width: 1024px)";

/** The scroll story from 1024 px wide. Below that, a stack of steps with one still window each. */
export function HowItWorks() {
	const { landing } = useDictionary();
	const { title, steps } = landing.howItWorks;
	const titleId = useId();
	const isWide = useIsWide();
	const listRef = useRef<HTMLOListElement>(null);
	// 0 when the top of the list crosses the middle of the viewport, 1 when its bottom does.
	const { scrollYProgress } = useScroll({
		target: listRef,
		offset: ["start center", "end center"],
	});
	const [activeStep, setActiveStep] = useState<BuilderStep>(0);
	useMotionValueEvent(scrollYProgress, "change", (progress) => {
		setActiveStep(stepAt(progress));
	});

	return (
		<section
			id="how-it-works"
			// The nav link moves the focus here. The section shows no focus ring.
			tabIndex={-1}
			aria-labelledby={titleId}
			// "clip" and not "hidden": it keeps the sticky window working.
			className="overflow-x-clip py-24 outline-none md:py-36"
		>
			<div className="mx-auto max-w-7xl px-4 md:px-8">
				<h2 id={titleId} className={cn(SECTION_TITLE_CLASS, "max-w-3xl")}>
					{title}
				</h2>

				<div className="mt-16 md:mt-20 lg:mt-8 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 xl:gap-24">
					<ol ref={listRef} className="flex flex-col gap-24 md:gap-32 lg:gap-0">
						{STEPS.map((step) => (
							<StepItem
								key={step}
								step={step}
								title={steps[step].title}
								body={steps[step].body}
								isWide={isWide}
								isActive={step === activeStep}
								progress={scrollYProgress}
							/>
						))}
					</ol>

					{isWide ? (
						<div className="relative">
							{/* Centered in the viewport (17.5rem is half the window height), and never under the 4rem nav. */}
							<div className="sticky top-[max(5.5rem,calc(50svh-17.5rem))]">
								<BuilderWindow step={activeStep} mode="story" />
							</div>
						</div>
					) : null}
				</div>
			</div>
		</section>
	);
}

type StepItemProps = {
	step: BuilderStep;
	title: string;
	body: string;
	/** Two-column story layout. False: the step shows its own still window. */
	isWide: boolean;
	/** The step that the sticky window shows. Only used in the wide layout. */
	isActive: boolean;
	/** Scroll progress through the list, 0 to 1. It fills the numeral. */
	progress: MotionValue<number>;
};

function StepItem({
	step,
	title,
	body,
	isWide,
	isActive,
	progress,
}: StepItemProps) {
	const isDimmed = isWide && !isActive;

	return (
		<li className="lg:min-h-[85svh]">
			{/* The text stays in the middle of the viewport while its step plays, then the next step pushes it out.
			    9.5rem is about half the height of the step text. */}
			<div className="lg:sticky lg:top-[calc(50svh-9.5rem)]">
				{/* Dim values keep WCAG contrast on paper: the large bold title 3.5:1, the body 4.8:1. */}
				<div
					className={cn(
						"transition-opacity duration-500 ease-out",
						isDimmed && "opacity-50",
					)}
				>
					<StepNumeral step={step} progress={isWide ? progress : null} />
					<h3 className="mt-3 text-balance font-bold text-[clamp(1.75rem,2.6vw,2.5rem)] leading-[1.05] tracking-[-0.03em] md:mt-4 rtl:leading-[1.35] rtl:tracking-normal">
						{title}
					</h3>
				</div>
				<p
					className={cn(
						"mt-4 max-w-md text-lg text-night/70 leading-relaxed transition-opacity duration-500 ease-out",
						isDimmed && "opacity-85",
					)}
				>
					{body}
				</p>
			</div>
			{isWide ? null : (
				<div className="mt-10 md:mt-12">
					<BuilderWindow step={step} mode="still" />
				</div>
			)}
		</li>
	);
}

type StepNumeralProps = {
	step: BuilderStep;
	/** Scroll progress through the list, or null to show the numeral filled. */
	progress: MotionValue<number> | null;
};

/**
 * A huge outlined numeral. In the wide layout an orange fill rises inside it
 * while its step scrolls by, so a full numeral means a step already seen.
 */
function StepNumeral({ step, progress }: StepNumeralProps) {
	const label = String(step + 1);

	return (
		<div
			aria-hidden="true"
			className="relative w-fit font-extrabold text-[clamp(5.5rem,10vw,9.5rem)] text-ember tabular-nums leading-none"
		>
			{progress ? (
				<>
					{/* The glyphs have overlapping contours. The paper fill paints over the stroke, so only the outer 2 px of it shows. */}
					<span className="text-paper [-webkit-text-stroke:4px_var(--color-ember)] [paint-order:stroke_fill]">
						{label}
					</span>
					<ScrollFill step={step} progress={progress}>
						{label}
					</ScrollFill>
				</>
			) : (
				label
			)}
		</div>
	);
}

type ScrollFillProps = {
	step: BuilderStep;
	/** Scroll progress through the list, 0 to 1. */
	progress: MotionValue<number>;
	/** The numeral, the same text as the outline under it. */
	children: string;
};

/** Each step owns a quarter of the progress. The fill rises from 0 to 1 across it. */
function ScrollFill({ step, progress, children }: ScrollFillProps) {
	const clipPath = useTransform(progress, (value) => {
		const fill = Math.min(1, Math.max(0, value * 4 - step));
		// The sides reach out by 10%, so the clip never cuts the sides of the glyph.
		return `inset(${(1 - fill) * 100}% -10% 0 -10%)`;
	});

	return (
		<motion.span
			// The same stroke as the outline, so no light seam shows at the glyph edge.
			className="absolute inset-0 text-ember [-webkit-text-stroke:4px_var(--color-ember)] [paint-order:stroke_fill]"
			style={{ clipPath }}
		>
			{children}
		</motion.span>
	);
}

/** The step whose quarter of the list holds the middle of the viewport. */
function stepAt(progress: number): BuilderStep {
	if (progress < 0.25) return 0;
	if (progress < 0.5) return 1;
	if (progress < 0.75) return 2;
	return 3;
}

function subscribeToWide(onChange: () => void) {
	const query = window.matchMedia(WIDE_QUERY);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

/** True from 1024 px wide. Only one layout mounts, so the hidden one costs nothing. */
function useIsWide() {
	return useSyncExternalStore(
		subscribeToWide,
		() => window.matchMedia(WIDE_QUERY).matches,
	);
}

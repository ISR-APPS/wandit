/**
 * The line drawing of an app screen on the preview boot screen. It draws
 * itself in ember while the cloud machine starts, turns to warm hairlines
 * with two ember accents when the machine is ready, and dims while the
 * app sleeps. Rendered by preview-boot-screen.tsx. Inline SVG, CSS
 * keyframes from globals.css, and one motion fade.
 */

import { cn } from "@wandit/ui/lib/utils";
import { motion } from "motion/react";
import { useId, useState } from "react";

import { BOOT_EASE } from "../../lib/constants";

/**
 * `draft`: the machine starts. `inked`: the machine is ready and the app loads.
 * `asleep`: no sandbox runs, or the project waits for its first version.
 */
export type PlanStage = "draft" | "inked" | "asleep";

/** What a part of the drawing is. The stage colors each role in its own way. */
type PartRole = "frame" | "plain" | "cta" | "image" | "orb";

type PlanPart = {
	/** SVG path data in viewBox units. */
	d: string;
	/** Stroke width in viewBox units. */
	width: number;
	role: PartRole;
};

type Plan = {
	viewBox: string;
	/** The rounded outline of the screen. The comet runs around it. */
	frame: string;
	/** The parts in draw order: header, text bars, buttons, picture, cards. */
	parts: PlanPart[];
	/** The four crop marks at the corners. They do not mirror in RTL. */
	marks: string[];
	/** Center of the picture circle, which becomes the ember "sun". */
	orb: { cx: number; cy: number };
	/** Center of the logo dot, which glows while the app sleeps. */
	led: { cx: number; cy: number };
};

// A desktop page: header, headline, two buttons, a picture, three cards.
const WIDE_PLAN: Plan = {
	viewBox: "-12 -12 344 224",
	frame:
		"M12.5 0.5H307.5A12 12 0 0 1 319.5 12.5V187.5A12 12 0 0 1 307.5 199.5H12.5A12 12 0 0 1 0.5 187.5V12.5A12 12 0 0 1 12.5 0.5Z",
	parts: [
		{ d: "M0.5 30H319.5", width: 1.4, role: "plain" },
		{ d: "M18 10A5 5 0 1 1 18 20A5 5 0 1 1 18 10Z", width: 0.8, role: "plain" },
		{ d: "M29 15H56", width: 2.2, role: "plain" },
		{ d: "M200 15H216", width: 1.4, role: "plain" },
		{ d: "M226 15H242", width: 1.4, role: "plain" },
		{
			d: "M263 8H297A7 7 0 0 1 297 22H263A7 7 0 0 1 263 8Z",
			width: 0.8,
			role: "cta",
		},
		{
			d: "M27.5 50H148.5A5.5 5.5 0 0 1 148.5 61H27.5A5.5 5.5 0 0 1 27.5 50Z",
			width: 0.8,
			role: "plain",
		},
		{
			d: "M27.5 66H114.5A5.5 5.5 0 0 1 114.5 77H27.5A5.5 5.5 0 0 1 27.5 66Z",
			width: 0.8,
			role: "plain",
		},
		{ d: "M23 88.5H136", width: 2.2, role: "plain" },
		{ d: "M23 97.5H108", width: 2.2, role: "plain" },
		{
			d: "M30.5 112H67.5A8.5 8.5 0 0 1 67.5 129H30.5A8.5 8.5 0 0 1 30.5 112Z",
			width: 0.8,
			role: "cta",
		},
		{
			d: "M90.5 112H119.5A8.5 8.5 0 0 1 119.5 129H90.5A8.5 8.5 0 0 1 90.5 112Z",
			width: 0.8,
			role: "plain",
		},
		{
			d: "M181 46H289A9 9 0 0 1 298 55V123A9 9 0 0 1 289 132H181A9 9 0 0 1 172 123V55A9 9 0 0 1 181 46Z",
			width: 0.8,
			role: "image",
		},
		{
			d: "M235 65A24 24 0 1 1 235 113A24 24 0 1 1 235 65Z",
			width: 0.8,
			role: "orb",
		},
		{
			d: "M30 146H102A8 8 0 0 1 110 154V178A8 8 0 0 1 102 186H30A8 8 0 0 1 22 178V154A8 8 0 0 1 30 146Z",
			width: 0.8,
			role: "plain",
		},
		{
			d: "M124 146H196A8 8 0 0 1 204 154V178A8 8 0 0 1 196 186H124A8 8 0 0 1 116 178V154A8 8 0 0 1 124 146Z",
			width: 0.8,
			role: "plain",
		},
		{
			d: "M218 146H290A8 8 0 0 1 298 154V178A8 8 0 0 1 290 186H218A8 8 0 0 1 210 178V154A8 8 0 0 1 218 146Z",
			width: 0.8,
			role: "plain",
		},
		{ d: "M32 159H58", width: 1.4, role: "plain" },
		{ d: "M126 159H152", width: 1.4, role: "plain" },
		{ d: "M220 159H246", width: 1.4, role: "plain" },
	],
	marks: [
		"M-10 -3V-10H-3",
		"M323 -10H330V-3",
		"M330 203V210H323",
		"M-3 210H-10V203",
	],
	orb: { cx: 235, cy: 89 },
	led: { cx: 18, cy: 15 },
};

// A phone page: header, picture, headline, one wide button, two cards.
const TALL_PLAN: Plan = {
	viewBox: "-12 -12 204 312",
	frame:
		"M16.5 0.5H163.5A16 16 0 0 1 179.5 16.5V271.5A16 16 0 0 1 163.5 287.5H16.5A16 16 0 0 1 0.5 271.5V16.5A16 16 0 0 1 16.5 0.5Z",
	parts: [
		{ d: "M0.5 34H179.5", width: 1.4, role: "plain" },
		{ d: "M18 12A5 5 0 1 1 18 22A5 5 0 1 1 18 12Z", width: 0.8, role: "plain" },
		{ d: "M29 17H54", width: 2.2, role: "plain" },
		{ d: "M148 13.5H162", width: 1.4, role: "plain" },
		{ d: "M148 20.5H162", width: 1.4, role: "plain" },
		{
			d: "M24 46H156A10 10 0 0 1 166 56V120A10 10 0 0 1 156 130H24A10 10 0 0 1 14 120V56A10 10 0 0 1 24 46Z",
			width: 0.8,
			role: "image",
		},
		{
			d: "M90 64A24 24 0 1 1 90 112A24 24 0 1 1 90 64Z",
			width: 0.8,
			role: "orb",
		},
		{
			d: "M19.5 144H132.5A5.5 5.5 0 0 1 132.5 155H19.5A5.5 5.5 0 0 1 19.5 144Z",
			width: 0.8,
			role: "plain",
		},
		{
			d: "M19.5 160H96.5A5.5 5.5 0 0 1 96.5 171H19.5A5.5 5.5 0 0 1 19.5 160Z",
			width: 0.8,
			role: "plain",
		},
		{ d: "M15 183H148", width: 2.2, role: "plain" },
		{ d: "M15 192H118", width: 2.2, role: "plain" },
		{
			d: "M23 206H157A9 9 0 0 1 157 224H23A9 9 0 0 1 23 206Z",
			width: 0.8,
			role: "cta",
		},
		{
			d: "M22 234H78A8 8 0 0 1 86 242V266A8 8 0 0 1 78 274H22A8 8 0 0 1 14 266V242A8 8 0 0 1 22 234Z",
			width: 0.8,
			role: "plain",
		},
		{
			d: "M102 234H158A8 8 0 0 1 166 242V266A8 8 0 0 1 158 274H102A8 8 0 0 1 94 266V242A8 8 0 0 1 102 234Z",
			width: 0.8,
			role: "plain",
		},
		{ d: "M24 247H50", width: 1.4, role: "plain" },
		{ d: "M104 247H130", width: 1.4, role: "plain" },
	],
	marks: [
		"M-10 -3V-10H-3",
		"M183 -10H190V-3",
		"M190 291V298H183",
		"M-3 298H-10V291",
	],
	orb: { cx: 90, cy: 88 },
	led: { cx: 18, cy: 17 },
};

const DRAFT_PART = "fill-transparent stroke-ember-1/55";
const INKED_PART = "fill-transparent stroke-white/20";
const ASLEEP_PART = "fill-transparent stroke-white/12";

/** Fill and stroke of each part role in each stage. A stage change animates between them. */
const PART_CLASSES: Record<PlanStage, Record<PartRole, string>> = {
	draft: {
		frame: "fill-transparent stroke-ember-1/90",
		plain: DRAFT_PART,
		cta: DRAFT_PART,
		image: DRAFT_PART,
		orb: DRAFT_PART,
	},
	inked: {
		frame: "fill-white/[0.035] stroke-white/16",
		plain: INKED_PART,
		cta: INKED_PART,
		image: "fill-white/[0.03] stroke-white/20",
		// The drafted circle becomes the lit sun of the ember layer.
		orb: "fill-transparent stroke-transparent",
	},
	asleep: {
		frame: "fill-white/[0.02] stroke-white/12",
		plain: ASLEEP_PART,
		cta: ASLEEP_PART,
		image: ASLEEP_PART,
		orb: ASLEEP_PART,
	},
};

/** Delay before the frame starts to draw, ms. The loading mark fades out first. */
const DRAW_START_MS = 150;
/** Gap between two parts in the draw-on, ms. The last part ends at about 2.2 s. */
const DRAW_STEP_MS = 70;
/** Gap between two parts when a stage change passes over the drawing, ms. */
const INK_STEP_MS = 40;

// The comet shows after the draw-on ends, or soon after a mount that skipped it.
const COMET_DELAY_AFTER_DRAW_S = 2.1;
const COMET_DELAY_S = 0.8;

// Four copies of the frame stroke stack into a bright head with a fading tail.
// The dash pattern "0, gap, dash, 0" puts the leading end of every copy on one point.
const COMET_LAYERS = [
	{ width: 4, opacity: 0.14, dash: "0 0.9 0.1 0" },
	{ width: 1.2, opacity: 0.35, dash: "0 0.88 0.12 0" },
	{ width: 1.6, opacity: 0.7, dash: "0 0.95 0.05 0" },
	{ width: 2, opacity: 1, dash: "0 0.985 0.015 0" },
] as const;

/** Props of the plan drawing. */
export type BootPlanProps = {
	/** Null while the first token request runs. The drawing then keeps its size but shows nothing. */
	stage: PlanStage | null;
	/** True when the last turn failed on screen. The logo light then stays still instead of breathing. */
	stopped: boolean;
};

/**
 * Renders the wide drawing on stages of 560 px and more, and the tall one
 * below. The entrance is the first stage after loading: `draft` draws the
 * parts one by one, the other stages fade in. Later stage changes only
 * move colors.
 */
export function BootPlan({ stage, stopped }: BootPlanProps) {
	const [entrance, setEntrance] = useState(stage);
	if (entrance === null && stage !== null) setEntrance(stage);
	const id = useId();

	return (
		<motion.div
			initial={false}
			animate={{ opacity: stage === null ? 0 : 1 }}
			transition={
				// The draw-on shows the parts itself, so the box appears at once.
				entrance === "draft"
					? { duration: 0 }
					: entrance === "asleep"
						? { duration: 0.5, ease: BOOT_EASE }
						: { duration: 0.3, delay: 0.25, ease: BOOT_EASE }
			}
		>
			<PlanSvg
				plan={WIDE_PLAN}
				gradientId={`${id}-wide`}
				stage={stage}
				drawIn={entrance === "draft"}
				stopped={stopped}
				className="mx-[-3.75%] @min-[560px]:block hidden w-[107.5%]"
			/>
			<PlanSvg
				plan={TALL_PLAN}
				gradientId={`${id}-tall`}
				stage={stage}
				drawIn={entrance === "draft"}
				stopped={stopped}
				className="mx-auto block @min-[560px]:hidden w-[clamp(112px,calc((100cqh_-_340px)*0.654),156px)]"
			/>
		</motion.div>
	);
}

type PlanSvgProps = BootPlanProps & {
	plan: Plan;
	/** Prefix of the gradient ids. Each SVG needs its own, and both live in one document. */
	gradientId: string;
	/** True when the parts draw themselves at mount. */
	drawIn: boolean;
	/** Width and display of this SVG. The container query shows one of the two drawings. */
	className: string;
};

/**
 * One drawing. CSS animations do not run while its container query hides
 * it. Without a stage it is an empty box of the right size, and the parts
 * mount with the first stage, so the draw-on starts then.
 */
function PlanSvg({
	plan,
	gradientId,
	stage,
	drawIn,
	stopped,
	className,
}: PlanSvgProps) {
	const parts: PlanPart[] = [
		{ d: plan.frame, width: 1, role: "frame" },
		...plan.parts,
	];
	const ember = `url(#${gradientId}-ember)`;

	if (stage === null) {
		return (
			<svg viewBox={plan.viewBox} aria-hidden="true" className={className} />
		);
	}

	return (
		<svg
			viewBox={plan.viewBox}
			aria-hidden="true"
			className={cn("overflow-visible", className)}
		>
			<defs>
				<linearGradient id={`${gradientId}-ember`} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" style={{ stopColor: "var(--ember-1)" }} />
					<stop offset="1" style={{ stopColor: "var(--ember-2)" }} />
				</linearGradient>
				<radialGradient id={`${gradientId}-halo`}>
					<stop
						offset="0"
						stopOpacity={0.55}
						style={{ stopColor: "var(--ember-1)" }}
					/>
					<stop
						offset="0.5"
						stopOpacity={0.22}
						style={{ stopColor: "var(--ember-2)" }}
					/>
					<stop
						offset="1"
						stopOpacity={0}
						style={{ stopColor: "var(--ember-2)" }}
					/>
				</radialGradient>
				<radialGradient id={`${gradientId}-led`}>
					<stop offset="0" style={{ stopColor: "var(--ember-1)" }} />
					<stop offset="0.35" style={{ stopColor: "var(--ember-1)" }} />
					<stop
						offset="1"
						stopOpacity={0}
						style={{ stopColor: "var(--ember-2)" }}
					/>
				</radialGradient>
			</defs>
			{/* The marks sit outside the mirrored group: they are symmetric. */}
			<g
				className={cn(
					"stroke-white/28 transition-opacity duration-400",
					stage === "draft" ? "opacity-100" : "opacity-0",
				)}
			>
				{plan.marks.map((d) => (
					<path
						key={d}
						d={d}
						fill="none"
						strokeWidth={1}
						strokeLinecap="round"
					/>
				))}
			</g>
			{/* RTL mirrors the drawing of the app, like the app itself. */}
			<g className="[transform-box:fill-box] [transform-origin:center] rtl:[transform:scaleX(-1)]">
				{parts.map((part, index) => (
					<path
						key={part.d}
						d={part.d}
						pathLength={1}
						strokeDasharray="1 1"
						strokeLinecap="round"
						strokeWidth={part.width}
						className={cn(
							"transition-[stroke,fill] duration-500 motion-reduce:transition-none",
							PART_CLASSES[stage][part.role],
							drawIn && "animate-draw motion-reduce:animate-none",
						)}
						style={{
							animationDelay: `${DRAW_START_MS + index * DRAW_STEP_MS}ms`,
							transitionDelay: `${index * INK_STEP_MS}ms`,
						}}
					/>
				))}
				{/* The machine is ready: the buttons turn ember and the picture gets a sun. */}
				<g
					className={cn(
						"transition-opacity delay-350 duration-500 motion-reduce:transition-none",
						stage === "inked" ? "opacity-100" : "opacity-0",
					)}
				>
					{parts
						.filter((part) => part.role === "cta")
						.map((part) => (
							<path key={part.d} d={part.d} fill={ember} />
						))}
					<circle
						cx={plan.orb.cx}
						cy={plan.orb.cy}
						r={34}
						fill={`url(#${gradientId}-halo)`}
						className={cn(
							stage === "inked" &&
								"animate-pulse-soft [animation-duration:2.4s] motion-reduce:animate-none",
						)}
					/>
					<circle cx={plan.orb.cx} cy={plan.orb.cy} r={12} fill={ember} />
				</g>
				{stage === "asleep" ? (
					<circle
						cx={plan.led.cx}
						cy={plan.led.cy}
						r={7}
						fill={`url(#${gradientId}-led)`}
						// A failed start is not a sleep, so the standby light stops breathing.
						className={
							stopped
								? "opacity-45"
								: "animate-pulse-soft [animation-duration:4.8s] motion-reduce:animate-none motion-reduce:opacity-80"
						}
					/>
				) : null}
				{stage === "draft" ? (
					<motion.g
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{
							duration: 0.4,
							delay: drawIn ? COMET_DELAY_AFTER_DRAW_S : COMET_DELAY_S,
							ease: BOOT_EASE,
						}}
						className="motion-reduce:hidden"
					>
						{COMET_LAYERS.map((layer) => (
							<path
								key={layer.dash}
								d={plan.frame}
								pathLength={1}
								fill="none"
								strokeLinecap="round"
								strokeWidth={layer.width}
								strokeOpacity={layer.opacity}
								strokeDasharray={layer.dash}
								className="animate-comet stroke-ember-1"
							/>
						))}
					</motion.g>
				) : null}
			</g>
		</svg>
	);
}

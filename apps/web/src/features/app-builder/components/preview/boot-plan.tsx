/**
 * The picture of the preview boot screen: a line drawing of an app screen
 * and the Wandit Spark. The Spark sets up or wakes the app, then draws the
 * app in ember lines and rests in its picture. Rendered by
 * preview-boot-screen.tsx. Inline SVG, the `wd-draw` keyframe from
 * globals.css, motion fades, and BootSpark.
 */

import { cn } from "@wandit/ui/lib/utils";
import { motion } from "motion/react";
import { useId, useState } from "react";

import type { BootScene } from "../../lib/boot-state";
import { BOOT_EASE } from "../../lib/constants";
import { BootSpark } from "./boot-spark";

/**
 * `waking`: a sleeping app wakes and its frame warms. `inked`: the app page opens or its first version builds.
 * `asleep`: the app sleeps, did not start, or waits for its first version.
 */
type PlanStage = "waking" | "inked" | "asleep";

// Null hides the drawing, because no app shows yet.
const PLAN_STAGE: Record<BootScene, PlanStage | null> = {
	loading: null,
	create: null,
	wake: "waking",
	open: "inked",
	asleep: "asleep",
	stopped: "asleep",
};

/** What a part of the drawing is. The stage colors each role in its own way. */
type PartRole = "frame" | "plain" | "cta" | "image";

type PlanPart = {
	/** SVG path data in viewBox units. */
	d: string;
	/** Stroke width in viewBox units. */
	width: number;
	role: PartRole;
};

type Plan = {
	/** The viewBox in SVG units. It is centered on the frame, so 50 % of the box is the frame center, also in RTL. */
	box: { x: number; y: number; width: number; height: number };
	/** The rounded outline of the screen. It draws first. */
	frame: string;
	/** The parts in draw order: header, text bars, buttons, picture, cards. */
	parts: PlanPart[];
	/** Center of the picture circle. The Spark rests there while the drawing shows. */
	orb: { cx: number; cy: number };
};

// A desktop page: header, headline, two buttons, a picture, three cards.
const WIDE_PLAN: Plan = {
	box: { x: -12, y: -12, width: 344, height: 224 },
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
		// The picture circle. BootSpark rests on its center, `orb`.
		{
			d: "M235 65A24 24 0 1 1 235 113A24 24 0 1 1 235 65Z",
			width: 0.8,
			role: "plain",
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
	orb: { cx: 235, cy: 89 },
};

// A phone page: header, picture, headline, one wide button, two cards.
const TALL_PLAN: Plan = {
	box: { x: -12, y: -12, width: 204, height: 312 },
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
		// The picture circle. BootSpark rests on its center, `orb`.
		{
			d: "M90 64A24 24 0 1 1 90 112A24 24 0 1 1 90 64Z",
			width: 0.8,
			role: "plain",
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
	orb: { cx: 90, cy: 88 },
};

const INKED_PART = "fill-transparent stroke-white/20";
const ASLEEP_PART = "fill-transparent stroke-white/12";

/** Fill and stroke of each part role in each stage. A stage change animates between them. */
const PART_CLASSES: Record<PlanStage, Record<PartRole, string>> = {
	// Only the frame warms: the Spark wakes the app, and the parts light up when it opens.
	waking: {
		frame: "fill-white/[0.02] stroke-ember-1/45",
		plain: ASLEEP_PART,
		cta: ASLEEP_PART,
		image: ASLEEP_PART,
	},
	inked: {
		frame: "fill-white/[0.035] stroke-white/16",
		plain: INKED_PART,
		cta: INKED_PART,
		image: "fill-white/[0.03] stroke-white/20",
	},
	asleep: {
		frame: "fill-white/[0.02] stroke-white/12",
		plain: ASLEEP_PART,
		cta: ASLEEP_PART,
		image: ASLEEP_PART,
	},
};

/** Gap between two parts in the draw-on, ms. The last wide part ends at about 1.6 s. */
const DRAW_STEP_MS = 45;
/** Gap between two parts when a stage change passes over the drawing, ms. */
const INK_STEP_MS = 40;
/** Delay of the ember button fills when the app opens, s. The fills come after their outlines start to draw. */
const CTA_FILL_DELAY_S = 0.7;

/** The picture-circle center as CSS percents of the drawing box. BootSpark anchors there. */
function orbPercentOf(plan: Plan): { left: string; top: string } {
	const { box, orb } = plan;
	return {
		left: `${(((orb.cx - box.x) / box.width) * 100).toFixed(2)}%`,
		top: `${(((orb.cy - box.y) / box.height) * 100).toFixed(2)}%`,
	};
}

/** Props of the boot picture. */
export type BootPlanProps = {
	/** The boot scene from sceneOf. PreviewBootScreen passes it. */
	scene: BootScene;
};

/**
 * Renders the wide drawing on stages of 560 px and more, and the tall one
 * below, each with its Spark. The first stage after a hidden drawing is
 * its entrance: `inked` draws the parts one by one, the other stages fade
 * in. Later stage changes only move colors.
 */
export function BootPlan({ scene }: BootPlanProps) {
	const stage = PLAN_STAGE[scene];
	// The parts keep their last stage while the drawing fades out, so they never vanish in one frame.
	const [shownStage, setShownStage] = useState(stage);
	if (stage !== null && stage !== shownStage) setShownStage(stage);
	const [entrance, setEntrance] = useState(stage);
	if (entrance !== stage && (entrance === null || stage === null)) {
		setEntrance(stage);
	}
	const id = useId();

	return (
		<>
			<PlanBox
				plan={WIDE_PLAN}
				gradientId={`${id}-wide`}
				scene={scene}
				stage={stage}
				shownStage={shownStage}
				drawIn={entrance === "inked"}
				className="mx-[-3.75%] @min-[560px]:block hidden w-[107.5%]"
			/>
			<PlanBox
				plan={TALL_PLAN}
				gradientId={`${id}-tall`}
				scene={scene}
				stage={stage}
				shownStage={shownStage}
				drawIn={entrance === "inked"}
				className="mx-auto block @min-[560px]:hidden w-[clamp(112px,calc((100cqh_-_340px)*0.654),156px)]"
			/>
		</>
	);
}

type PlanBoxProps = {
	plan: Plan;
	/** Id of the ember gradient. Each SVG needs its own, and both live in one document. */
	gradientId: string;
	scene: BootScene;
	/** Stage of the scene. Null hides the drawing. */
	stage: PlanStage | null;
	/** The last stage that was not null. The parts keep its colors while the drawing fades out. Null before the first one. */
	shownStage: PlanStage | null;
	/** True when the parts draw themselves one by one. */
	drawIn: boolean;
	/** Width and display of the box. The container query shows one of the two boxes. */
	className: string;
};

/**
 * One drawing and its Spark. CSS animations do not run while the container
 * query hides the box. The SVG keeps its viewBox in every stage, so the box
 * never changes size.
 */
function PlanBox({
	plan,
	gradientId,
	scene,
	stage,
	shownStage,
	drawIn,
	className,
}: PlanBoxProps) {
	const { x, y, width, height } = plan.box;
	const parts: PlanPart[] = [
		{ d: plan.frame, width: 1, role: "frame" },
		...plan.parts,
	];

	return (
		<div className={cn("relative", className)}>
			<motion.svg
				viewBox={`${x} ${y} ${width} ${height}`}
				aria-hidden="true"
				className="block w-full overflow-visible"
				initial={false}
				animate={{ opacity: stage === null ? 0 : 1 }}
				transition={
					stage === null
						? { duration: 0.3, ease: BOOT_EASE }
						: // The draw-on shows the parts itself, so the box shows at once.
							drawIn
							? { duration: 0 }
							: { duration: 0.5, ease: BOOT_EASE }
				}
			>
				{shownStage === null ? null : (
					<>
						<defs>
							<linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
								<stop offset="0" style={{ stopColor: "var(--ember-1)" }} />
								<stop offset="1" style={{ stopColor: "var(--ember-2)" }} />
							</linearGradient>
						</defs>
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
										PART_CLASSES[shownStage][part.role],
										drawIn && "animate-draw motion-reduce:animate-none",
									)}
									style={{
										animationDelay: `${index * DRAW_STEP_MS}ms`,
										transitionDelay: `${index * INK_STEP_MS}ms`,
									}}
								/>
							))}
							{/* A motion fade, because a CSS transition does not run at mount: a drawing that mounts inked must not show the fills before the outlines. */}
							<motion.g
								initial={{ opacity: 0 }}
								animate={{ opacity: shownStage === "inked" ? 1 : 0 }}
								transition={{
									duration: 0.5,
									delay: shownStage === "inked" ? CTA_FILL_DELAY_S : 0,
									ease: BOOT_EASE,
								}}
							>
								{parts
									.filter((part) => part.role === "cta")
									.map((part) => (
										<path
											key={part.d}
											d={part.d}
											fill={`url(#${gradientId})`}
										/>
									))}
							</motion.g>
						</g>
					</>
				)}
			</motion.svg>
			<BootSpark scene={scene} orb={orbPercentOf(plan)} />
		</div>
	);
}

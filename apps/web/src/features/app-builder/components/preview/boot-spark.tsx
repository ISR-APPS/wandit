/**
 * The Wandit Spark of the preview boot screen. It glows while the page
 * loads, pulls app pieces in while a new app is set up, sends ripples
 * while a sleeping app wakes, and rests in the picture of the app drawing.
 * BootPlan renders one over each drawing. CSS transitions and the
 * keyframes `wd-gather` and `wd-ripple` from globals.css move it.
 */

import { cn } from "@wandit/ui/lib/utils";
import { useEffect, useState } from "react";

import { Spark } from "@/components/logo";
import type { BootScene } from "../../lib/boot-state";

/** Time between two half turns of the Spark while a new app is set up, ms. About two detail lines show in that time. */
const TWIRL_EVERY_MS = 6400;
/** Gap between two pieces of the gather loop, ms. Six pieces fill the 3.6 s loop of `animate-gather`. */
const GATHER_STEP_MS = 600;
/** Start offsets of the two wake ripples, ms. The negative delay starts the second ring half a 2.4 s loop later. */
const RIPPLE_DELAYS_MS = [0, -1200] as const;

/** A small pill button, in field units. */
const PILL_PATH = "M-4 -3H4A3 3 0 0 1 4 3H-4A3 3 0 0 1 -4 -3Z";

// The app pieces that fly into the Spark. The negative delays start them in reverse list order, one every 600 ms.
// On screen they come from 15°, 315°, 195°, 75°, 255°, then 135°, so two pieces in a row are 60° to 180° apart.
// Ember marks only the buttons, as in the finished drawing.
const PIECES = [
	// A text line.
	{
		angle: 15,
		d: "M-6 0H6",
		strokeWidth: 2,
		className: "fill-none stroke-white/70",
	},
	// A button.
	{ angle: 135, d: PILL_PATH, strokeWidth: 0, className: "fill-ember-1" },
	// A picture.
	{
		angle: 255,
		d: "M0 -3.5A3.5 3.5 0 1 1 0 3.5A3.5 3.5 0 1 1 0 -3.5Z",
		strokeWidth: 0,
		className: "fill-white/45",
	},
	// A card.
	{
		angle: 75,
		d: "M-4.5 -3.5H4.5A1.5 1.5 0 0 1 6 -2V2A1.5 1.5 0 0 1 4.5 3.5H-4.5A1.5 1.5 0 0 1 -6 2V-2A1.5 1.5 0 0 1 -4.5 -3.5Z",
		strokeWidth: 1,
		className: "fill-none stroke-white/55",
	},
	// A short text line.
	{
		angle: 195,
		d: "M-4 0H4",
		strokeWidth: 2,
		className: "fill-none stroke-white/70",
	},
	// A second button.
	{ angle: 315, d: PILL_PATH, strokeWidth: 0, className: "fill-ember-1" },
] as const;

// Size of the Spark for each scene. The base is 26 px. The first class is for a narrow stage, the `@min-[560px]` class for a wide one.
// Where the drawing shows, the Spark fits inside its picture circle.
const SPARK_SCALE: Record<BootScene, string> = {
	loading: "scale-100",
	create: "scale-135 @min-[560px]:scale-150",
	wake: "scale-75 @min-[560px]:scale-125",
	open: "scale-70 @min-[560px]:scale-110",
	asleep: "scale-60 @min-[560px]:scale-90",
	stopped: "scale-60 @min-[560px]:scale-90",
};

const LIT_SPARK = "text-ember-1 stroke-transparent";

// A sleeping app dims the Spark. A failed start leaves only its outline: the light is off, which is not a sleep.
const SPARK_COLOR: Record<BootScene, string> = {
	loading: LIT_SPARK,
	create: LIT_SPARK,
	wake: LIT_SPARK,
	open: LIT_SPARK,
	asleep: "text-white/35 stroke-transparent",
	stopped: "text-transparent stroke-white/40",
};

// The glow pulses at one speed in every scene. A scene changes only these values, so the pulse never jumps.
const HALO_CLASSES: Record<BootScene, string> = {
	loading: "opacity-100 scale-100",
	create: "opacity-80 scale-125",
	wake: "opacity-90 scale-50 @min-[560px]:scale-75",
	open: "opacity-80 scale-45 @min-[560px]:scale-60",
	asleep: "opacity-45 scale-40 @min-[560px]:scale-50",
	stopped: "opacity-0 scale-40 @min-[560px]:scale-50",
};

/** Props of the Spark over one drawing. BootPlan passes them. */
export type BootSparkProps = {
	/** The boot scene from sceneOf. It sets the place, size, color, and loop of the Spark. */
	scene: BootScene;
	/** Center of the app picture in the drawing box, as CSS percents, for example `71.80%`. BootPlan computes it from the plan. */
	orb: { left: string; top: string };
};

/**
 * The Spark, its glow, and its loops, on a size-0 anchor over the drawing.
 * It never unmounts, so a fast scene change only retargets its CSS
 * transitions.
 */
export function BootSpark({ scene, orb }: BootSparkProps) {
	const [halfTurns, setHalfTurns] = useState(0);
	// A half turn looks the same as the start pose, so every twirl ends forward and the Spark never turns back.
	useEffect(() => {
		if (scene !== "create") return;
		setHalfTurns((turns) => turns + 1);
		const timer = setInterval(
			() => setHalfTurns((turns) => turns + 1),
			TWIRL_EVERY_MS,
		);
		return () => clearInterval(timer);
	}, [scene]);

	// No app shows yet, so the Spark stays at the center of the drawing box.
	const isCentered = scene === "loading" || scene === "create";
	const isGathering = scene === "create";
	const isWaking = scene === "wake";

	return (
		<div
			aria-hidden="true"
			// The two eases make the flight an arc. The logical inset mirrors it in RTL, like the drawing.
			className="pointer-events-none absolute size-0 [transition:left_700ms_cubic-bezier(0.2,0.8,0.2,1),right_700ms_cubic-bezier(0.2,0.8,0.2,1),top_700ms_cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"
			style={{
				insetInlineStart: isCentered ? "50%" : orb.left,
				top: isCentered ? "50%" : orb.top,
			}}
		>
			{/* The anchor has no size, so left-0 with a -50 % shift centers each layer on it, in LTR and in RTL. */}
			<span
				className={cn(
					"-translate-1/2 absolute top-0 left-0 size-[132px] transition-[opacity,scale] duration-700 motion-reduce:transition-opacity",
					HALO_CLASSES[scene],
				)}
			>
				<span className="block size-full animate-pulse-soft rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--ember-2)_34%,transparent),transparent)] [animation-duration:2.4s] motion-reduce:animate-none" />
			</span>
			<svg
				viewBox="-80 -80 160 160"
				aria-hidden="true"
				className="-translate-1/2 absolute top-0 left-0 @min-[560px]:size-[160px] size-[120px] overflow-visible"
			>
				<g
					className={cn(
						"transition-opacity duration-300",
						isGathering ? "opacity-100" : "opacity-0",
					)}
				>
					<circle
						r={64}
						strokeWidth={1}
						vectorEffect="non-scaling-stroke"
						className="fill-none stroke-white/10"
					/>
					{PIECES.map((piece, index) => (
						<g key={piece.angle} transform={`rotate(${piece.angle})`}>
							{/* The CSS loop has its own group, because a CSS transform replaces the transform attribute of its element. */}
							{/* The loop overrides translateX(44px). It shows only with reduced motion: each piece then rests between 64 and 10 units. */}
							<g
								className="animate-gather [transform:translateX(44px)] motion-reduce:animate-none motion-reduce:opacity-60"
								// A paused loop freezes and fades with its group. It does not snap to the center.
								style={{
									animationDelay: `${-index * GATHER_STEP_MS}ms`,
									animationPlayState: isGathering ? "running" : "paused",
								}}
							>
								<path
									d={piece.d}
									strokeWidth={piece.strokeWidth}
									strokeLinecap="round"
									className={piece.className}
								/>
							</g>
						</g>
					))}
				</g>
				<g
					className={cn(
						"transition-opacity duration-300 motion-reduce:hidden",
						isWaking ? "opacity-100" : "opacity-0",
					)}
				>
					{RIPPLE_DELAYS_MS.map((delayMs) => (
						<circle
							key={delayMs}
							r={72}
							strokeWidth={1.25}
							vectorEffect="non-scaling-stroke"
							className="animate-ripple fill-none stroke-ember-1"
							style={{
								animationDelay: `${delayMs}ms`,
								animationPlayState: isWaking ? "running" : "paused",
							}}
						/>
					))}
				</g>
				{/* It mounts with the scene, so it plays once each time the app opens. */}
				{scene === "open" ? (
					<circle
						r={72}
						strokeWidth={1.25}
						vectorEffect="non-scaling-stroke"
						className="animate-ripple fill-none stroke-ember-1 motion-reduce:hidden"
						// The ring starts during the 700 ms flight, so it grows as the Spark lands. It runs in half the 2.4 s wake loop.
						style={{
							animationDelay: "300ms",
							animationDuration: "1.2s",
							animationIterationCount: 1,
						}}
					/>
				) : null}
			</svg>
			<span
				className={cn(
					"-translate-1/2 absolute top-0 left-0 block [transition:scale_700ms_cubic-bezier(0.4,0,0.2,1),rotate_1100ms_cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
					SPARK_SCALE[scene],
				)}
				style={{ rotate: `${halfTurns * 180}deg` }}
			>
				<Spark
					className={cn(
						"block size-[26px] transition-colors duration-500 [stroke-linejoin:round]",
						SPARK_COLOR[scene],
					)}
				/>
			</span>
		</div>
	);
}

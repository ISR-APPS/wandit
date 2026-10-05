/**
 * The Wandit Spark of the preview boot screen. It glows while the page
 * loads, burns in the core window of the server rack while the app starts or
 * wakes, and rests in the picture of the app drawing. BootPlan renders one
 * over each drawing. CSS transitions and the `wd-ripple` keyframe from
 * globals.css move it.
 */

import { cn } from "@wandit/ui/lib/utils";
import { useEffect, useState } from "react";

import { Spark } from "@/components/logo";
import type { BootScene } from "../../lib/boot-state";

/** Time between two half turns of the Spark while a new app is set up, ms. About two detail lines show in that time. */
const TWIRL_EVERY_MS = 6400;

// Size of the Spark for each scene. The base is 26 px. The first class is for a narrow stage, the `@min-[560px]` class for a wide one.
// In the server room the Spark fills half the core window of the rack. Where the drawing shows, it fits inside its picture circle.
const SPARK_SCALE: Record<BootScene, string> = {
	loading: "scale-100",
	create: "scale-75 @min-[560px]:scale-150",
	wake: "scale-75 @min-[560px]:scale-150",
	open: "scale-70 @min-[560px]:scale-110",
	asleep: "scale-60 @min-[560px]:scale-90",
	stopped: "scale-60 @min-[560px]:scale-90",
};

const LIT_SPARK = "text-spark stroke-transparent";

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
// In the server room the glow fills the core window and spills a little onto the rack face.
const HALO_CLASSES: Record<BootScene, string> = {
	loading: "opacity-100 scale-100",
	create: "opacity-90 scale-45 @min-[560px]:scale-75",
	wake: "opacity-90 scale-45 @min-[560px]:scale-75",
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

	// No app shows yet, so the Spark stays at the center of the drawing box. The core window of the server rack is there.
	const isCentered =
		scene === "loading" || scene === "create" || scene === "wake";

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
				<span className="block size-full animate-pulse-soft rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-spark)_34%,transparent),transparent)] [animation-duration:2.4s] motion-reduce:animate-none" />
			</span>
			<svg
				viewBox="-80 -80 160 160"
				aria-hidden="true"
				className="-translate-1/2 absolute top-0 left-0 @min-[560px]:size-[160px] size-[120px] overflow-visible"
			>
				{/* It mounts with the scene, so it plays once each time the app opens. The server room draws its own rings. */}
				{scene === "open" ? (
					<circle
						r={72}
						strokeWidth={1.25}
						vectorEffect="non-scaling-stroke"
						className="animate-ripple fill-none stroke-spark motion-reduce:hidden"
						// The ring starts during the 700 ms flight, so it grows as the Spark lands. It runs in half the 2.4 s loop of the token.
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

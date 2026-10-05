/**
 * The signature motion of the landing page: the "build" of an app. It shows
 * the grey skeleton with a shimmer. Then a band of light with a four-point
 * spark sweeps from the top start corner to the bottom end corner. The band
 * leaves the final screen behind it. The hero and how-it-works use it inside FitScreen:
 * `<FitScreen><WandSweep skeleton={<MiniApp skeleton />}><MiniApp /></WandSweep></FitScreen>`.
 */

import {
	type AnimationPlaybackControls,
	animate,
	type MotionValue,
	motion,
	useMotionValue,
	useReducedMotion,
	useTransform,
} from "motion/react";
import {
	type CSSProperties,
	type ReactNode,
	useEffect,
	useEffectEvent,
	useState,
} from "react";

import { Spark } from "@/components/logo";
import { useTranslation } from "@/lib/i18n";

type WandSweepProps = {
	/** A new value replays the build from the skeleton. */
	runKey: string | number;
	/** The grey state, shown before the sweep. Must have the size of `children`. */
	skeleton: ReactNode;
	/** The final screen that the sweep reveals. */
	children: ReactNode;
	/** Time the skeleton shows before the sweep starts, in ms. */
	holdMs?: number;
	/** Runs once per run, when the final screen is fully visible. */
	onDone?: () => void;
};

/** Replays the skeleton-to-app build on mount and on each `runKey` change. Reduced motion shows the final screen at once. */
export function WandSweep({ runKey, ...props }: WandSweepProps) {
	// A new key remounts the run, so its state starts again from the skeleton.
	return <SweepRun key={runKey} {...props} />;
}

/*
 * Sweep geometry. The leading edge is the line x/W + y/H = edge, in "diagonal
 * units": 0 is the top start corner and 2 is the bottom end corner. The
 * edge starts a bit before the first corner. It stops past the far corner by
 * the band width, so the band enters and leaves the screen fully.
 */
const EDGE_START = -0.05;
const EDGE_END = 2.55;
/** Long enough to read as a build, short enough to keep the hero loop short. */
const SWEEP_SECONDS = 0.9;
/** The final screen shows a little behind the spark edge, under the white glow. */
const REVEAL_LAG = 0.12;

/*
 * The band box is 3 times the screen with the same aspect ratio. Then the
 * color lines of a "to bottom right" gradient are parallel to the screen
 * anti-diagonal. The 50% line of the gradient sits at edge = 3 + 6 * shift.
 * The spark edge is at 50%. The white glow trails it by about 0.42 diagonal units.
 */
const BAND_STYLE: CSSProperties = {
	backgroundImage:
		"linear-gradient(to bottom right, transparent 43%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.55) 48.4%, color-mix(in srgb, var(--color-spark) 25%, white) 49.55%, var(--color-spark) 49.72%, var(--color-spark) 50%, color-mix(in srgb, var(--color-spark) 40%, transparent) 50.06%, transparent 50.45%)",
};

type Phase = "hold" | "sweep" | "done";

type SweepRunProps = Omit<WandSweepProps, "runKey">;

function SweepRun({
	skeleton,
	children,
	holdMs = 1400,
	onDone,
}: SweepRunProps) {
	const reduceMotion = useReducedMotion() ?? false;
	const { dir } = useTranslation();
	const isRtl = dir === "rtl";
	const [phase, setPhase] = useState<Phase>(reduceMotion ? "done" : "hold");
	const edge = useMotionValue(EDGE_START);
	const clipPath = useTransform(edge, (value) =>
		revealPolygon(value - REVEAL_LAG, isRtl),
	);
	// An effect event reads the latest callback, so a new parent callback does not restart the run.
	const notifyDone = useEffectEvent(() => onDone?.());

	useEffect(() => {
		if (reduceMotion) {
			setPhase("done");
			notifyDone();
			return;
		}
		let controls: AnimationPlaybackControls | undefined;
		const timer = window.setTimeout(() => {
			setPhase("sweep");
			controls = animate(edge, EDGE_END, {
				duration: SWEEP_SECONDS,
				// Slow start and soft stop, so the band reads as one stroke of the wand.
				ease: [0.5, 0.05, 0.25, 1],
				onComplete: () => {
					setPhase("done");
					notifyDone();
				},
			});
		}, holdMs);
		return () => {
			window.clearTimeout(timer);
			controls?.stop();
		};
	}, [edge, holdMs, reduceMotion]);

	const isDone = phase === "done";

	return (
		<div className="relative isolate grid">
			{isDone ? null : <div className="[grid-area:1/1]">{skeleton}</div>}
			<motion.div
				className="[grid-area:1/1]"
				style={{ clipPath: isDone ? "none" : clipPath }}
			>
				{children}
			</motion.div>
			{isDone ? null : (
				// The overlay is always LTR and mirrors itself for RTL, so the band math stays in one direction.
				<div
					dir="ltr"
					aria-hidden="true"
					className={
						isRtl
							? "pointer-events-none absolute inset-0 -scale-x-100 overflow-hidden"
							: "pointer-events-none absolute inset-0 overflow-hidden"
					}
				>
					<Shimmer isVisible={phase === "hold"} />
					{phase === "sweep" ? <SweepLight edge={edge} /> : null}
				</div>
			)}
		</div>
	);
}

/** The soft light that passes over the skeleton while it waits. */
function Shimmer({ isVisible }: { isVisible: boolean }) {
	return (
		<motion.div
			className="absolute inset-0"
			initial={{ opacity: 1 }}
			animate={{ opacity: isVisible ? 1 : 0 }}
			transition={{ duration: 0.2 }}
		>
			<motion.div
				className="absolute inset-y-0 -start-full w-full bg-[linear-gradient(100deg,transparent_30%,rgba(255,255,255,0.7)_50%,transparent_70%)]"
				animate={{ x: ["0%", "200%"] }}
				transition={{
					duration: 1.3,
					ease: "easeInOut",
					repeat: Number.POSITIVE_INFINITY,
					repeatDelay: 0.15,
				}}
			/>
		</motion.div>
	);
}

/** The band of light and the sparks on its leading edge. */
function SweepLight({ edge }: { edge: MotionValue<number> }) {
	const bandShift = useTransform(
		edge,
		(value) => `${((value - 3) / 6) * 100}%`,
	);
	// About two thirds of a turn over the sweep: the big spark visibly turns but does not blur into a wheel.
	const spinDeg = useTransform(edge, [EDGE_START, EDGE_END], [-20, 200]);

	return (
		<>
			<motion.div
				className="absolute start-0 top-0 h-[300%] w-[300%]"
				style={{ ...BAND_STYLE, x: bandShift, y: bandShift }}
			/>
			<EdgeSpark edge={edge} offset={0.3} sizeClass="size-[14px]" />
			<EdgeSpark edge={edge} offset={-0.24} sizeClass="size-[18px]" />
			<EdgeSpark
				edge={edge}
				offset={0}
				sizeClass="size-[58px]"
				spinDeg={spinDeg}
			>
				{/* A soft halo, so the spark reads as light and not as a sticker. */}
				<span className="-translate-1/2 absolute top-1/2 left-1/2 size-[190%] rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-spark)_45%,white)_0%,color-mix(in_srgb,var(--color-spark)_35%,transparent)_32%,transparent_66%)]" />
			</EdgeSpark>
		</>
	);
}

type EdgeSparkProps = {
	edge: MotionValue<number>;
	/**
	 * Place along the leading edge, in diagonal units. 0 is where the edge
	 * crosses the main diagonal; a positive value moves toward the top end.
	 */
	offset: number;
	/** Tailwind size class of the spark, in screen design px. */
	sizeClass: string;
	/** Rotation of the spark, driven by the sweep. Small sparks twinkle instead. */
	spinDeg?: MotionValue<number>;
	children?: ReactNode;
};

/** A spark that rides on the leading edge of the band. */
function EdgeSpark({
	edge,
	offset,
	sizeClass,
	spinDeg,
	children,
}: EdgeSparkProps) {
	// A point on the edge line: x/W = edge/2 + offset and y/H = edge/2 - offset.
	const x = useTransform(edge, (value) => `${(value / 2 + offset) * 100}%`);
	const y = useTransform(edge, (value) => `${(value / 2 - offset) * 100}%`);

	return (
		<motion.div className="absolute inset-0" style={{ x, y }}>
			<motion.div
				className="-translate-1/2 absolute start-0 top-0"
				style={spinDeg ? { rotate: spinDeg } : undefined}
				animate={spinDeg ? undefined : { scale: [0.4, 1.15, 0.4] }}
				transition={{
					duration: 0.5,
					repeat: Number.POSITIVE_INFINITY,
					ease: "easeInOut",
				}}
			>
				{children}
				<Spark
					className={`relative text-spark drop-shadow-[0_0_6px_var(--color-spark)] ${sizeClass}`}
				/>
			</motion.div>
		</motion.div>
	);
}

/**
 * The clip-path of the final screen: the half-plane x/W + y/H <= edge.
 * The polygon reaches far outside the box, so it stays valid for any edge
 * from -1 to 3. RTL mirrors the x axis, so the sweep starts at the top right.
 */
function revealPolygon(edge: number, isRtl: boolean) {
	const points: [number, number][] = [
		[edge + 2, -2],
		[edge - 3, 3],
		[-4, 3],
		[-4, -2],
	];
	return `polygon(${points
		.map(([x, y]) => `${(isRtl ? 1 - x : x) * 100}% ${y * 100}%`)
		.join(", ")})`;
}

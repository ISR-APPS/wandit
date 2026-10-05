/**
 * The closing panel (id "start") of the landing page, the bookend of the hero.
 * pages/landing-page.tsx renders it. A white spark draws itself on entry while
 * tiny app tiles orbit it. The button scrolls up and focuses the hero prompt box.
 */

import { cn } from "@wandit/ui/lib/utils";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

import { SPARK_PATH, Spark } from "@/components/logo";
import { useDictionary } from "@/lib/i18n";

import { CLOSING_PANEL_ID, focusHeroPrompt } from "../lib/scroll";
import { KeycapButton } from "./keycap-button";

type OrbitTile = {
	/** Start position on the ring, in degrees, clockwise from three o'clock. */
	angle: number;
	/** Edge of the tile, in px. */
	size: number;
	/** A filled tile reads as a finished app, an outline as an app on the way. */
	filled: boolean;
};

type Orbit = {
	/** Ring radius, in px, from the center of the spark. */
	radius: number;
	/** Seconds per full turn. Slower rings read as farther away. */
	turnSec: number;
	/** Every second ring turns the other way, so the field does not look rigid. */
	reverse: boolean;
	/** The app tiles that ride this ring. */
	tiles: OrbitTile[];
	/** Start position of a small spark that rides this ring, in degrees. */
	sparkAngle?: number;
};

const ORBITS: Orbit[] = [
	{
		radius: 150,
		turnSec: 60,
		reverse: false,
		tiles: [
			{ angle: 20, size: 18, filled: true },
			{ angle: 140, size: 14, filled: false },
			{ angle: 250, size: 22, filled: false },
		],
	},
	{
		radius: 270,
		turnSec: 95,
		reverse: true,
		sparkAngle: 115,
		tiles: [
			{ angle: 0, size: 28, filled: false },
			{ angle: 70, size: 18, filled: true },
			{ angle: 160, size: 32, filled: false },
			{ angle: 215, size: 14, filled: true },
			{ angle: 300, size: 24, filled: true },
		],
	},
	{
		radius: 410,
		turnSec: 150,
		reverse: false,
		tiles: [
			{ angle: 35, size: 22, filled: true },
			{ angle: 95, size: 34, filled: false },
			{ angle: 150, size: 18, filled: true },
			{ angle: 200, size: 40, filled: false },
			{ angle: 265, size: 20, filled: false },
			{ angle: 330, size: 30, filled: true },
		],
	},
	{
		radius: 580,
		turnSec: 220,
		reverse: true,
		tiles: [
			{ angle: 10, size: 44, filled: false },
			{ angle: 55, size: 26, filled: true },
			{ angle: 125, size: 38, filled: true },
			{ angle: 170, size: 48, filled: false },
			{ angle: 205, size: 24, filled: true },
			{ angle: 240, size: 36, filled: false },
			{ angle: 320, size: 30, filled: true },
		],
	},
];

/** Ember closing panel with the last call to action. */
export function ClosingCta() {
	const closing = useDictionary().landing.closing;
	const panelRef = useRef<HTMLElement>(null);
	const hasEntered = useInView(panelRef, { once: true, amount: 0.35 });
	const isInView = useInView(panelRef);
	const reduceMotion = useReducedMotion();
	// The loops run only on screen. Reduced motion shows the drawn spark at rest.
	const isLooping = isInView && !reduceMotion;

	return (
		<section
			id={CLOSING_PANEL_ID}
			ref={panelRef}
			className="relative mx-2 overflow-hidden rounded-[2rem] bg-ember px-4 py-24 text-white md:mx-3 md:rounded-[2.75rem] md:px-8 md:py-36"
		>
			<div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
				<div className="relative grid size-28 place-items-center md:size-40">
					{/* The orbits are centered on the spark and clipped by the panel. */}
					<div
						aria-hidden
						className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
					>
						{ORBITS.map((orbit) => (
							<div
								key={orbit.radius}
								style={{
									width: orbit.radius * 2,
									height: orbit.radius * 2,
									animationDuration: `${orbit.turnSec}s`,
									animationDirection: orbit.reverse ? "reverse" : "normal",
									animationPlayState: isInView ? "running" : "paused",
								}}
								className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border border-cream/10 motion-reduce:animate-none"
							>
								{orbit.tiles.map((tile) => (
									<span
										key={tile.angle}
										style={{
											width: tile.size,
											height: tile.size,
											transform: `translate(-50%, -50%) rotate(${tile.angle}deg) translateX(${orbit.radius}px) rotate(${-tile.angle}deg)`,
										}}
										className={cn(
											"absolute top-1/2 left-1/2 rounded-[30%]",
											tile.filled
												? "bg-cream/20"
												: "border-[1.5px] border-cream/35",
										)}
									/>
								))}
								{orbit.sparkAngle === undefined ? null : (
									<span
										style={{
											transform: `translate(-50%, -50%) rotate(${orbit.sparkAngle}deg) translateX(${orbit.radius}px)`,
										}}
										className="absolute top-1/2 left-1/2 size-4 text-white"
									>
										<Spark className="size-full" />
									</span>
								)}
							</div>
						))}
					</div>

					{/* The spark breathes while the panel is on screen. The 1.8 s delay lets
					    the draw-in finish first. */}
					<motion.div
						aria-hidden
						animate={
							isLooping && hasEntered ? { scale: [1, 1.07, 1] } : { scale: 1 }
						}
						transition={
							isLooping
								? {
										duration: 3.2,
										delay: 1.8,
										repeat: Number.POSITIVE_INFINITY,
										ease: "easeInOut",
									}
								: { duration: 0.4 }
						}
						// Spark amber is only 2.2:1 on ember, so the marks on this panel are white.
						className="relative size-full text-white"
					>
						<svg
							viewBox="0 0 24 24"
							aria-hidden="true"
							className="size-full overflow-visible"
						>
							<motion.path
								d={SPARK_PATH}
								fill="currentColor"
								stroke="currentColor"
								strokeWidth={0.35}
								strokeLinejoin="round"
								initial={
									reduceMotion ? false : { pathLength: 0, fillOpacity: 0 }
								}
								animate={
									hasEntered ? { pathLength: 1, fillOpacity: 1 } : undefined
								}
								// The outline draws in 1.4 s. The fill starts near the end of it.
								transition={{
									pathLength: { duration: 1.4, ease: [0.65, 0, 0.35, 1] },
									fillOpacity: { delay: 1.1, duration: 0.6 },
								}}
							/>
						</svg>
					</motion.div>
				</div>

				<h2 className="relative mt-12 max-w-[14ch] text-balance font-extrabold text-[clamp(3rem,8.4vw,8.75rem)] leading-[0.92] tracking-[-0.05em] md:mt-16 rtl:leading-[1.3] rtl:tracking-normal">
					{closing.title}
				</h2>
				{/* Small text on ember is night: cream is only 3.2:1 there. */}
				<p className="relative mt-6 flex items-center font-medium text-lg text-night md:mt-8 md:text-2xl">
					{closing.sub}
					{/* The spark caret repeats the hero input: the next step is a sentence.
					    It blinks at 1.1 s per cycle, near the rate of a text caret. */}
					<motion.span
						aria-hidden
						animate={isLooping ? { opacity: [1, 1, 0, 0] } : { opacity: 1 }}
						transition={
							isLooping
								? {
										duration: 1.1,
										times: [0, 0.5, 0.5, 1],
										repeat: Number.POSITIVE_INFINITY,
										ease: "linear",
									}
								: { duration: 0 }
						}
						className="ms-1.5 inline-block h-[1.15em] w-[3px] rounded-full bg-white"
					/>
				</p>
				<KeycapButton
					type="button"
					size="lg"
					onClick={focusHeroPrompt}
					className="relative mt-10 md:mt-12"
				>
					<Spark className="size-5" />
					{closing.cta}
				</KeycapButton>
			</div>
		</section>
	);
}

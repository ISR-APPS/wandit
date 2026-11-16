// A few rose petals in the page gutters of one section. WeddingsSection and ReplySection render it.
// The layer fills its section. The section carries data-scrub="pass", and landing.css moves each petal with --voeu-scrub.
// The petals show from 900px only: below that width the page has no gutter, and a petal must not touch a photo or a text.
import type { CSSProperties } from "react";

/** One petal: its place in % of the section, its size, and its motion. */
type PetalSpot = {
	/** Distance from the start edge, in % of the section width. 0.4 to 1.6, or 95 to 96.5: the gutters only. */
	start: number;
	/** Distance from the top, in % of the section height. */
	top: number;
	/** Size factor of the 30px petal. */
	scale: number;
	/** Rotation at the start of the drift, in degrees. */
	turn: number;
	/** Drift down over the whole scroll of the section, in px. 150 to 290. */
	drift: number;
	/** Extra rotation over the whole drift, in degrees. 70 to 160. */
	spin: number;
};

/** Spots for at most four petals. Seven petals on screen is the limit of the world; one section shows four at most. */
const PETAL_SPOTS: readonly PetalSpot[] = [
	{ start: 1.5, top: 22, scale: 1, turn: -14, drift: 150, spin: 70 },
	{ start: 95.6, top: 17, scale: 0.74, turn: 22, drift: 220, spin: 96 },
	{ start: 0.7, top: 58, scale: 0.86, turn: 8, drift: 290, spin: 122 },
	{ start: 96.1, top: 66, scale: 1.06, turn: -26, drift: 150, spin: 148 },
];

type PetalLayerProps = {
	/** How many petals to draw, 1 to 4. */
	count: number;
};

/** The petal layer. It is aria-hidden and takes no pointer events. */
export function PetalLayer({ count }: PetalLayerProps) {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 hidden overflow-hidden min-[900px]:block"
		>
			{PETAL_SPOTS.slice(0, count).map((spot) => {
				// The CSS variables feed the transform of .voeu-petal in landing.css.
				const place: CSSProperties &
					Record<`--petal-${string}`, string | number> = {
					insetInlineStart: `${spot.start}%`,
					top: `${spot.top}%`,
					"--petal-scale": spot.scale,
					"--petal-turn": `${spot.turn}deg`,
					"--petal-drift": `${spot.drift}px`,
					"--petal-spin": `${spot.spin}deg`,
				};
				return (
					<svg
						key={`${spot.start}-${spot.top}`}
						aria-hidden="true"
						focusable="false"
						viewBox="0 0 26 32"
						className="voeu-petal text-primary"
						style={place}
					>
						<path
							d="M13 31.4C4.6 25.9.8 18.6 1.7 12 2.6 5.2 7.8.6 14.3.6c6 0 10.7 4.3 10.7 10.6 0 7.5-4.6 14.7-12 20.2Z"
							fill="currentColor"
						/>
						<path
							d="M13.4 31C12.2 22 12.9 9.6 14.3 1.4"
							fill="none"
							stroke="var(--background)"
							strokeWidth="1"
							opacity="0.5"
						/>
					</svg>
				);
			})}
		</div>
	);
}

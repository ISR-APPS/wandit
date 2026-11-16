// FIG. 01: the south elevation of Villa Bologhine, a ground floor and two upper floors, at scale 1:100.
// HeroSection renders it. It plots once at page load (the ns-plot-on-load animation of landing.css).
// Order: ground and outline, then the openings and the palm, then the level marks and the height, then the labels.
// The three floors are 3.40 m each: 107 viewBox units per floor, so the height of 10.20 m is 320 units.
// The height dimension sits 80 units out from the level marks, so their labels do not touch it on a phone.
import { useT } from "~/shared/i18n";
import { formatLevel, formatMetres } from "../lib/format";
import { ARROW_MARKER } from "./arrow-marker-defs";

// The y of each floor line, from the ground up, with its level in metres.
const LEVELS = [
	{ y: 440, metres: 0 },
	{ y: 333, metres: 3.4 },
	{ y: 226, metres: 6.8 },
	{ y: 120, metres: 10.2 },
] as const;

// The x of the three window columns. Each window is 70 units wide (2.20 m).
const WINDOW_COLUMNS = [158, 285, 412] as const;

/** The elevation as line art, 680 x 500. The aria-label describes the drawing for a screen reader. */
export function SouthElevation() {
	const { t, locale } = useT();
	return (
		<svg
			role="img"
			aria-label={t("hero.figureLabel")}
			viewBox="0 0 680 500"
			className="ns-drawing ns-text-hero"
		>
			<g className="plot-step plot-a">
				<line
					className="ns-ink-2 plot"
					pathLength={1}
					x1="24"
					y1="440"
					x2="616"
					y2="440"
				/>
				<polyline
					className="ns-ink-2 plot"
					pathLength={1}
					points="130,440 130,120 510,120 510,440"
				/>
				<line
					className="ns-ink-2 plot"
					pathLength={1}
					x1="122"
					y1="120"
					x2="518"
					y2="120"
				/>
				<line
					className="ns-ink-1 fade"
					strokeDasharray="10 6"
					x1="24"
					y1="448"
					x2="616"
					y2="448"
				/>
				<line className="ns-dash fade" x1="130" y1="333" x2="510" y2="333" />
				<line className="ns-dash fade" x1="130" y1="226" x2="510" y2="226" />
			</g>
			<g className="plot-step plot-b">
				{WINDOW_COLUMNS.map((x) => (
					<g key={x}>
						<rect
							className="ns-ink plot"
							pathLength={1}
							x={x}
							y="150"
							width="70"
							height="52"
						/>
						<rect
							className="ns-ink plot"
							pathLength={1}
							x={x}
							y="257"
							width="70"
							height="52"
						/>
						{/* The glazing hatch: two cyan strokes at 35 degrees on each upper window. */}
						<line
							className="ns-hatch plot"
							pathLength={1}
							x1={x + 6}
							y1="196"
							x2={x + 64}
							y2="156"
						/>
						<line
							className="ns-hatch plot"
							pathLength={1}
							x1={x + 18}
							y1="200"
							x2={x + 68}
							y2="166"
						/>
						<line
							className="ns-hatch plot"
							pathLength={1}
							x1={x + 6}
							y1="303"
							x2={x + 64}
							y2="263"
						/>
						<line
							className="ns-hatch plot"
							pathLength={1}
							x1={x + 18}
							y1="307"
							x2={x + 68}
							y2="273"
						/>
					</g>
				))}
				{/* The ground floor: a double door in the middle, a window on each side. */}
				<rect
					className="ns-ink plot"
					pathLength={1}
					x="292"
					y="352"
					width="56"
					height="88"
				/>
				<line
					className="ns-ink-1 plot"
					pathLength={1}
					x1="320"
					y1="352"
					x2="320"
					y2="440"
				/>
				<rect
					className="ns-ink plot"
					pathLength={1}
					x="158"
					y="366"
					width="70"
					height="46"
				/>
				<rect
					className="ns-ink plot"
					pathLength={1}
					x="412"
					y="366"
					width="70"
					height="46"
				/>
				<line
					className="ns-hatch plot"
					pathLength={1}
					x1="164"
					y1="408"
					x2="220"
					y2="370"
				/>
				<line
					className="ns-hatch plot"
					pathLength={1}
					x1="418"
					y1="408"
					x2="474"
					y2="370"
				/>
				{/* The palm of the garden, in cyan: a trunk and five fronds. */}
				<path
					className="ns-cyan plot"
					pathLength={1}
					d="M70,440 C74,400 72,380 76,362"
				/>
				<path
					className="ns-cyan plot"
					pathLength={1}
					d="M76,362 C60,352 46,352 34,360"
				/>
				<path
					className="ns-cyan plot"
					pathLength={1}
					d="M76,362 C64,344 52,338 38,338"
				/>
				<path
					className="ns-cyan plot"
					pathLength={1}
					d="M76,362 C80,342 90,332 104,328"
				/>
				<path
					className="ns-cyan plot"
					pathLength={1}
					d="M76,362 C90,348 104,344 118,348"
				/>
				<path
					className="ns-cyan plot"
					pathLength={1}
					d="M76,362 C72,346 74,336 70,326"
				/>
			</g>
			<g className="plot-step plot-c">
				{LEVELS.map((level) => (
					<g key={level.y}>
						<polyline
							className="ns-ink-1 plot"
							pathLength={1}
							points={`524,${level.y} 532,${level.y - 12} 540,${level.y}`}
						/>
						<line
							className="ns-ink-1 plot"
							pathLength={1}
							x1="518"
							y1={level.y}
							x2="560"
							y2={level.y}
						/>
					</g>
				))}
				<line
					className="ns-ink-1 fade"
					x1="640"
					y1="120"
					x2="640"
					y2="440"
					markerStart={ARROW_MARKER}
					markerEnd={ARROW_MARKER}
				/>
				<line
					className="ns-ink-1 plot"
					pathLength={1}
					x1="632"
					y1="120"
					x2="648"
					y2="120"
				/>
				<line
					className="ns-ink-1 plot"
					pathLength={1}
					x1="632"
					y1="440"
					x2="648"
					y2="440"
				/>
			</g>
			<g className="plot-step plot-labels">
				{LEVELS.map((level) => (
					<text key={level.y} x="544" y={level.y - 6} className="ns-t11">
						{formatLevel(locale, level.metres)}
					</text>
				))}
				<text
					x="664"
					y="280"
					className="ns-t11"
					textAnchor="middle"
					transform="rotate(-90 664 280)"
				>
					{formatMetres(locale, 10.2)}
				</text>
				<text x="130" y="478" className="ns-t11 ns-t-soft uppercase">
					{t("hero.figureScale")}
				</text>
				<text
					x="510"
					y="478"
					className="ns-t11 ns-t-soft uppercase"
					textAnchor="end"
				>
					{t("hero.figureFacade")}
				</text>
			</g>
		</svg>
	);
}

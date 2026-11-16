// The figure of the Lauriers Building sheet: the street elevation at scale 1:250, five levels and a shop at the base.
// SheetsSection renders it inside a ProjectSheet. It plots when the sheet scrolls into view.
// Each level is 50 viewBox units, 3.42 m, so the five levels make the 17.10 m of the vertical dimension.
import { useT } from "~/shared/i18n";
import { formatMetres } from "../lib/format";
import { ARROW_MARKER } from "./arrow-marker-defs";

// The y of the window row of each upper floor, from the top floor down.
const FLOOR_ROWS = [64, 114, 164, 214] as const;
// The x of the four window bays. The last bay is narrow: the stair of the building.
const BAYS = [
	{ x: 106, width: 38 },
	{ x: 162, width: 38 },
	{ x: 218, width: 38 },
	{ x: 274, width: 24 },
] as const;

/** The elevation as line art, 400 x 330. Its narrow viewBox takes the smaller phone text scale of landing.css. */
export function LauriersSheetElevation() {
	const { t, locale } = useT();
	return (
		<svg
			role="img"
			aria-label={t("sheets.lauriersFigure")}
			viewBox="0 0 400 330"
			className="ns-drawing ns-text-narrow"
		>
			<g className="plot-step plot-a">
				<line
					className="ns-ink-2 plot"
					pathLength={1}
					x1="20"
					y1="300"
					x2="380"
					y2="300"
				/>
				<rect
					className="ns-ink-2 plot"
					pathLength={1}
					x="90"
					y="50"
					width="220"
					height="250"
				/>
				{FLOOR_ROWS.map((y) => (
					<line
						key={y}
						className="ns-dash fade"
						x1="90"
						y1={y + 36}
						x2="310"
						y2={y + 36}
					/>
				))}
			</g>
			<g className="plot-step plot-b">
				{FLOOR_ROWS.map((y) =>
					BAYS.map((bay) => (
						<rect
							key={`${y}-${bay.x}`}
							className="ns-ink plot"
							pathLength={1}
							x={bay.x}
							y={y}
							width={bay.width}
							height="24"
						/>
					)),
				)}
				{/* The shop front: one long glazed bay with its hatch. */}
				<rect
					className="ns-cyan plot"
					pathLength={1}
					x="106"
					y="262"
					width="188"
					height="38"
				/>
				{[112, 150, 188, 226].map((x) => (
					<line
						key={x}
						className="ns-hatch plot"
						pathLength={1}
						x1={x}
						y1="296"
						x2={x + 28}
						y2="266"
					/>
				))}
			</g>
			<g className="plot-step plot-c">
				<line
					className="ns-ink-1 plot"
					pathLength={1}
					x1="336"
					y1="50"
					x2="352"
					y2="50"
				/>
				<line
					className="ns-ink-1 plot"
					pathLength={1}
					x1="336"
					y1="300"
					x2="352"
					y2="300"
				/>
				<line
					className="ns-ink-1 fade"
					x1="344"
					y1="50"
					x2="344"
					y2="300"
					markerStart={ARROW_MARKER}
					markerEnd={ARROW_MARKER}
				/>
			</g>
			<g className="plot-step plot-labels">
				<text
					x="362"
					y="175"
					className="ns-t10"
					textAnchor="middle"
					transform="rotate(-90 362 175)"
				>
					{formatMetres(locale, 17.1)}
				</text>
				<text x="90" y="326" className="ns-t10 ns-t-soft uppercase">
					{t("sheets.scale250")}
				</text>
			</g>
		</svg>
	);
}

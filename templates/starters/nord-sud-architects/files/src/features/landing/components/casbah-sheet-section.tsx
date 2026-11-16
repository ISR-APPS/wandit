// The figure of the Casbah Restoration sheet: cross-section AA at scale 1:100 of a two-level Ottoman house.
// SheetsSection renders it in the wide sheet. It plots when the sheet scrolls into view.
// The cut walls and the ground under the ground line carry the cyan 45-degree hatch of a cut (poché).
import { useT } from "~/shared/i18n";
import { formatLevel } from "../lib/format";

// The x of the ground hatch strokes, every 30 units under the ground line.
const GROUND_HATCH = Array.from({ length: 17 }, (_, index) => 20 + index * 30);
// The y of the hatch strokes inside each cut wall, every 30 units.
const WALL_HATCH = [60, 90, 120, 150, 180, 210] as const;

/** The section as line art, 560 x 260. */
export function CasbahSheetSection() {
	const { t, locale } = useT();
	return (
		<svg
			role="img"
			aria-label={t("sheets.casbahFigure")}
			viewBox="0 0 560 260"
			className="ns-drawing"
		>
			<g className="plot-step plot-a">
				<line
					className="ns-ink-2 plot"
					pathLength={1}
					x1="10"
					y1="220"
					x2="550"
					y2="220"
				/>
				<rect
					className="ns-ink-2 plot"
					pathLength={1}
					x="110"
					y="40"
					width="14"
					height="180"
				/>
				<rect
					className="ns-ink-2 plot"
					pathLength={1}
					x="420"
					y="40"
					width="14"
					height="180"
				/>
				<line
					className="ns-ink-2 plot"
					pathLength={1}
					x1="110"
					y1="40"
					x2="434"
					y2="40"
				/>
				<line
					className="ns-ink-2 plot"
					pathLength={1}
					x1="124"
					y1="130"
					x2="420"
					y2="130"
				/>
			</g>
			<g className="plot-step plot-b">
				{GROUND_HATCH.map((x) => (
					<line
						key={x}
						className="ns-hatch plot"
						pathLength={1}
						x1={x}
						y1="238"
						x2={x + 18}
						y2="222"
					/>
				))}
				{WALL_HATCH.map((y) => (
					<g key={y}>
						<line
							className="ns-hatch plot"
							pathLength={1}
							x1="111"
							y1={y}
							x2="123"
							y2={y - 12}
						/>
						<line
							className="ns-hatch plot"
							pathLength={1}
							x1="421"
							y1={y}
							x2="433"
							y2={y - 12}
						/>
					</g>
				))}
				{/* The stair from the ground floor to the upper floor, drawn as five simplified steps. */}
				<polyline
					className="ns-ink plot"
					pathLength={1}
					points="200,220 200,202 220,202 220,184 240,184 240,166 260,166 260,148 280,148 280,130"
				/>
				<line className="ns-dash fade" x1="124" y1="76" x2="420" y2="76" />
			</g>
			<g className="plot-step plot-c">
				<polyline
					className="ns-ink-1 plot"
					pathLength={1}
					points="470,220 478,208 486,220"
				/>
				<line
					className="ns-ink-1 plot"
					pathLength={1}
					x1="464"
					y1="220"
					x2="500"
					y2="220"
				/>
			</g>
			<g className="plot-step plot-labels">
				<text x="492" y="204" className="ns-t10">
					{formatLevel(locale, 0)}
				</text>
				<text x="18" y="254" className="ns-t10 ns-t-soft uppercase">
					{t("sheets.casbahSection")}
				</text>
			</g>
		</svg>
	);
}

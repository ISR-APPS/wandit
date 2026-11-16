// The figure of the Villa Bologhine sheet: a simplified plan at scale 1:200 with the patio and a 12.40 m dimension.
// SheetsSection renders it inside a ProjectSheet. It plots when the sheet scrolls into view.
// 380 viewBox units are 12.40 m, so the 230 units of depth are 7.50 m.
import { useT } from "~/shared/i18n";
import { formatMetres } from "../lib/format";
import { ARROW_MARKER } from "./arrow-marker-defs";

/** The plan as line art, 520 x 330. */
export function BologhineSheetPlan() {
	const { t, locale } = useT();
	return (
		<svg
			role="img"
			aria-label={t("sheets.bologhineFigure")}
			viewBox="0 0 520 330"
			className="ns-drawing"
		>
			<g className="plot-step plot-a">
				<rect
					className="ns-wall-4 plot"
					pathLength={1}
					x="70"
					y="60"
					width="380"
					height="230"
				/>
				<polyline
					className="ns-ink-2 plot"
					pathLength={1}
					points="240,60 240,180 450,180"
				/>
			</g>
			<g className="plot-step plot-b">
				<line
					className="ns-ink plot"
					pathLength={1}
					x1="120"
					y1="57"
					x2="190"
					y2="57"
				/>
				<line
					className="ns-ink plot"
					pathLength={1}
					x1="120"
					y1="63"
					x2="190"
					y2="63"
				/>
				<line
					className="ns-ink plot"
					pathLength={1}
					x1="300"
					y1="287"
					x2="370"
					y2="287"
				/>
				<line
					className="ns-ink plot"
					pathLength={1}
					x1="300"
					y1="293"
					x2="370"
					y2="293"
				/>
				<circle
					className="ns-cyan plot"
					pathLength={1}
					cx="150"
					cy="240"
					r="24"
				/>
				<rect
					className="ns-cyan plot"
					pathLength={1}
					x="260"
					y="80"
					width="120"
					height="30"
				/>
				<rect
					className="ns-cyan plot"
					pathLength={1}
					x="96"
					y="90"
					width="34"
					height="100"
				/>
				<rect className="ns-dash fade" x="300" y="212" width="90" height="50" />
			</g>
			<g className="plot-step plot-c">
				<line
					className="ns-ink-1 plot"
					pathLength={1}
					x1="70"
					y1="26"
					x2="70"
					y2="42"
				/>
				<line
					className="ns-ink-1 plot"
					pathLength={1}
					x1="450"
					y1="26"
					x2="450"
					y2="42"
				/>
				<line
					className="ns-ink-1 fade"
					x1="70"
					y1="34"
					x2="450"
					y2="34"
					markerStart={ARROW_MARKER}
					markerEnd={ARROW_MARKER}
				/>
			</g>
			<g className="plot-step plot-labels">
				<text x="260" y="26" className="ns-t11" textAnchor="middle">
					{formatMetres(locale, 12.4)}
				</text>
				<text
					x="345"
					y="242"
					className="ns-t10 ns-t-soft uppercase"
					textAnchor="middle"
				>
					{t("sheets.bologhinePatio")}
				</text>
				<text x="70" y="316" className="ns-t10 ns-t-soft uppercase">
					{t("sheets.scale200")}
				</text>
			</g>
		</svg>
	);
}

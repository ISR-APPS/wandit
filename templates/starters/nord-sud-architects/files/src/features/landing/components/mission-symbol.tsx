// The drawn symbol cell of one mission row: a set square, a door swing, a detail circle, or a level mark.
// MissionRow renders it. Each symbol is 44 x 36 of line art; its strokes turn cyan when the row is hovered.
import type { Mission } from "../lib/content";

type MissionSymbolProps = {
	symbol: Mission["symbol"];
};

/** Decorative line art. The row name says the same, so the symbol is hidden from screen readers. */
export function MissionSymbol({ symbol }: MissionSymbolProps) {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 44 36"
			className="ns-symbol h-9 w-11 overflow-visible"
		>
			<g className="plot-step plot-lines">
				{symbol === "set-square" && (
					<>
						<polygon
							className="ns-ink-2 plot"
							pathLength={1}
							points="4,32 40,32 40,6"
						/>
						<polygon
							className="ns-ink plot"
							pathLength={1}
							points="14,28 33,28 33,15"
						/>
					</>
				)}
				{symbol === "door-swing" && (
					<>
						<line
							className="ns-ink-2 plot"
							pathLength={1}
							x1="6"
							y1="30"
							x2="6"
							y2="6"
						/>
						<line
							className="ns-ink-2 plot"
							pathLength={1}
							x1="30"
							y1="30"
							x2="40"
							y2="30"
						/>
					</>
				)}
				{symbol === "detail-circle" && (
					<>
						<circle
							className="ns-ink-2 plot"
							pathLength={1}
							cx="16"
							cy="18"
							r="12"
						/>
						<circle
							className="ns-ink plot"
							pathLength={1}
							cx="16"
							cy="18"
							r="4"
						/>
						<line
							className="ns-ink plot"
							pathLength={1}
							x1="26"
							y1="10"
							x2="42"
							y2="4"
						/>
					</>
				)}
				{symbol === "level-mark" && (
					<>
						<polyline
							className="ns-ink-2 plot"
							pathLength={1}
							points="14,22 22,10 30,22"
						/>
						<line
							className="ns-ink-2 plot"
							pathLength={1}
							x1="6"
							y1="22"
							x2="38"
							y2="22"
						/>
					</>
				)}
			</g>
			{/* Dashed strokes fade in: a dash pattern cannot also draw by dash offset. */}
			<g className="plot-step plot-soft">
				{symbol === "door-swing" && (
					<path
						className="ns-ink fade"
						strokeDasharray="4 3"
						d="M6,6 A24,24 0 0 1 30,30"
					/>
				)}
				{symbol === "level-mark" && (
					<line
						className="ns-ink fade"
						strokeDasharray="5 4"
						x1="6"
						y1="28"
						x2="38"
						y2="28"
					/>
				)}
			</g>
		</svg>
	);
}

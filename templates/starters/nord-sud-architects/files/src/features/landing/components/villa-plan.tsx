// The showpiece: the ground floor plan of Villa Bologhine at scale 1:100, in the plotter order.
// PlanSection renders it inside the stage that carries --plot. Each group has a plan-* window of landing.css.
// Scale: 680 viewBox units are 12.40 m, about 55 units per metre. The room areas match the walls.
// Walls are 6 units thick outside and 4 inside. Openings are gaps with a double glazing line.
import { useT } from "~/shared/i18n";
import { formatArea, formatMetres } from "../lib/format";
import { ARROW_MARKER } from "./arrow-marker-defs";

/** One room label: the name and the area under it, both centered on x. */
type RoomLabel = {
	name: "plan.living" | "plan.kitchen" | "plan.bedroom";
	x: number;
	y: number;
	/** The floor area inside the walls, in square metres. */
	area: number;
};

const ROOMS: readonly RoomLabel[] = [
	{ name: "plan.living", x: 330, y: 300, area: 56.2 },
	{ name: "plan.kitchen", x: 668, y: 210, area: 27.2 },
	{ name: "plan.bedroom", x: 612, y: 448, area: 19.4 },
];

// A wall, a glazing line, or an extension line: [x1, y1, x2, y2] in viewBox units.
type Segment = readonly [number, number, number, number];
// A rectangle of furniture: [x, y, width, height].
type Box = readonly [number, number, number, number];
// A round piece of furniture: [cx, cy, r].
type Disc = readonly [number, number, number];

// Outer walls, with gaps for the five windows and the entrance door.
const OUTER_WALLS: readonly Segment[] = [
	[140, 80, 300, 80],
	[380, 80, 600, 80],
	[690, 80, 820, 80],
	[820, 80, 820, 250],
	[820, 330, 820, 560],
	[820, 560, 720, 560],
	[640, 560, 510, 560],
	[430, 560, 140, 560],
	[140, 560, 140, 280],
	[140, 200, 140, 80],
];

// Partitions: the kitchen and the bedroom on the east side, the bathroom in the south-west corner.
const INNER_WALLS: readonly Segment[] = [
	[520, 80, 520, 200],
	[520, 270, 520, 360],
	[520, 360, 600, 360],
	[670, 360, 820, 360],
	[140, 460, 170, 460],
	[225, 460, 240, 460],
	[240, 460, 240, 560],
];

// Windows: two parallel lines across each wall gap, 3 units each side of the wall axis.
const WINDOWS: readonly Segment[] = [
	[300, 77, 380, 77],
	[300, 83, 380, 83],
	[600, 77, 690, 77],
	[600, 83, 690, 83],
	[817, 250, 817, 330],
	[823, 250, 823, 330],
	[640, 557, 720, 557],
	[640, 563, 720, 563],
	[137, 200, 137, 280],
	[143, 200, 143, 280],
];

// Doors: the leaf line, then the dashed quarter-circle swing that closes on the wall.
const DOORS: readonly { leaf: Segment; swing: string }[] = [
	{ leaf: [430, 560, 430, 485], swing: "M430,485 A75,75 0 0 1 505,560" },
	{ leaf: [520, 200, 450, 200], swing: "M450,200 A70,70 0 0 0 520,270" },
	{ leaf: [670, 360, 670, 290], swing: "M670,290 A70,70 0 0 0 600,360" },
	{ leaf: [225, 460, 225, 405], swing: "M225,405 A55,55 0 0 0 170,460" },
];

// Living room: the corner sofa, the low table, the dining table with four chairs, the console, a corner fixture.
const LIVING_BOXES: readonly Box[] = [
	[180, 130, 170, 45],
	[180, 130, 45, 140],
	[300, 515, 120, 18],
];
const LIVING_DISCS: readonly Disc[] = [
	[310, 250, 26],
	[380, 405, 38],
	[380, 353, 9],
	[380, 457, 9],
	[328, 405, 9],
	[432, 405, 9],
	[166, 106, 13],
];

// Furniture of the kitchen, the bedroom, and the bathroom: worktop, hob, sink, bed, shower tray, toilet.
const SERVICE_BOXES: readonly Box[] = [
	[540, 95, 265, 38],
	[774, 145, 34, 34],
	[690, 405, 115, 140],
	[655, 405, 26, 26],
	[535, 470, 28, 80],
	[146, 466, 42, 42],
];
const SERVICE_DISCS: readonly Disc[] = [
	[755, 114, 11],
	[755, 114, 4.5],
	[592, 107, 6],
	[612, 107, 6],
	[592, 122, 6],
	[612, 122, 6],
	[546, 332, 11],
	[212, 536, 9],
];
// The pillow line of the bed and the diagonal of the shower tray.
const SERVICE_LINES: readonly Segment[] = [
	[690, 435, 805, 435],
	[146, 466, 188, 508],
];

// Extension lines: short ticks from the envelope out to each dimension line.
const EXTENSIONS: readonly Segment[] = [
	[140, 72, 140, 36],
	[820, 72, 820, 36],
	[132, 80, 96, 80],
	[132, 560, 96, 560],
	[520, 568, 520, 604],
	[820, 568, 820, 604],
	[828, 80, 864, 80],
	[828, 360, 864, 360],
];
// Dimension lines with an arrowhead at each end: 12.40 m wide, 8.60 m deep, then the east rooms.
const DIMENSIONS: readonly Segment[] = [
	[140, 44, 820, 44],
	[104, 80, 104, 560],
	[520, 596, 820, 596],
	[856, 80, 856, 360],
];

/** Renders segments as plotted lines. pathLength 1 lets the plot-step window of landing.css draw each one. */
function plotLines(segments: readonly Segment[], className: string) {
	return segments.map(([x1, y1, x2, y2]) => (
		<line
			key={`${x1}-${y1}-${x2}-${y2}`}
			className={`${className} plot`}
			pathLength={1}
			x1={x1}
			y1={y1}
			x2={x2}
			y2={y2}
		/>
	));
}

/** Renders furniture rectangles as plotted cyan outlines. */
function plotBoxes(boxes: readonly Box[]) {
	return boxes.map(([x, y, width, height]) => (
		<rect
			key={`${x}-${y}-${width}-${height}`}
			className="ns-cyan plot"
			pathLength={1}
			x={x}
			y={y}
			width={width}
			height={height}
		/>
	));
}

/** Renders round furniture as plotted cyan circles. */
function plotDiscs(discs: readonly Disc[]) {
	return discs.map(([cx, cy, r]) => (
		<circle
			key={`${cx}-${cy}-${r}`}
			className="ns-cyan plot"
			pathLength={1}
			cx={cx}
			cy={cy}
			r={r}
		/>
	));
}

/** The plan as line art, 920 x 700. Its aria-label describes the drawing for a screen reader. */
export function VillaPlan() {
	const { t, locale } = useT();
	return (
		<svg
			role="img"
			aria-label={t("plan.figureLabel")}
			viewBox="0 0 920 700"
			className="ns-drawing ns-text-plan"
		>
			<g className="plot-step plan-walls-outer">
				{plotLines(OUTER_WALLS, "ns-wall")}
			</g>
			<g className="plot-step plan-walls-inner">
				{plotLines(INNER_WALLS, "ns-wall-4")}
			</g>
			<g className="plot-step plan-windows">{plotLines(WINDOWS, "ns-ink")}</g>
			<g className="plot-step plan-doors">
				{DOORS.map((door) => (
					<g key={door.swing}>
						{plotLines([door.leaf], "ns-ink")}
						<path className="ns-dash fade" d={door.swing} />
					</g>
				))}
			</g>
			<g className="plot-step plan-furniture-a">
				{plotBoxes(LIVING_BOXES)}
				{plotDiscs(LIVING_DISCS)}
				{/* The inner curve of the corner fixture at (166, 106). */}
				<path
					className="ns-cyan plot"
					pathLength={1}
					d="M158,102 C162,110 170,110 174,102"
				/>
			</g>
			<g className="plot-step plan-furniture-b">
				{plotBoxes(SERVICE_BOXES)}
				{plotDiscs(SERVICE_DISCS)}
				{plotLines(SERVICE_LINES, "ns-cyan")}
			</g>
			<g className="plot-step plan-dimensions">
				{plotLines(EXTENSIONS, "ns-ink-1")}
				{/* The dimension lines fade in: a marker does not follow a dash offset. */}
				{DIMENSIONS.map(([x1, y1, x2, y2]) => (
					<line
						key={`${x1}-${y1}-${x2}-${y2}`}
						className="ns-ink-1 fade"
						x1={x1}
						y1={y1}
						x2={x2}
						y2={y2}
						markerStart={ARROW_MARKER}
						markerEnd={ARROW_MARKER}
					/>
				))}
				<text x="480" y="34" className="ns-t13" textAnchor="middle">
					{formatMetres(locale, 12.4)}
				</text>
				<text
					x="90"
					y="320"
					className="ns-t13"
					textAnchor="middle"
					transform="rotate(-90 90 320)"
				>
					{formatMetres(locale, 8.6)}
				</text>
				<text x="670" y="588" className="ns-t13" textAnchor="middle">
					{formatMetres(locale, 5.45)}
				</text>
				<text
					x="874"
					y="220"
					className="ns-t13"
					textAnchor="middle"
					transform="rotate(-90 874 220)"
				>
					{formatMetres(locale, 5.1)}
				</text>
			</g>
			{/* The room schedule: names first, then the areas and the sheet labels. */}
			<g className="plot-step plan-rooms">
				{ROOMS.map((room) => (
					<text
						key={room.name}
						x={room.x}
						y={room.y}
						className="ns-t15 uppercase"
						textAnchor="middle"
					>
						{t(room.name)}
					</text>
				))}
				{/* The bath label sits under the shower tray and beside the toilet: the free floor of the room. */}
				<text x="172" y="534" className="ns-t10 uppercase" textAnchor="middle">
					{t("plan.bath")}
				</text>
				<text x="467" y="548" className="ns-t10 uppercase" textAnchor="middle">
					{t("plan.entry")}
				</text>
			</g>
			<g className="plot-step plan-areas">
				{/* The offset is in em, so the area moves down when the phone text grows. */}
				{ROOMS.map((room) => (
					<text
						key={room.name}
						x={room.x}
						y={room.y}
						dy="1.7em"
						className="ns-t12 ns-t-soft"
						textAnchor="middle"
					>
						{formatArea(locale, room.area)}
					</text>
				))}
				<text
					x="172"
					y="534"
					dy="1.3em"
					className="ns-plan-bath-area ns-t10 ns-t-soft"
					textAnchor="middle"
				>
					{formatArea(locale, 3.2)}
				</text>
				<text x="140" y="684" className="ns-t12 ns-t-soft uppercase">
					{t("plan.scale")}
				</text>
				<text
					x="820"
					y="684"
					className="ns-t12 ns-t-soft uppercase"
					textAnchor="end"
				>
					{t("plan.sheetTitle")}
				</text>
			</g>
			{/* The red pencil: a ring around the entrance joinery, an arrow, and the note. The sheet labels stay the last row. */}
			<g className="plot-step plan-markup-ring">
				<path
					className="ns-red plot"
					pathLength={1}
					d="M415,545 C410,510 448,498 486,506 C524,514 534,548 514,568 C494,588 430,586 418,564 C412,553 413,549 415,545"
				/>
			</g>
			<g className="plot-step plan-markup-arrow">
				<path
					className="ns-red ns-red-thin plot"
					pathLength={1}
					d="M360,614 C384,608 414,600 436,592"
				/>
				<path
					className="ns-red ns-red-thin plot"
					pathLength={1}
					d="M425,590 L436,592 L429,600.5"
				/>
			</g>
			<g className="plot-step plan-markup-note">
				<text x="140" y="634" className="ns-t12 ns-t-red">
					{t("plan.markup")}
				</text>
			</g>
		</svg>
	);
}

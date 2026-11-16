// The two-tone spot drawings of the page: blue lines and sky fills, objects only.
// ProductSection shows one for each verb. ContactSection shows the speech bubble.
// Each drawing sits on a soft panel, so it has presence in its column.
import type { ReactNode } from "react";
import { cn } from "~/shared/lib/utils";

type SpotScene = "invoice" | "payment" | "ledger" | "reply";

// The shared marks. Every stroke is the page blue, 2.5 units wide, with round ends.
const LINE =
	"fill-none stroke-primary [stroke-linecap:round] [stroke-linejoin:round]";
const PAPER = "fill-card stroke-primary";
const SKY = "fill-(--fw-sky)";
const SKY_LINE = "fill-(--fw-sky) stroke-primary";
const TEXT_ROW = "fill-(--fw-dash)";
const DEEP_TICK =
	"fill-none stroke-(--fw-blue-deep) [stroke-linecap:round] [stroke-linejoin:round]";

/** One drawing: the box of its coordinates and its shapes. The first shape is the soft panel. */
type SpotDrawing = {
	/** The SVG viewBox, for example "0 0 280 220". */
	viewBox: string;
	/** The size of the soft panel behind the shapes. */
	panel: { x: number; y: number; width: number; height: number; rx: number };
	/** The SVG shapes of the scene, drawn over the panel. */
	shapes: ReactNode;
};

const DRAWINGS: Record<SpotScene, SpotDrawing> = {
	// An invoice with a sky header band, three text rows, a total, and its round stamp.
	invoice: {
		viewBox: "0 0 280 220",
		panel: { x: 10, y: 12, width: 260, height: 196, rx: 26 },
		shapes: (
			<>
				<rect
					x="72"
					y="18"
					width="140"
					height="184"
					rx="14"
					strokeWidth="2.5"
					className={PAPER}
				/>
				<path
					d="M72 32c0-7.7 6.3-14 14-14h112c7.7 0 14 6.3 14 14v26H72V32z"
					className={SKY}
				/>
				<rect
					x="88"
					y="32"
					width="64"
					height="8"
					rx="4"
					className="fill-primary"
				/>
				<rect
					x="88"
					y="76"
					width="104"
					height="7"
					rx="3.5"
					className={TEXT_ROW}
				/>
				<rect
					x="88"
					y="94"
					width="104"
					height="7"
					rx="3.5"
					className={TEXT_ROW}
				/>
				<rect
					x="88"
					y="112"
					width="72"
					height="7"
					rx="3.5"
					className={TEXT_ROW}
				/>
				<rect
					x="132"
					y="140"
					width="60"
					height="8"
					rx="4"
					className="fill-primary"
				/>
				<circle
					cx="96"
					cy="168"
					r="26"
					strokeWidth="2.5"
					className={SKY_LINE}
				/>
				<circle
					cx="96"
					cy="168"
					r="16"
					strokeWidth="2"
					strokeDasharray="4 5"
					className={LINE}
				/>
				<path d="M88 168l6 6 11-12" strokeWidth="2.5" className={LINE} />
				<path
					d="M224 70l22-22M238 84l22-22M232 100l14-4"
					strokeWidth="2.5"
					className={LINE}
				/>
			</>
		),
	},
	// A phone that confirms a payment, with a coin beside it.
	payment: {
		viewBox: "0 0 280 220",
		panel: { x: 10, y: 12, width: 260, height: 196, rx: 26 },
		shapes: (
			<>
				<rect
					x="98"
					y="20"
					width="94"
					height="176"
					rx="18"
					strokeWidth="2.5"
					className={PAPER}
				/>
				<rect x="126" y="32" width="38" height="6" rx="3" className={SKY} />
				<circle
					cx="145"
					cy="92"
					r="30"
					strokeWidth="2.5"
					className={SKY_LINE}
				/>
				<path d="M133 92l8 8 16-17" strokeWidth="3" className={DEEP_TICK} />
				<rect
					x="118"
					y="138"
					width="54"
					height="7"
					rx="3.5"
					className={TEXT_ROW}
				/>
				<rect
					x="118"
					y="154"
					width="38"
					height="7"
					rx="3.5"
					className={TEXT_ROW}
				/>
				<circle
					cx="222"
					cy="164"
					r="26"
					strokeWidth="2.5"
					className={SKY_LINE}
				/>
				<circle cx="222" cy="164" r="15" strokeWidth="2" className={LINE} />
				<path d="M222 156v16M216 164h12" strokeWidth="2" className={LINE} />
				<path
					d="M62 58l14 8M56 84h16M62 110l14-8"
					strokeWidth="2.5"
					className={LINE}
				/>
			</>
		),
	},
	// An accounts ledger with two page tabs, and a calculator.
	ledger: {
		viewBox: "0 0 280 220",
		panel: { x: 10, y: 12, width: 260, height: 196, rx: 26 },
		shapes: (
			<>
				<rect x="174" y="56" width="20" height="30" rx="6" className={SKY} />
				<rect
					x="52"
					y="36"
					width="122"
					height="156"
					rx="12"
					strokeWidth="2.5"
					className={PAPER}
				/>
				<path
					d="M74 38v152"
					strokeWidth="6"
					className="fill-none stroke-(--fw-sky)"
				/>
				<rect
					x="90"
					y="60"
					width="66"
					height="7"
					rx="3.5"
					className="fill-primary"
				/>
				<rect x="90" y="82" width="66" height="6" rx="3" className={TEXT_ROW} />
				<rect x="90" y="98" width="66" height="6" rx="3" className={TEXT_ROW} />
				<rect
					x="90"
					y="114"
					width="46"
					height="6"
					rx="3"
					className={TEXT_ROW}
				/>
				<rect
					x="90"
					y="152"
					width="66"
					height="7"
					rx="3.5"
					className="fill-primary"
				/>
				<rect
					x="182"
					y="104"
					width="76"
					height="96"
					rx="12"
					strokeWidth="2.5"
					className={SKY_LINE}
				/>
				<rect
					x="194"
					y="116"
					width="52"
					height="20"
					rx="6"
					className="fill-card"
				/>
				<circle cx="202" cy="154" r="7" className="fill-card" />
				<circle cx="220" cy="154" r="7" className="fill-card" />
				<circle cx="238" cy="154" r="7" className="fill-card" />
				<circle cx="202" cy="176" r="7" className="fill-card" />
				<circle cx="220" cy="176" r="7" className="fill-card" />
				<circle cx="238" cy="176" r="7" className="fill-primary" />
			</>
		),
	},
	// A confirmed speech bubble and a clock: a reply in under an hour.
	reply: {
		viewBox: "0 0 240 170",
		panel: { x: 6, y: 6, width: 228, height: 158, rx: 22 },
		shapes: (
			<>
				<rect
					x="30"
					y="24"
					width="150"
					height="92"
					rx="20"
					strokeWidth="2.5"
					className={SKY_LINE}
				/>
				<path
					d="M70 114.5l-8 27.5 32-27.5"
					strokeWidth="2.5"
					className={`${SKY_LINE} [stroke-linejoin:round]`}
				/>
				<path d="M78 70l14 14 26-28" strokeWidth="4" className={DEEP_TICK} />
				<circle cx="196" cy="118" r="26" strokeWidth="2.5" className={PAPER} />
				<path d="M196 104v14l9 6" strokeWidth="2.5" className={LINE} />
			</>
		),
	},
};

type SpotIllustrationProps = {
	/** Which of the four drawings to show. */
	scene: SpotScene;
	/** The translated text that a screen reader says for the drawing. */
	label: string;
	/** "sky" is the panel on white paper. "paper" is the white panel on a sky pool. */
	panelTone: "sky" | "paper";
	/** Size classes of the drawing. */
	className?: string;
};

/** The drawing fills the width of its box and keeps the ratio of its viewBox. */
export function SpotIllustration({
	scene,
	label,
	panelTone,
	className,
}: SpotIllustrationProps) {
	const { viewBox, panel, shapes } = DRAWINGS[scene];
	return (
		<svg
			viewBox={viewBox}
			role="img"
			aria-label={label}
			className={cn("block h-auto w-full", className)}
		>
			<rect
				{...panel}
				className={panelTone === "sky" ? "fill-(--fw-sky-soft)" : "fill-card"}
			/>
			{shapes}
		</svg>
	);
}

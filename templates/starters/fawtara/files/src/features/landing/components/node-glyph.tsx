// The small two-tone glyphs of the money-path nodes: shop, customer, bank, and accountant.
// PathDiagram and PathRail render one beside each node title.
import type { ReactNode } from "react";

// The product node has no entry here: it uses BrandGlyph.
type NodeGlyphName = "shop" | "customer" | "bank" | "accountant";

const LINE =
	"fill-none stroke-primary [stroke-linecap:round] [stroke-linejoin:round]";
const SKY_LINE = "fill-(--fw-sky) stroke-primary [stroke-linejoin:round]";

// Each glyph is drawn on a 20 by 20 grid.
const GLYPHS: Record<NodeGlyphName, ReactNode> = {
	shop: (
		<>
			<path d="M3 8l1.4-4.5h11.2L17 8" strokeWidth="1.6" className={SKY_LINE} />
			<path d="M4 8v8h12V8" strokeWidth="1.6" className={LINE} />
			<rect
				x="8"
				y="11"
				width="4"
				height="5"
				strokeWidth="1.4"
				className={SKY_LINE}
			/>
		</>
	),
	customer: (
		<>
			<rect
				x="5"
				y="2"
				width="10"
				height="16"
				rx="2.5"
				strokeWidth="1.6"
				className={SKY_LINE}
			/>
			<path d="M8 14h4" strokeWidth="1.6" className={LINE} />
		</>
	),
	bank: (
		<>
			<path d="M2 8l8-5 8 5" strokeWidth="1.6" className={SKY_LINE} />
			<path
				d="M4 8v7M8.7 8v7M13.4 8v7M16 8v7M2.5 16.5h15"
				strokeWidth="1.6"
				className={LINE}
			/>
		</>
	),
	accountant: (
		<>
			<rect
				x="3"
				y="2"
				width="14"
				height="16"
				rx="2.5"
				strokeWidth="1.6"
				className="fill-card stroke-primary"
			/>
			<path
				d="M6.5 3v14"
				strokeWidth="2.4"
				className="fill-none stroke-(--fw-sky)"
			/>
			<path
				d="M9.5 6.5h5M9.5 10h5M9.5 13.5h3"
				strokeWidth="1.5"
				className={LINE}
			/>
		</>
	),
};

type NodeGlyphProps = {
	/** Which node the glyph stands for. */
	name: NodeGlyphName;
};

/** 20px wide. Decorative: the node title beside it carries the meaning. */
export function NodeGlyph({ name }: NodeGlyphProps) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 20 20"
			aria-hidden="true"
			className="shrink-0"
		>
			{GLYPHS[name]}
		</svg>
	);
}

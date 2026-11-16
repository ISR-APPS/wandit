// The drawn glyph of Fawtara: a blue rounded square with a white check.
// BrandMark and the product node of PathDiagram render it. public/favicon.svg holds the same drawing.
type BrandGlyphProps = {
	/** Size classes of the glyph, for example "size-7". */
	className?: string;
};

/** Decorative: the wordmark beside it carries the name, so the glyph is hidden from screen readers. */
export function BrandGlyph({ className }: BrandGlyphProps) {
	return (
		<svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
			<rect
				x="4"
				y="4"
				width="56"
				height="56"
				rx="16"
				className="fill-primary"
			/>
			<path
				d="M20 34l8 8 16-18"
				strokeWidth="6"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="fill-none stroke-primary-foreground"
			/>
		</svg>
	);
}

// The drawn check of the page: a sky disc with a deep blue tick.
// CheckList renders it before each claim. It replaces an icon font.
type CheckGlyphProps = {
	/** Layout classes, for example a top margin that puts the disc on the first text line. */
	className?: string;
};

/** 20px wide. Decorative: the text beside it carries the meaning. */
export function CheckGlyph({ className }: CheckGlyphProps) {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 20 20"
			aria-hidden="true"
			className={className}
		>
			<circle cx="10" cy="10" r="9" className="fill-(--fw-sky)" />
			<path
				d="M6 10.2l2.6 2.6L14 7.4"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="fill-none stroke-(--fw-blue-deep)"
			/>
		</svg>
	);
}

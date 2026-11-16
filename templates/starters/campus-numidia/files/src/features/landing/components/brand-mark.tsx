// The timetable glyph of the wordmark: a sky square with two stacked bars, sand and white.
// SiteHeader renders it next to the college name. Colors come from the tokens and landing.css.

/** 26px glyph. Decorative: the link around it carries the name. */
export function BrandMark() {
	return (
		<svg viewBox="0 0 26 26" aria-hidden="true" className="size-6.5 flex-none">
			<rect width="26" height="26" rx="6" className="fill-primary" />
			<rect
				x="5"
				y="6"
				width="16"
				height="4"
				rx="2"
				className="fill-(--cn-sand)"
			/>
			<rect
				x="5"
				y="13"
				width="11"
				height="4"
				rx="2"
				className="fill-background"
			/>
			<rect
				x="5"
				y="20"
				width="6"
				height="2.5"
				rx="1.25"
				className="fill-background/60"
			/>
		</svg>
	);
}

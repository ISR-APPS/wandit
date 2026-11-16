// The dot-screen bank of the Le Kiosque plates: three halftone densities that every drawn plate fills from.
// LandingPage renders it once, before the sections. The plates reference the patterns by id ("url(#ks-ht-m)").
// Dots are ink and the cell is paper, both from the theme tokens. The showpiece keeps its own developing bank.

/** The ids of the three densities: light for paper tones, mid for greys, dense for shadows and backgrounds. */
export const HALFTONE = {
	light: "url(#ks-ht-l)",
	mid: "url(#ks-ht-m)",
	dense: "url(#ks-ht-d)",
} as const;

// A 6px cell turned 15°, as a press screen. The three radii give the three tones.
const DENSITIES = [
	{ id: "ks-ht-l", radius: 0.9 },
	{ id: "ks-ht-m", radius: 1.5 },
	{ id: "ks-ht-d", radius: 2.05 },
] as const;

/** A zero-size SVG that only holds the patterns. display:none would break the patterns in some browsers. */
export function HalftoneDefs() {
	return (
		<svg
			width="0"
			height="0"
			className="absolute"
			aria-hidden="true"
			focusable="false"
		>
			<defs>
				{DENSITIES.map((density) => (
					<pattern
						key={density.id}
						id={density.id}
						width="6"
						height="6"
						patternUnits="userSpaceOnUse"
						patternTransform="rotate(15)"
					>
						<rect width="6" height="6" className="fill-background" />
						<circle
							cx="3"
							cy="3"
							r={density.radius}
							className="fill-foreground"
						/>
					</pattern>
				))}
			</defs>
		</svg>
	);
}

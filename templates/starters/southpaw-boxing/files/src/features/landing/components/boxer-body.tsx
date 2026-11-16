// The body shapes of the poster boxer, as polygons in the 520 by 540 space of the figure.
// boxer-figure.tsx draws them three times: the mass, the halftone skin, and the rim light.

/** No fill of its own: the class or the `fill` of the caller paints it. */
export function BoxerBody({
	className,
	fill,
}: {
	className?: string;
	fill?: string;
}) {
	return (
		<g className={className} fill={fill}>
			{/* neck, torso */}
			<polygon points="292,128 322,130 326,148 288,146" />
			<polygon points="262,150 346,162 334,296 256,286" />
			{/* lead arm */}
			<polygon points="268,152 276,190 196,184 194,154" />
			<polygon points="196,152 196,186 138,176 138,154" />
			{/* rear arm */}
			<polygon points="326,164 352,172 362,228 336,234" />
			<polygon points="320,164 344,158 362,226 336,230" />
			<circle cx="308" cy="102" r="30" />
			{/* trunks */}
			<polygon points="250,284 340,296 332,372 240,360" />
			{/* lead leg */}
			<polygon points="246,358 300,364 226,446 192,428" />
			<polygon points="194,426 226,444 200,504 172,494" />
			<polygon points="164,490 202,502 198,520 118,518 120,504" />
			{/* rear leg */}
			<polygon points="298,364 336,368 372,446 338,456" />
			<polygon points="340,452 370,442 396,506 368,514" />
			<polygon points="364,506 396,498 436,516 432,526 358,524" />
		</g>
	);
}

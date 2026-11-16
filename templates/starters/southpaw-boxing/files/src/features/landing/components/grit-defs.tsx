// The shared SVG definitions of the landing page: the grit filter and the two halftone patterns.
// landing-page.tsx renders it once. landing.css reads #sp-grit; the boxer and the coach portraits read the patterns.

/** Hidden SVG with the filter `sp-grit` and the patterns `sp-dots-figure` and `sp-dots-face`. */
export function GritDefs() {
	return (
		<svg
			width="0"
			height="0"
			className="absolute"
			aria-hidden="true"
			focusable="false"
		>
			<defs>
				{/* Turbulence moves each edge by about 3px, like ink from a worn rubber stamp. */}
				<filter id="sp-grit" x="-40%" y="-40%" width="180%" height="180%">
					<feTurbulence
						type="fractalNoise"
						baseFrequency="0.12 0.9"
						numOctaves="2"
						seed="7"
						result="noise"
					/>
					<feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" />
				</filter>
				<pattern
					id="sp-dots-figure"
					width="7"
					height="7"
					patternUnits="userSpaceOnUse"
					patternTransform="rotate(15)"
				>
					<circle cx="3.5" cy="3.5" r="1.9" className="fill-foreground" />
				</pattern>
				<pattern
					id="sp-dots-face"
					width="5"
					height="5"
					patternUnits="userSpaceOnUse"
					patternTransform="rotate(12)"
				>
					<circle cx="2.5" cy="2.5" r="1.35" className="fill-foreground" />
				</pattern>
			</defs>
		</svg>
	);
}

// The arrowhead marker of every dimension line on the page. LandingPage renders it once, before the sections.
// A line in any figure points at it with markerStart and markerEnd: "url(#ns-arrow)".
// landing.css gives the triangle the ink color through the ns-arrowhead class.

/** The id that the dimension lines of all figures reference. */
export const ARROW_MARKER = "url(#ns-arrow)";

/** A hidden SVG with the 8 x 6 triangle that ends each dimension line. */
export function ArrowMarkerDefs() {
	return (
		<svg
			width="0"
			height="0"
			className="pointer-events-none absolute"
			aria-hidden="true"
			focusable="false"
		>
			<defs>
				<marker
					id="ns-arrow"
					viewBox="0 0 8 6"
					markerWidth="8"
					markerHeight="6"
					refX="7.5"
					refY="3"
					orient="auto-start-reverse"
				>
					<polygon className="ns-arrowhead" points="0,0 8,3 0,6" />
				</marker>
			</defs>
		</svg>
	);
}

// The small heartbeat glyph of the brand: one beat of the vitals line.
// The wordmark of the header and the kickers of the oath section render it.
// It draws with currentColor, so the parent sets its color with a text class.

/** One beat on a 40 by 18 grid. `className` gives its size and its color. */
export function PulseGlyph({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 40 18"
			aria-hidden="true"
			className={className}
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M1 12h8l3-9 4 15 3-8h4l2-4 2 6h12" />
		</svg>
	);
}

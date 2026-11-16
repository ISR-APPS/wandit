// The petal glyph of the Éclat world: four soft petals drawn with one bronze stroke.
// CapsuleBadge, RitualStep, and the phone menu render it. It is decoration, so screen readers skip it.

/** A 16 by 16 drawing in currentColor. The parent sets its size and its color. */
export function PetalGlyph({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 16 16"
			aria-hidden="true"
			focusable="false"
			className={className}
		>
			<path
				d="M8 1.5C9.35 3.55 9.35 5.7 8 8C6.65 5.7 6.65 3.55 8 1.5ZM14.5 8C12.45 9.35 10.3 9.35 8 8C10.3 6.65 12.45 6.65 14.5 8ZM8 14.5C6.65 12.45 6.65 10.3 8 8C9.35 10.3 9.35 12.45 8 14.5ZM1.5 8C3.55 6.65 5.7 6.65 8 8C5.7 9.35 3.55 9.35 1.5 8Z"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.15"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

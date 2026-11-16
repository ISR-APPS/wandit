// The round seal on each side of the fight card head: two rings and a star.
// fight-card-section.tsx renders it twice. It takes the text color of its parent.

/** A decorative seal. `className` sets its size, position, and tilt. */
export function CardSeal({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 100 100"
			aria-hidden="true"
			focusable="false"
			className={className}
		>
			<circle
				cx="50"
				cy="50"
				r="46"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.5"
			/>
			<circle
				cx="50"
				cy="50"
				r="36"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<path
				d="M50 26l7 16.9 18.2 1.5-13.9 11.9 4.3 17.7L50 64.5 34.4 74l4.3-17.7-13.9-11.9 18.2-1.5z"
				fill="currentColor"
			/>
		</svg>
	);
}

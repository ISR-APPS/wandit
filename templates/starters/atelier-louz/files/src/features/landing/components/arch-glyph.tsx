// The small filled arch of the brand. The header wordmark and the contact frame draw it.
// It reads the page tint, so it follows the material library.

/** A 22 by 16 arch in the page tint. `className` sets its size and place. */
export function ArchGlyph({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 22 16"
			aria-hidden="true"
			focusable="false"
			className={className}
		>
			<path
				className="louz-tint-fill"
				d="M1 16V9A10 8 0 0 1 21 9v7h-4V9a6 5 0 0 0-12 0v7Z"
			/>
		</svg>
	);
}

// The 15 x 10 arrow of the campus buttons. The hero, admission, and enrolment buttons render it.
// It draws with currentColor, so it takes the text color of its button.

/** Points to the end side; it turns in a right-to-left page. */
export function ArrowGlyph() {
	return (
		<svg
			viewBox="0 0 15 10"
			aria-hidden="true"
			className="h-2.5 w-[15px] flex-none rtl:rotate-180"
		>
			<path
				d="M0 5h13M9.5 1 13.5 5l-4 4"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

// The fat solid arrow between two steps of the drive.
// DriveSection renders it at the start of each step item after the first one.

/** Decorative. It points along the reading direction in a row, and down when the steps stack on a phone. */
export function StepArrow() {
	return (
		<span
			aria-hidden="true"
			className="my-1.5 ms-3 rotate-90 justify-self-start text-primary md:m-0 md:mt-[clamp(14px,2.4vw,34px)] md:rotate-0 rtl:md:rotate-180"
		>
			<svg
				viewBox="0 0 82 40"
				fill="currentColor"
				aria-hidden="true"
				focusable="false"
				className="block h-auto w-8 md:w-[clamp(34px,3.6vw,58px)]"
			>
				<path d="M0 13 H44 V0 L82 20 L44 40 V27 H0 Z" />
			</svg>
		</span>
	);
}

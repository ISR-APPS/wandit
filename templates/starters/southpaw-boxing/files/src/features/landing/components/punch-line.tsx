// One line of the hero wordmark, split into letters so that each one lands alone.
// hero-poster.tsx renders three of them. landing.css animates the letter spans.
import { cn } from "~/shared/lib/utils";

type PunchLineProps = {
	text: string;
	/** Wait before the first letter lands, in milliseconds. */
	startMs: number;
	/** Time between two letters, in milliseconds. */
	stepMs: number;
	className: string;
};

/** Odd letters land with a tilt to the left, even letters with a tilt to the right (landing.css). The h1 carries the full text for screen readers. */
export function PunchLine({
	text,
	startMs,
	stepMs,
	className,
}: PunchLineProps) {
	const letters = Array.from(text, (char, position) => ({ char, position }));
	return (
		<span aria-hidden="true" className={cn("sp-punch block", className)}>
			{letters.map((letter) => (
				<span
					key={letter.position}
					className="inline-block whitespace-pre"
					style={{ animationDelay: `${startMs + letter.position * stepMs}ms` }}
				>
					{letter.char}
				</span>
			))}
		</span>
	);
}

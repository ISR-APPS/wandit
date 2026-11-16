// The four drawn badges of the first-visit steps: a fish, a rocket, a sparkle, and a gift.
// StepCard renders one in the tilted tile at its corner. Decorative: the step title says the same.
import type { StepIconKind } from "../lib/content";

/** A 40 x 40 drawing. The parent sets the size. */
export function StepIcon({
	kind,
	className,
}: {
	kind: StepIconKind;
	className?: string;
}) {
	return (
		<svg
			viewBox="0 0 40 40"
			aria-hidden="true"
			focusable="false"
			className={className}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			{kind === "fish" && (
				<>
					<path
						d="M6 20c5-8 14-8 19 0c-5 8-14 8-19 0Z"
						strokeWidth="2.4"
						className="fill-primary stroke-foreground"
					/>
					<path
						d="M25 20l9-7-2.5 7L34 27Z"
						strokeWidth="2.4"
						className="fill-primary stroke-foreground"
					/>
					<circle cx="12" cy="18.5" r="1.8" className="fill-foreground" />
					<circle
						cx="31"
						cy="8"
						r="2"
						fill="none"
						strokeWidth="1.8"
						className="stroke-foreground"
					/>
					<circle
						cx="25"
						cy="4"
						r="1.4"
						fill="none"
						strokeWidth="1.6"
						className="stroke-foreground"
					/>
				</>
			)}
			{kind === "rocket" && (
				<>
					<path
						d="M20 3c6 5 8 12 8 17l-4 5h-8l-4-5c0-5 2-12 8-17Z"
						strokeWidth="2.4"
						className="fill-card stroke-foreground"
					/>
					<circle
						cx="20"
						cy="15"
						r="4"
						strokeWidth="2.2"
						className="fill-(--gd-mint) stroke-foreground"
					/>
					<path
						d="M12 25l-5 6M28 25l5 6"
						strokeWidth="2.4"
						className="stroke-foreground"
					/>
					<path d="M20 26v9" strokeWidth="3.2" className="stroke-primary" />
				</>
			)}
			{kind === "sparkle" && (
				<>
					<path
						d="M18 4l3.4 9.6L31 17l-9.6 3.4L18 30l-3.4-9.6L5 17l9.6-3.4Z"
						strokeWidth="2.4"
						className="fill-primary stroke-foreground"
					/>
					<path
						d="M31 26l1.6 4.4L37 32l-4.4 1.6L31 38l-1.6-4.4L25 32l4.4-1.6Z"
						strokeWidth="2.2"
						className="fill-card stroke-foreground"
					/>
				</>
			)}
			{kind === "gift" && (
				<>
					<rect
						x="7"
						y="16"
						width="26"
						height="18"
						rx="4"
						strokeWidth="2.4"
						className="fill-(--gd-sun) stroke-foreground"
					/>
					<path d="M20 16v18" strokeWidth="2.4" className="stroke-foreground" />
					<path
						d="M20 16c-7 0-9-4-7-7 2-2.6 6-1 7 4 1-5 5-6.6 7-4 2 3 0 7-7 7Z"
						strokeWidth="2.2"
						className="fill-background stroke-foreground"
					/>
				</>
			)}
		</svg>
	);
}

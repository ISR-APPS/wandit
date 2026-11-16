// A small tooth that peeks over the edge of a card or a band, with only its top half drawn.
// The services section, the price menu, and the footer render it. Decorative only.
import { cn } from "~/shared/lib/utils";

/** The parent places it with absolute classes in `className` and sets its width. */
export function PeekTooth({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 120 100"
			aria-hidden="true"
			focusable="false"
			className={cn("pointer-events-none", className)}
		>
			<path
				d="M60 14 C 34 14 16 29 15 53 C 14.5 71 22 84 27 100 L 93 100 C 98 84 105.5 71 105 53 C 104 29 86 14 60 14 Z"
				strokeWidth="5"
				className="fill-card stroke-foreground"
			/>
			<circle cx="46" cy="52" r="4.5" className="fill-foreground" />
			<circle cx="74" cy="52" r="4.5" className="fill-foreground" />
			<path
				d="M44 66 q16 13 32 0"
				fill="none"
				strokeWidth="5"
				strokeLinecap="round"
				className="stroke-foreground"
			/>
			<circle cx="32" cy="62" r="6" className="fill-primary opacity-45" />
			<circle cx="88" cy="62" r="6" className="fill-primary opacity-45" />
		</svg>
	);
}

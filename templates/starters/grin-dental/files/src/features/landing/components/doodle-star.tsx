// A four-point sticker star with an ink outline. The hero and the visit scene scatter it as decoration.
// The fill comes from `className`, for example fill-primary or fill-(--gd-sun).
import { cn } from "~/shared/lib/utils";

/** The parent sets the place, the size, the tilt, and the fill. */
export function DoodleStar({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 40 40"
			aria-hidden="true"
			focusable="false"
			className={cn("pointer-events-none", className)}
		>
			<path
				d="M20 3l4.2 11.3L36 18l-11.8 3.7L20 33l-4.2-11.3L4 18l11.8-3.7z"
				strokeWidth="2.5"
				strokeLinejoin="round"
				className="stroke-foreground"
			/>
		</svg>
	);
}

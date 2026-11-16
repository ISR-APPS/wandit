// The five-point star of the poster: the separator between phrases and the bullet of lists.
// Every section of the landing page renders it. It takes the text color of its parent.
import { cn } from "~/shared/lib/utils";

/** A decorative star that scales with the font size. Hidden from screen readers. */
export function Star({ className }: { className?: string }) {
	return (
		<svg
			viewBox="8 6 48 46"
			aria-hidden="true"
			focusable="false"
			className={cn(
				"inline-block size-[0.85em] shrink-0 fill-current align-[-0.08em]",
				className,
			)}
		>
			<path d="M32 8l6.2 14.9L54 24.2 41.8 34.6 45.6 50 32 41.5 18.4 50l3.8-15.4L10 24.2l15.8-1.3z" />
		</svg>
	);
}

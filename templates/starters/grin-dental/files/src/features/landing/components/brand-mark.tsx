// The logo of Grin Dental Studio: a smiling tooth on a coral tile. SiteHeader and SiteMenu render it.
// Pure SVG with theme colors: coral tile, white tooth, ink outline and face.
import { cn } from "~/shared/lib/utils";

/** A square logo. The parent sets the size with `className`, for example size-9. */
export function BrandMark({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 64 64"
			aria-hidden="true"
			focusable="false"
			className={cn("shrink-0", className)}
		>
			<rect width="64" height="64" rx="16" className="fill-primary" />
			<path
				d="M32 10c-11 0-19 7-19.5 18-.4 8 3.5 13.5 6.5 22 1.5 4.5 7.5 5.5 9.5 1 1-2.5 2-4 3.5-4s2.5 1.5 3.5 4c2 4.5 8 3.5 9.5-1 3-8.5 6.9-14 6.5-22C51 17 43 10 32 10Z"
				strokeWidth="3"
				className="fill-card stroke-foreground"
			/>
			<circle cx="25" cy="30" r="2.6" className="fill-foreground" />
			<circle cx="39" cy="30" r="2.6" className="fill-foreground" />
			<path
				d="M24 38q8 7 16 0"
				fill="none"
				strokeWidth="3"
				strokeLinecap="round"
				className="stroke-foreground"
			/>
		</svg>
	);
}

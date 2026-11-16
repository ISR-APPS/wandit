// The flat filled arrow of the poster world. Anton has no arrow glyph, so the page draws it as an SVG.
// BookingSection renders it large from 1024px. It takes the text ink of its sheet.
import { cn } from "~/shared/lib/utils";

/** A right-pointing arrow in currentColor. It mirrors in a right-to-left language. */
export function ArrowGlyph({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 200 60"
			aria-hidden="true"
			focusable="false"
			className={cn("rtl:-scale-x-100", className)}
		>
			<path d="M0 22h150V0l50 30-50 30V38H0z" fill="currentColor" />
		</svg>
	);
}

// The Stillpoint mark: a sage ring around a clay point. It breathes on the 14s clock of the hero.
// SiteHeader and SiteMenu render it next to the wordmark. public/favicon.svg draws the same mark.
import { cn } from "~/shared/lib/utils";

/** The mark, decorative: the wordmark next to it carries the name. */
export function BrandMark({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 64 64"
			aria-hidden="true"
			className={cn("sp-breathe size-[26px] shrink-0", className)}
		>
			<circle
				cx="32"
				cy="32"
				r="17"
				fill="none"
				stroke="var(--sp-sage)"
				strokeWidth="3.5"
			/>
			<circle cx="32" cy="32" r="4.5" fill="var(--sp-terra)" />
		</svg>
	);
}

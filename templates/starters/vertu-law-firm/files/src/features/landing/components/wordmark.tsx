// The wordmark of the firm: a small folder outline in brass, then the name in the display serif.
// SiteHeader and SiteMenu render it. The folder glyph is the same drawing as public/favicon.svg.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

/** The folder glyph and the firm name on one line. The text size comes from `className`. */
export function Wordmark({ className }: { className?: string }) {
	const { t } = useT();
	return (
		<span className={cn("inline-flex items-center gap-3", className)}>
			<svg
				aria-hidden="true"
				viewBox="0 0 32 32"
				className="size-6 shrink-0 fill-none stroke-primary"
			>
				<path d="M3 26V10h9l2-3h15v19z" strokeWidth="1.6" />
				<path d="M3 15h26" strokeWidth="1.2" />
			</svg>
			<span className="whitespace-nowrap font-display font-normal leading-none tracking-[0.005em]">
				{t("site.firmName")}
			</span>
		</span>
	);
}

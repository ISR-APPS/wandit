// The wordmark of the studio: the name in capitals of the theme display face, weight 800, and an optional mono meta line.
// SiteHeader, SiteMenu, and CartoucheFooter render it.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";

type WordmarkProps = {
	/** True shows "Architects — Algiers" next to the name. The header hides it on a small phone. */
	withMeta?: boolean;
	className?: string;
};

/** The name of the studio as one unbroken line. The caller sets the size. */
export function Wordmark({ withMeta = false, className }: WordmarkProps) {
	const { t } = useT();
	return (
		<span className={cn("flex items-baseline gap-3.5", className)}>
			<span className="ns-title whitespace-nowrap uppercase tracking-[-0.01em]">
				{t("site.brand")}
			</span>
			{withMeta && (
				<span className="hidden whitespace-nowrap font-display text-[0.59375rem] text-foreground/70 uppercase tracking-[0.1em] sm:inline">
					{t("site.brandMeta")}
				</span>
			)}
		</span>
	);
}

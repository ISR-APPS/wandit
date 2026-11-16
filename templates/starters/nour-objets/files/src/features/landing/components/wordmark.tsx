// The wordmark of the shop: "NOUR" in spaced capitals, and "Objets" in small mono beside it.
// SiteHeader and SiteMenu render it. The two words come from the "site" group of messages.ts.
import { useT } from "~/shared/i18n";

/** The two words on one baseline. The parent sets the link and the touch height. */
export function Wordmark() {
	const { t } = useT();
	return (
		<span className="flex items-baseline gap-2">
			<span className="font-display font-semibold text-[19px] tracking-[0.1em]">
				{t("site.wordmark")}
			</span>
			<span className="nour-mono text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
				{t("site.descriptor")}
			</span>
		</span>
	);
}

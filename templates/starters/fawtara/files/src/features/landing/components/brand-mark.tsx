// The wordmark of Fawtara with its glyph, as a link to the top of the page.
// SiteHeader and SiteFooter render it.
import { useT } from "~/shared/i18n";
import { BrandGlyph } from "./brand-glyph";

/** The link box is 44px high for a finger. `#top` is the id of the page root in landing-page.tsx. */
export function BrandMark() {
	const { t } = useT();
	return (
		<a
			href="#top"
			aria-label={t("site.brandHome")}
			className="inline-flex h-11 shrink-0 items-center gap-2.5 font-display font-extrabold text-foreground text-xl tracking-[-0.02em]"
		>
			<BrandGlyph className="size-7.5" />
			{t("common.appName")}
		</a>
	);
}

// The LUME lockup: the name in the display face, with the small "Atelier" label on its baseline.
// SiteHeader and SiteMenu render it. It inherits the text color of its parent.
import { useT } from "~/shared/i18n";

/** Two type registers in one mark: 600 display capitals, then tracked micro capitals at 55%. */
export function Wordmark() {
	const { t } = useT();
	return (
		<span className="flex items-baseline gap-[0.4em]">
			<span className="font-display font-semibold text-[1.45rem] tracking-[0.14em]">
				{t("site.wordmark")}
			</span>
			<span className="font-sans text-[0.6rem] uppercase tracking-[0.3em] opacity-55">
				{t("site.wordmarkSub")}
			</span>
		</span>
	);
}

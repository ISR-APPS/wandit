// The footer of the public page: the name of the studio in very large type above a stone hairline.
// LandingPage renders it under the appointment section.
import { useT } from "~/shared/i18n";
import { WRAP } from "../lib/type-styles";

/** Footer with the large wordmark, the legal line, and the photo credit. It has no link. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className="pt-[clamp(3rem,6vw,5rem)] pb-[clamp(2rem,4vw,3rem)]">
			<div className={WRAP}>
				{/* The wordmark never goes below 2.6rem. On a phone it is then still larger than the h1. */}
				<p className="border-primary border-b pb-[clamp(1rem,2vw,1.6rem)] font-display text-[clamp(2.6rem,8vw,6.6rem)] leading-[0.98] tracking-[-0.035em]">
					{t("site.brandFirst")}{" "}
					<span className="text-foreground/50">{t("site.brandSecond")}</span>
				</p>
				<div className="mt-5 flex flex-wrap justify-between gap-x-10 gap-y-3 border-foreground/10 border-t pt-5 text-[0.84rem] text-muted-foreground leading-relaxed">
					<span>{t("site.footerLegal")}</span>
					<span>{t("site.footerCredit")}</span>
				</div>
			</div>
		</footer>
	);
}

// The footer of the home page: the name of the estate as a monument under a bronze rule, then the legal line.
// LandingPage renders it. The bronze rule is one of the two bronze rules of the page.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { TEXT_LINK, TEXT_LINK_RULE, WRAP } from "../lib/type-styles";

/** The name is 11% of the screen width, 7.4rem at most. On a phone it fills most of the column, on a desktop about two thirds. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className="border-primary border-t py-[clamp(2rem,3.6vw,3rem)]">
			<div className={WRAP}>
				<p className="font-display text-[clamp(2.4rem,11vw,7.4rem)] leading-[0.94] tracking-[-0.02em]">
					<span className="block">{t("footer.wordLine1")}</span>
					<span className="block">{t("footer.wordLine2")}</span>
				</p>
				<div className="mt-[clamp(1.8rem,3vw,2.6rem)] flex flex-wrap items-center gap-x-8 gap-y-2 border-foreground/12 border-t pt-4 text-[0.8rem] text-muted-foreground">
					<span>{t("footer.company")}</span>
					<span>{t("footer.register")}</span>
					<span>{t("footer.licence")}</span>
					<a href="#top" className={cn(TEXT_LINK, "ms-auto text-foreground")}>
						<span className={TEXT_LINK_RULE}>{t("footer.backToTop")}</span>
					</a>
				</div>
			</div>
		</footer>
	);
}

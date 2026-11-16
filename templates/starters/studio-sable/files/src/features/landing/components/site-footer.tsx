// The footer of the page: the wordmark as a monument on the one ink field, over a mono contact row.
// LandingPage renders it after the last section. It is the last object of the page.
import { useT } from "~/shared/i18n";
import { SQUARE, WRAP } from "../lib/type-styles";
import { Wordmark } from "./wordmark";

const FOOTER_LINK =
	"group inline-flex min-h-11 items-center transition-colors duration-150 hover:text-background focus-visible:text-background";
const FOOTER_LINK_TEXT =
	"border-background/30 border-b pb-0.5 transition-colors duration-150 group-hover:border-background group-focus-visible:border-background";

/** The ink colophon. Its square is paper, not accent: the accent at 7px on ink is not readable. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer data-cascade="" className="bg-foreground text-background">
			<div className={WRAP}>
				<p className="sable-fade pt-[clamp(34px,6vh,64px)] pb-[clamp(20px,3vh,32px)] font-display font-medium text-[clamp(3.5rem,13vw,11rem)] leading-[0.86] tracking-[-0.05em]">
					<Wordmark />
				</p>
				<span
					aria-hidden="true"
					className="sable-rule block h-px w-full bg-background/22"
				/>
				<div className="sable-mono flex flex-wrap items-center justify-between gap-x-[34px] gap-y-1 pt-2 pb-[clamp(28px,4vh,48px)] text-[12px] text-background/72 leading-normal tracking-[0.02em]">
					<a href={t("site.emailHref")} className={FOOTER_LINK}>
						<span className={FOOTER_LINK_TEXT}>{t("site.email")}</span>
					</a>
					<a href={t("site.phoneHref")} className={FOOTER_LINK}>
						<span className={FOOTER_LINK_TEXT}>{t("site.phone")}</span>
					</a>
					<span>{t("site.address")}</span>
					<span className="inline-flex items-center gap-[9px]">
						<span aria-hidden="true" className={`${SQUARE} bg-background`} />
						{t("footer.copyright")}
					</span>
				</div>
			</div>
		</footer>
	);
}

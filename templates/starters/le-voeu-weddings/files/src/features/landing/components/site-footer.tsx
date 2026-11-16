// The footer of the home page: the second and last deep ground.
// LandingPage renders it last. The wordmark stands as a monument over a gold rule,
// then three columns (studio, contact, meetings) and one line of small capitals.
import { useT } from "~/shared/i18n";
import { WRAP } from "../lib/type-styles";

/** Small capitals of a footer column head, in ivory at 66%. */
const FOOT_HEAD =
	"mb-[14px] font-bold font-sans text-[10.5px] text-background/66 uppercase tracking-[0.22em]";

/** A link of the footer on a gold underline. The touch area is 44px high. */
const FOOT_LINK =
	"voeu-swap inline-flex min-h-11 items-center border-(--voeu-gold-line) border-b hover:border-primary focus-visible:border-primary";

/** The rosewood footer. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className="bg-foreground pt-[clamp(48px,6vw,86px)] pb-[34px] text-background">
			<div className={WRAP}>
				<p className="border-(--voeu-gold-line) border-b pb-[clamp(26px,3.4vw,44px)] font-display text-[clamp(3.4rem,9.6vw,7.6rem)] leading-[0.92] tracking-[-0.012em]">
					{t("site.brand")}
				</p>
				<div className="grid gap-x-6 gap-y-7 pt-[clamp(28px,3.4vw,44px)] sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-[clamp(24px,3vw,48px)]">
					<div>
						<h2 className={FOOT_HEAD}>{t("footer.studioLabel")}</h2>
						<p className="text-[0.95rem] text-background/90 leading-[1.9]">
							<span className="block">{t("footer.studioLine1")}</span>
							<span className="block">{t("footer.studioLine2")}</span>
							<span className="block">{t("footer.studioLine3")}</span>
						</p>
					</div>
					<div>
						<h2 className={FOOT_HEAD}>{t("footer.contactLabel")}</h2>
						<ul className="grid justify-items-start text-[0.95rem] text-background/90">
							<li>
								<a href={t("site.phoneHref")} className={FOOT_LINK}>
									{t("site.phoneDisplay")}
								</a>
							</li>
							<li>
								<a href={t("site.emailHref")} className={FOOT_LINK}>
									{t("site.emailDisplay")}
								</a>
							</li>
						</ul>
					</div>
					<div>
						<h2 className={FOOT_HEAD}>{t("footer.hoursLabel")}</h2>
						<p className="text-[0.95rem] text-background/90 leading-[1.9]">
							<span className="block">{t("footer.hoursLine1")}</span>
							<span className="block">{t("footer.hoursLine2")}</span>
						</p>
					</div>
				</div>
				<div className="mt-[clamp(30px,4vw,52px)] flex flex-wrap gap-x-[26px] gap-y-2 border-background/14 border-t pt-5 text-[11px] text-background/62 uppercase tracking-[0.14em]">
					<span>{t("footer.baseTrade")}</span>
					<span>{t("footer.baseRegion")}</span>
					<span>{t("footer.baseLimit")}</span>
				</div>
			</div>
		</footer>
	);
}

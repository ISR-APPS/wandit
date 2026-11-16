// The colophon footer: three ruled columns (enquiries, offices by appointment, the portfolio anchors),
// the edge-to-edge MERIDIAN wordmark that rises out of its mask, and the legal line.
// LandingPage renders it after the main content. The last gesture of the page is typography.
import { useT } from "~/shared/i18n";
import { PORTFOLIO_HOUSES } from "../lib/content";

const COLUMN_TITLE =
	"mb-5 font-medium font-sans text-[0.65625rem] text-foreground/55 uppercase tracking-[0.22em]";
const COLUMN_LINK =
	"inline-flex min-h-11 items-center text-[0.875rem] text-foreground/70 transition-colors duration-300 hover:text-primary";

/** The page footer. Every link is a mail, a telephone, or an anchor of this page. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className="overflow-clip border-foreground/14 border-t pt-[clamp(3.5rem,8vh,6rem)] pb-8">
			<div className="mer-wrap">
				<div className="grid gap-10 pb-[clamp(3rem,8vh,6rem)] md:grid-cols-3">
					<div>
						<p className={COLUMN_TITLE}>{t("footer.enquiries")}</p>
						<ul className="flex flex-col gap-1">
							<li>
								<a href={t("site.emailHref")} className={COLUMN_LINK}>
									{t("site.email")}
								</a>
							</li>
							<li>
								<a href={t("site.pressEmailHref")} className={COLUMN_LINK}>
									{t("site.pressEmail")}
								</a>
							</li>
							<li>
								<a
									href={t("site.phoneHref")}
									className={`${COLUMN_LINK} tabular-nums`}
								>
									{t("site.phone")} — {t("site.phoneCity")}
								</a>
							</li>
						</ul>
					</div>
					<div>
						<p className={COLUMN_TITLE}>{t("footer.offices")}</p>
						<ul className="flex flex-col gap-1 text-[0.875rem] text-foreground/70">
							<li className="flex min-h-11 items-center">
								{t("footer.officeCostaBrava")}
							</li>
							<li className="flex min-h-11 items-center">
								{t("footer.officeScottsdale")}
							</li>
							<li className="flex min-h-11 items-center">
								{t("footer.officeKaruizawa")}
							</li>
						</ul>
					</div>
					<div>
						<p className={COLUMN_TITLE}>{t("footer.portfolio")}</p>
						<ul className="flex flex-col gap-1">
							{PORTFOLIO_HOUSES.map((house) => (
								<li key={house.id}>
									<a href={`#${house.id}`} className={COLUMN_LINK}>
										{t(house.name)} {t(house.accent)}
									</a>
								</li>
							))}
							<li>
								<a href="#residence" className={COLUMN_LINK}>
									{t("hero.currentName")}
								</a>
							</li>
						</ul>
					</div>
				</div>

				<p
					data-reveal
					className="mer-mask select-none whitespace-nowrap text-center font-display text-[clamp(3rem,16vw,17.5rem)] uppercase leading-[0.95] tracking-[0.02em]"
				>
					<span>{t("site.wordmark")}</span>
				</p>

				<div className="mt-[clamp(2rem,5vh,3.5rem)] flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-foreground/8 border-t pt-4 text-[0.6875rem] text-foreground/55 uppercase tracking-[0.14em]">
					<span>{t("footer.legal")}</span>
					<a
						href="#top"
						className="inline-flex min-h-11 items-center transition-colors duration-300 hover:text-primary"
					>
						{t("footer.backToTop")}
					</a>
				</div>
			</div>
		</footer>
	);
}

// The closing bill of the page: the outline wordmark, the club details, the anchor links, and the house rules.
// landing-page.tsx renders it. It reads NAV_LINKS and CONTACT of lib/content.ts.
import { useT } from "~/shared/i18n";
import { CONTACT, NAV_LINKS } from "../lib/content";
import { Star } from "./star";

/** The footer. Its contact details are the same fictional sample details as in the booking section. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className="sp-foot sp-gutter sp-halftone sp-halftone-soft overflow-clip pt-12 pb-9">
			<div className="mx-auto max-w-7xl">
				<p
					aria-hidden="true"
					className="sp-foot-word select-none text-center font-display font-extrabold text-[13.5vw] uppercase leading-[0.9] tracking-[0.02em] sm:text-[clamp(2.75rem,7.6vw,6.9rem)]"
				>
					{/* Below 640px the wordmark breaks after the first word and drops the first star. */}
					<span className="block sm:inline">{t("footer.word1")}</span>
					<Star className="sp-foot-star sp-gold mx-[0.7em] hidden align-[0.95em] text-[0.32em] sm:inline-block" />
					{t("footer.word2")}
					<Star className="sp-foot-star sp-gold mx-[0.7em] align-[0.95em] text-[0.32em]" />
					{t("footer.word3")}
				</p>
				<div aria-hidden="true" className="mt-4 mb-10 flex items-center gap-5">
					<span className="sp-rule-hot min-w-5 flex-1" />
					<span className="text-center font-bold text-[0.66rem] text-muted-foreground uppercase leading-loose tracking-[0.24em] sm:whitespace-nowrap sm:tracking-[0.32em]">
						<span className="block sm:inline">{t("footer.bellStart")}</span>
						<Star className="sp-sep sp-gold hidden sm:inline-block" />
						{t("footer.bellEnd")}
					</span>
					<span className="sp-rule-hot min-w-5 flex-1" />
				</div>

				<div className="sp-line grid gap-10 border-b pb-10 md:grid-cols-[1.4fr_1fr_1fr]">
					<div>
						<p className="font-display font-extrabold text-[2.1rem] uppercase leading-none tracking-[0.03em]">
							{t("site.brandName")}{" "}
							<span className="text-primary">{t("site.brandInitials")}</span>
						</p>
						<p className="sp-faint mt-3 max-w-[34ch] text-[0.9rem]">
							{t("footer.about")}
						</p>
						<span className="sp-est-chip mt-5 inline-block px-3 pt-1.5 pb-1 font-display font-extrabold text-base uppercase leading-tight tracking-[0.12em]">
							{t("footer.estChip")}
						</span>
					</div>
					<div>
						<h3 className="mb-4 inline-block border-primary border-b-2 pb-2 font-bold font-sans text-[0.68rem] text-muted-foreground uppercase tracking-[0.3em]">
							{t("footer.buildingTitle")}
						</h3>
						<ul className="grid gap-0.5 text-[0.9rem] text-muted-foreground">
							<li className="py-1">{t("book.address")}</li>
							<li>
								<a
									href={CONTACT.phoneHref}
									className="sp-foot-link inline-block py-1"
								>
									{t("book.phone")}
								</a>
							</li>
							<li>
								<a
									href={`mailto:${CONTACT.emailAddress}`}
									className="sp-foot-link inline-block py-1"
								>
									{t("book.email")}
								</a>
							</li>
							<li className="py-1">{t("book.hours")}</li>
						</ul>
					</div>
					<div>
						<h3 className="mb-4 inline-block border-primary border-b-2 pb-2 font-bold font-sans text-[0.68rem] text-muted-foreground uppercase tracking-[0.3em]">
							{t("footer.cardTitle")}
						</h3>
						<ul className="grid gap-0.5 text-[0.9rem] text-muted-foreground">
							{NAV_LINKS.map((link) => (
								<li key={link.href}>
									<a
										href={link.href}
										className="sp-foot-link inline-block py-1"
									>
										{t(link.label)}
									</a>
								</li>
							))}
							<li>
								<a href="#book" className="sp-foot-link inline-block py-1">
									{t("footer.linkBook")}
								</a>
							</li>
						</ul>
					</div>
				</div>

				<div className="sp-rules relative mt-9 px-6 pt-7 pb-6">
					<p
						aria-hidden="true"
						className="sp-hot absolute start-4 -top-3 -rotate-1 whitespace-nowrap bg-canvas px-2 font-display font-extrabold text-sm uppercase leading-tight tracking-[0.08em] sm:start-5 sm:-top-3.5 sm:px-2.5 sm:text-lg sm:tracking-[0.14em]"
					>
						{t("footer.rulesStamp")}
					</p>
					<p className="sp-faint text-[0.68rem] uppercase leading-loose tracking-[0.08em] md:columns-2 md:gap-12">
						<b className="text-muted-foreground">{t("footer.rulesLead")}</b>{" "}
						{t("footer.rulesBody")}
					</p>
				</div>

				<div className="sp-faint sp-line mt-7 flex flex-wrap justify-between gap-x-6 gap-y-2 border-t pt-6 text-[0.7rem] tracking-[0.08em]">
					<p>{t("footer.copyright")}</p>
					<p>
						{t("footer.legal1")}
						<Star className="sp-sep text-primary" />
						{t("footer.legal2")}
						<Star className="sp-sep text-primary" />
						{t("footer.legal3")}
					</p>
				</div>
			</div>
		</footer>
	);
}

// The footer of the public page: the wordmark and its line, the section links, and the contact details.
// LandingPage renders it on the paper ground, under a hairline. It has no credit line.
import { useT } from "~/shared/i18n";
import { WRAP } from "../lib/class-names";
import { SECTION_LINKS } from "../lib/sections";
import { BrandMark } from "./brand-mark";

const COLUMN_TITLE =
	"font-bold font-display text-[0.8rem] text-muted-foreground uppercase tracking-[0.08em]";
// On a phone each link box is 44px high for a finger. From 768px the rows are 36px.
const FOOTER_LINK =
	"inline-flex min-h-11 items-center text-[0.95rem] text-muted-foreground transition-colors hover:text-primary md:min-h-9";

/** The address, the telephone, the email, and the register number are sample details. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className="border-foreground/8 border-t pt-[clamp(2.5rem,5vh,4rem)] pb-8">
			<div className={WRAP}>
				<div className="grid gap-x-8 gap-y-9 md:grid-cols-[1.4fr_1fr_1fr]">
					<div>
						<BrandMark />
						<p className="mt-3 max-w-[24em] text-[0.94rem] text-muted-foreground leading-[1.6]">
							{t("footer.tagline")}
						</p>
					</div>
					<nav aria-label={t("footer.linksLabel")}>
						<h2 className={COLUMN_TITLE}>{t("footer.siteTitle")}</h2>
						<ul className="mt-2 grid grid-cols-2 md:grid-cols-1">
							{SECTION_LINKS.map((link) => (
								<li key={link.href}>
									<a href={link.href} className={FOOTER_LINK}>
										{t(link.labelKey)}
									</a>
								</li>
							))}
						</ul>
					</nav>
					<div>
						<h2 className={COLUMN_TITLE}>{t("footer.contactTitle")}</h2>
						<ul className="mt-2 grid">
							<li className="flex min-h-11 items-center text-[0.95rem] text-muted-foreground md:min-h-9">
								{t("footer.address")}
							</li>
							<li>
								<a
									href={t("site.phoneHref")}
									className={`${FOOTER_LINK} tabular-nums`}
								>
									{`${t("site.phonePrefix")} ${t("site.phoneDisplay")}`}
								</a>
							</li>
							<li>
								<a href={t("site.emailHref")} className={FOOTER_LINK}>
									{t("site.email")}
								</a>
							</li>
						</ul>
					</div>
				</div>
				<div className="mt-10 flex flex-wrap justify-between gap-x-6 gap-y-2 border-foreground/8 border-t pt-6 text-[0.82rem] text-muted-foreground">
					<span>{t("footer.copyright")}</span>
					<span className="tabular-nums">{t("footer.register")}</span>
				</div>
			</div>
		</footer>
	);
}

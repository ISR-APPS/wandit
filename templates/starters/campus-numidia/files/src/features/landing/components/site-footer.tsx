// The deep navy footer: the big wordmark closed by a sand period, four columns over a hairline, and a bottom bar.
// LandingPage renders it after the enrolment section. The copy is in the `footer` and `site` groups.
import { useT } from "~/shared/i18n";
import { WRAP } from "../lib/type-styles";

const COLUMN_TITLE =
	"mb-3.5 font-semibold text-[0.6875rem] text-(--cn-sky-lift) uppercase leading-none tracking-[0.15em]";
// Under 820px each link gets a 44px touch area, because a phone has no hover and needs a large target.
const FOOTER_LINK =
	"border-transparent border-b transition-colors hover:border-(--cn-sand) hover:text-background max-[819px]:inline-flex max-[819px]:min-h-11 max-[819px]:items-center";

/** Four columns from 820px, two from 460px, one on a small phone. */
export function SiteFooter() {
	const { t } = useT();
	const schoolLinks = [
		{ href: "#programmes", label: t("footer.linkProgrammes") },
		{ href: "#timetable", label: t("footer.linkTimetable") },
		{ href: "#admission", label: t("footer.linkAdmission") },
		{ href: "#results", label: t("footer.linkResults") },
	];
	return (
		<footer className="bg-(--cn-navy-deep) pt-[clamp(48px,6vw,86px)] pb-6.5 text-background/80">
			<div className={WRAP}>
				<p className="mb-[clamp(30px,4vw,52px)] font-bold font-display text-[clamp(2.35rem,7.4vw,5rem)] text-background leading-none tracking-[-0.035em]">
					{t("site.brand")}
					<span className="text-(--cn-sand)">.</span>
				</p>
				{/* On a phone the groups get 36px of space, more than the 44px links inside a group, so each group reads apart. */}
				<div className="grid grid-cols-1 gap-x-[clamp(20px,3vw,40px)] gap-y-9 border-background/16 border-t pt-[clamp(26px,3vw,38px)] min-[460px]:grid-cols-2 min-[820px]:grid-cols-4 min-[820px]:gap-y-[clamp(20px,3vw,40px)]">
					<div>
						<h2 className={COLUMN_TITLE}>{t("footer.addressTitle")}</h2>
						<p className="text-[0.875rem] leading-[1.62]">
							{t("enrol.address1")}
							<br />
							{t("enrol.address2")}
							<br />
							{t("footer.shuttleStop")}
						</p>
					</div>
					<div>
						<h2 className={COLUMN_TITLE}>{t("footer.contactTitle")}</h2>
						<ul className="flex flex-col gap-1.5 text-[0.875rem] leading-[1.62]">
							<li>
								<a
									href={t("site.phoneHref")}
									className={`${FOOTER_LINK} tabular-nums`}
								>
									{t("site.phoneDisplay")}
								</a>
							</li>
							<li className="break-all">
								<a href={`mailto:${t("site.email")}`} className={FOOTER_LINK}>
									{t("site.email")}
								</a>
							</li>
							<li>{t("footer.hours")}</li>
						</ul>
					</div>
					<nav aria-label={t("footer.schoolTitle")}>
						<h2 className={COLUMN_TITLE}>{t("footer.schoolTitle")}</h2>
						<ul className="flex flex-col gap-1.5 text-[0.875rem] leading-[1.62]">
							{schoolLinks.map((link) => (
								<li key={link.href}>
									<a href={link.href} className={FOOTER_LINK}>
										{link.label}
									</a>
								</li>
							))}
						</ul>
					</nav>
					<div>
						<h2 className={COLUMN_TITLE}>{t("footer.legalTitle")}</h2>
						<p className="text-[0.875rem] leading-[1.62]">
							{t("footer.legal1")}
							<br />
							{t("footer.legal2")}
							<br />
							{t("footer.legal3")}
						</p>
					</div>
				</div>
				<div className="mt-[clamp(30px,3.5vw,46px)] flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-background/16 border-t pt-5 text-[0.75rem] text-background/60">
					<span>{t("footer.copyright")}</span>
					<a
						href="#top"
						className={`${FOOTER_LINK} inline-flex min-h-11 items-center`}
					>
						{t("footer.backToTop")}
					</a>
				</div>
			</div>
		</footer>
	);
}

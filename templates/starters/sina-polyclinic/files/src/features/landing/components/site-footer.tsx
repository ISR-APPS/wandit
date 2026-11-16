// The deep footer: a vitals line, the wordmark, and four columns of facts and links.
// LandingPage renders it. Its link column repeats the section links, so a page with no script still has navigation on a phone.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { BOOKING_HREF, NAV_LINKS } from "../lib/content";
import { LABEL, WRAP } from "../lib/type-styles";
import { VitalsLine } from "./vitals-line";

const COLUMN_TITLE = cn(LABEL, "mb-3 text-(--sp-teal-lift) tracking-[0.14em]");
const COLUMN_TEXT = "text-background/65 text-sm leading-[1.75]";
// A link is 44px high on a phone for a finger, and one text line high from 768px.
const COLUMN_LINK =
	"inline-flex min-h-11 items-center transition-colors duration-200 hover:text-background md:min-h-0";
// A 44px link row centers its text 10px lower than a text line. The list moves up so both columns start level.
const COLUMN_LIST = cn(COLUMN_TEXT, "-mt-2.5 md:mt-0");

/** The footer has no credit line. The bar under the columns holds the rights line and the opening hours. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className="sp-deep">
			<VitalsLine
				entrance="none"
				className="text-(--sp-teal-lift) opacity-55"
			/>
			<div
				className={cn(
					WRAP,
					"pt-[clamp(3rem,6vw,5rem)] pb-[clamp(2rem,3vw,3rem)]",
				)}
			>
				<div className="grid gap-[clamp(28px,4vw,60px)] min-[56.25rem]:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]">
					<p className="font-display text-[clamp(2.1rem,4vw,3.4rem)] leading-[1.02] tracking-[-0.025em]">
						{t("site.brandName")}
						<span
							className={cn(
								LABEL,
								"mt-3.5 block text-(--sp-teal-lift) tracking-[0.16em]",
							)}
						>
							{t("footer.descriptor")}
						</span>
					</p>
					<div className="grid grid-cols-2 gap-x-[clamp(16px,2vw,28px)] gap-y-7 lg:grid-cols-4">
						<div>
							<h3 className={COLUMN_TITLE}>{t("footer.addressTitle")}</h3>
							<p className={COLUMN_TEXT}>
								{t("footer.addressStreet")}
								<br />
								{t("footer.addressDistrict")}
								<br />
								{t("footer.addressCity")}
								<br />
								{t("footer.addressParking")}
							</p>
						</div>
						<div>
							<h3 className={COLUMN_TITLE}>{t("footer.contactTitle")}</h3>
							<ul className={COLUMN_LIST}>
								<li>
									<a
										href={t("site.phoneHref")}
										className={cn(COLUMN_LINK, "tabular-nums")}
									>
										{t("site.phoneDisplay")}
									</a>
								</li>
								<li>
									<a href={`mailto:${t("site.email")}`} className={COLUMN_LINK}>
										{t("site.email")}
									</a>
								</li>
								<li>{t("footer.contactEmergency")}</li>
							</ul>
						</div>
						<nav aria-label={t("footer.clinicTitle")}>
							<h3 className={COLUMN_TITLE}>{t("footer.clinicTitle")}</h3>
							<ul className={COLUMN_LIST}>
								{NAV_LINKS.map((link) => (
									<li key={link.href}>
										<a href={link.href} className={COLUMN_LINK}>
											{t(link.label)}
										</a>
									</li>
								))}
								<li>
									<a href={BOOKING_HREF} className={COLUMN_LINK}>
										{t("site.book")}
									</a>
								</li>
							</ul>
						</nav>
						<div>
							<h3 className={COLUMN_TITLE}>{t("footer.noticesTitle")}</h3>
							<p className={COLUMN_TEXT}>
								{t("footer.noticeLicense")}
								<br />
								{t("footer.noticeCouncil")}
								<br />
								{t("footer.noticeSmoking")}
							</p>
						</div>
					</div>
				</div>
				<div className="mt-[clamp(30px,4vw,50px)] flex flex-wrap justify-between gap-x-6 gap-y-2 border-background/20 border-t pt-5 text-background/60 text-xs">
					<span>{t("footer.rights")}</span>
					<span className="tabular-nums">{t("footer.hours")}</span>
				</div>
			</div>
		</footer>
	);
}

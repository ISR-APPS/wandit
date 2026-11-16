// The footer: the agency name set large (the serif word and the tracked tag), with the sun rule crossing it at 60% of its height,
// then four columns of links and facts, and the legal line. LandingPage renders it on the paper ground.
// The page ends on the horizon that it opened with.
import { useT } from "~/shared/i18n";
import { CIRCUITS } from "../lib/circuits";
import { NAV_LINKS } from "../lib/nav-links";
import { META_SMALL, WRAP } from "../lib/type-styles";

/**
 * Link classes of the footer columns: 44px high on a phone, compact from 640px.
 * On a phone the text sits at the top of its box, so a name on two lines keeps the rows of both columns level.
 */
const FOOTER_LINK =
	"flex min-h-11 items-start py-[11px] text-[15px] leading-[1.4] transition-colors duration-200 hover:text-(--hz-ink-soft) min-[640px]:min-h-0 min-[640px]:py-[3px]";

/**
 * The links of the "agency" column, chosen by href so a new nav order cannot change them.
 * The circuits and the quote have their own columns.
 */
const AGENCY_HREFS: readonly string[] = ["#line", "#journey", "#seasons"];

/** The footer. No credit line. */
export function SiteFooter() {
	const { t } = useT();
	const agencyLinks = NAV_LINKS.filter((link) =>
		AGENCY_HREFS.includes(link.href),
	);
	return (
		<footer className="bg-background pt-[clamp(3rem,6vh,5rem)] pb-[34px]">
			<div className={WRAP}>
				<div className="relative pt-[clamp(10px,2vw,26px)]">
					{/* The full name: the large serif word, then the tracked tag on its baseline, as in the header wordmark. */}
					<p
						aria-hidden="true"
						className="flex items-baseline gap-x-[clamp(12px,2vw,26px)] whitespace-nowrap font-display font-normal text-[clamp(3rem,9.5vw,8rem)] leading-[0.94] tracking-[0.01em]"
					>
						{t("site.wordmark")}
						<span className="font-sans font-semibold text-(--hz-ink-soft) text-[clamp(0.8rem,1.5vw,1.25rem)] uppercase tracking-[0.3em]">
							{t("site.wordmarkTag")}
						</span>
					</p>
					<span
						aria-hidden="true"
						className="absolute inset-x-0 top-[60%] h-0.5 bg-(--hz-sun)"
					/>
				</div>
				<div className="mt-[clamp(34px,5vw,58px)] grid grid-cols-2 gap-[26px] border-(--hz-hair) border-t pt-6 min-[700px]:grid-cols-4 min-[700px]:gap-6">
					<nav aria-label={t("footer.circuitsLabel")}>
						<p className={`${META_SMALL} mb-2.5`}>
							{t("footer.circuitsLabel")}
						</p>
						{CIRCUITS.map((circuit) => (
							<a
								key={circuit.id}
								href={`#circuit-${circuit.id}`}
								className={FOOTER_LINK}
							>
								{t(circuit.nameKey)}
							</a>
						))}
					</nav>
					<nav aria-label={t("footer.agencyLabel")}>
						<p className={`${META_SMALL} mb-2.5`}>{t("footer.agencyLabel")}</p>
						{agencyLinks.map((link) => (
							<a key={link.href} href={link.href} className={FOOTER_LINK}>
								{t(link.labelKey)}
							</a>
						))}
					</nav>
					<div>
						<p className={`${META_SMALL} mb-2.5`}>{t("footer.contactLabel")}</p>
						<a
							href={t("site.phoneHref")}
							className={`${FOOTER_LINK} tabular-nums`}
						>
							{t("site.phoneDisplay")}
						</a>
						<a href="#quote" className={FOOTER_LINK}>
							{t("footer.quoteLink")}
						</a>
						<a href="#top" className={FOOTER_LINK}>
							{t("footer.backToTop")}
						</a>
					</div>
					<div>
						<p className={`${META_SMALL} mb-2.5`}>{t("footer.addressLabel")}</p>
						<p className="text-[15px] leading-[1.6]">
							{t("quote.agencyLine1")}
							<br />
							{t("quote.agencyLine2")}
						</p>
					</div>
				</div>
				<p className="mt-[38px] border-(--hz-hair) border-t pt-4 text-(--hz-ink-soft) text-[13px] leading-[1.6]">
					{t("footer.legal")}
				</p>
			</div>
		</footer>
	);
}

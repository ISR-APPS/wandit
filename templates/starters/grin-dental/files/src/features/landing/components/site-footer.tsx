// The ink footer: a peek tooth on its top edge, the giant wordmark with a spinning smile badge,
// four columns (studio, say hi, hours, explore), and the bottom line. LandingPage renders it last.
import type { TranslationKey } from "~/shared/i18n";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { DISPLAY, WRAP } from "../lib/styles";
import { PeekTooth } from "./peek-tooth";

/** The section links of the "Explore" column, in page order. */
const EXPLORE_LINKS: readonly { href: string; labelKey: TranslationKey }[] = [
	{ href: "#services", labelKey: "footer.exploreServices" },
	{ href: "#visit", labelKey: "footer.exploreVisit" },
	{ href: "#team", labelKey: "footer.exploreTeam" },
	{ href: "#prices", labelKey: "footer.explorePrices" },
	{ href: "#club", labelKey: "footer.exploreClub" },
];

const COLUMN_TITLE =
	"mb-3.5 font-display font-extrabold text-(--gd-sun) text-base uppercase tracking-[0.1em]";
const FOOTER_LINK =
	"inline-flex min-h-11 items-center border-transparent border-b-2 transition-colors hover:border-(--gd-sun) hover:text-(--gd-sun) md:min-h-0";

/** Four columns from 900px, two from 520px, one on a small phone. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className="gd-on-dark relative mt-12 bg-foreground pt-[clamp(4.5rem,7vw,6rem)] pb-8 text-background">
			<PeekTooth className="absolute end-[8%] -top-[62px] w-27.5 -rotate-5 max-[520px]:-top-12 max-[520px]:w-21" />
			<div className={WRAP}>
				<p
					aria-hidden="true"
					className={cn(
						DISPLAY,
						"mb-[0.4em] text-[clamp(3rem,9vw,7.5rem)] leading-[0.95] tracking-[-0.02em]",
					)}
				>
					{/* Each star stays with the word before it, so no line starts with a star. */}
					<span className="whitespace-nowrap">
						{t("footer.mark1")} <span className="text-primary">✦</span>
					</span>{" "}
					<span className="whitespace-nowrap">
						{t("footer.mark2")} <span className="text-(--gd-sun)">✦</span>
					</span>{" "}
					{t("footer.mark3")}
					<svg
						viewBox="0 0 120 120"
						aria-hidden="true"
						focusable="false"
						className="gd-spin-slow ms-[0.12em] inline-block size-[0.88em] -rotate-8 align-[-0.08em]"
					>
						<path
							d="M60 4l9 15 16-8 2 18 18-2-8 16 15 9-15 9 8 16-18-2-2 18-16-8-9 15-9-15-16 8-2-18-18 2 8-16-15-9 15-9-8-16 18 2 2-18 16 8Z"
							strokeWidth="3"
							strokeLinejoin="round"
							className="fill-(--gd-sun) stroke-foreground"
						/>
						<circle
							cx="60"
							cy="60"
							r="30"
							strokeWidth="3"
							className="fill-background stroke-foreground"
						/>
						<circle cx="51" cy="55" r="3.2" className="fill-foreground" />
						<circle cx="69" cy="55" r="3.2" className="fill-foreground" />
						<path
							d="M50 65q10 9 20 0"
							fill="none"
							strokeWidth="3.5"
							strokeLinecap="round"
							className="stroke-foreground"
						/>
					</svg>
				</p>
				<div className="grid gap-9 border-background/28 border-b-2 border-dashed pb-10 font-bold text-[0.98rem] text-background/85 min-[520px]:grid-cols-2 min-[900px]:grid-cols-[1.2fr_1fr_1fr_1fr]">
					<div>
						<h3 className={COLUMN_TITLE}>{t("footer.studioTitle")}</h3>
						<p>
							{t("footer.address1")}
							<br />
							{t("footer.address2")}
						</p>
						<p className="mt-2.5 max-w-[30ch] text-background/70">
							{t("footer.blurb")}
						</p>
					</div>
					<div>
						<h3 className={COLUMN_TITLE}>{t("footer.helloTitle")}</h3>
						<ul className="grid gap-1 md:gap-2">
							<li>
								<a href={t("site.phoneHref")} className={FOOTER_LINK}>
									{t("site.phoneDisplay")}
								</a>
							</li>
							<li>
								<a href={t("site.emailHref")} className={FOOTER_LINK}>
									{t("site.email")}
								</a>
							</li>
							<li>
								<a href="#book" className={FOOTER_LINK}>
									{t("footer.bookOnline")}
								</a>
							</li>
						</ul>
					</div>
					<div>
						<h3 className={COLUMN_TITLE}>{t("footer.hoursTitle")}</h3>
						<ul className="grid gap-2">
							<li>{t("footer.hoursWeek")}</li>
							<li>{t("footer.hoursSaturday")}</li>
							<li>{t("footer.hoursSunday")}</li>
						</ul>
					</div>
					<nav aria-label={t("footer.exploreTitle")}>
						<h3 className={COLUMN_TITLE}>{t("footer.exploreTitle")}</h3>
						<ul className="grid gap-1 md:gap-2">
							{EXPLORE_LINKS.map((link) => (
								<li key={link.href}>
									<a href={link.href} className={FOOTER_LINK}>
										{t(link.labelKey)}
									</a>
								</li>
							))}
						</ul>
					</nav>
				</div>
				<div className="flex flex-wrap justify-between gap-3 pt-6 font-bold text-[0.88rem] text-background/60">
					<p>{t("footer.copyright")}</p>
					<p>{t("footer.signoff")}</p>
				</div>
			</div>
		</footer>
	);
}

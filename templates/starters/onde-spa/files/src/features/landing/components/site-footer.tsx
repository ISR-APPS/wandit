// The footer: three short columns, the large lowercase wordmark with a two-line note, and a bar of legal text.
// LandingPage renders it last. A steam haze breathes behind the wordmark; the content sits above it.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { NAV_LINKS } from "../lib/nav-links";
import { WRAP } from "../lib/styles";
import { SteamVeil } from "./steam-veil";

/** The tracked title of a footer column. */
const COLUMN_TITLE =
	"m-0 mb-3 font-medium font-sans text-[0.72rem] text-primary lowercase tracking-[0.18em]";

/** A link or a line of a footer column. */
const COLUMN_TEXT = "text-(--onde-ink-72) text-[0.9rem] leading-[1.7]";

/** The <footer> on ground B. */
export function SiteFooter() {
	const { t } = useT();
	return (
		// Only the sides clip: the seam veil must rise over the booking section, or it ends on a hard edge.
		<footer className="relative overflow-x-clip bg-(--onde-ground-b) pt-[clamp(3.5rem,8vh,6rem)]">
			<SteamVeil kind="seam" phase={0} />
			<SteamVeil kind="glow" phase={2} />
			<div className={cn(WRAP, "relative z-3")}>
				<div className="grid grid-cols-1 gap-[1.6rem] pb-[clamp(2.4rem,5vh,3.6rem)] sm:grid-cols-2 lg:grid-cols-3 lg:gap-[clamp(1.4rem,3vw,2.6rem)]">
					<div>
						<h2 className={COLUMN_TITLE}>{t("footer.aboutTitle")}</h2>
						<p className={cn(COLUMN_TEXT, "m-0")}>
							{t("footer.aboutLine1")}
							<br />
							{t("footer.aboutLine2")}
						</p>
					</div>
					<nav aria-label={t("site.navLabel")}>
						<h2 className={COLUMN_TITLE}>{t("footer.visitTitle")}</h2>
						<ul className="m-0 grid list-none p-0">
							{NAV_LINKS.map((link) => (
								<li key={link.href}>
									<a
										href={link.href}
										className={cn(
											COLUMN_TEXT,
											"inline-flex min-h-11 items-center no-underline transition-colors duration-[350ms] ease-(--onde-tide) hover:text-foreground lg:min-h-8",
										)}
									>
										{t(link.labelKey)}
									</a>
								</li>
							))}
						</ul>
					</nav>
					<div>
						<h2 className={COLUMN_TITLE}>{t("footer.contactTitle")}</h2>
						<p className={cn(COLUMN_TEXT, "m-0")}>
							{t("booking.addressLine1")}
							<br />
							{t("booking.addressLine2")}
						</p>
						<a
							href={t("site.phoneHref")}
							aria-label={t("site.phoneAria")}
							className={cn(
								COLUMN_TEXT,
								"inline-flex min-h-11 items-center tabular-nums no-underline hover:text-foreground",
							)}
						>
							{t("site.phoneDisplay")}
						</a>
					</div>
				</div>
				<div className="flex flex-col items-start gap-[0.9rem] pb-[0.2em] sm:flex-row sm:items-end sm:justify-between sm:gap-6">
					<p
						aria-hidden="true"
						className="m-0 font-display text-[clamp(3.6rem,9.4vw,146px)] leading-[0.86] tracking-[-0.012em]"
					>
						{t("site.brand")}
					</p>
					<p className="m-0 pb-3 text-(--onde-ink-66) text-[0.82rem] leading-[1.6] sm:pb-[0.9rem] sm:text-end">
						{t("footer.wordmarkNote1")}
						<br />
						{t("footer.wordmarkNote2")}
					</p>
				</div>
				<div className="flex flex-wrap justify-between gap-x-[1.6rem] gap-y-2 border-(--onde-hair) border-t pt-[1.2rem] pb-[1.6rem] text-(--onde-ink-66) text-[0.78rem]">
					<span>{t("footer.legal")}</span>
					<span>{t("footer.prices")}</span>
				</div>
			</div>
		</footer>
	);
}

// The ink footer: the monthly letter with a mail link, the outlined LUME monument, and the section links.
// LandingPage renders it last. The letter sign-up is a mailto link, because a starter has no form that posts.
import { useT } from "~/shared/i18n";
import { NAV_LINKS } from "../lib/nav-links";
import { ATELIER_EMAIL, ATELIER_MAILTO, subjectMailto } from "../lib/offer";
import { WRAP } from "../lib/type-styles";
import { PillArrow } from "./pill-arrow";

/** The page ends on a monument: the wordmark at 19.5vw, drawn by a 1px brass stroke. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className="overflow-clip bg-foreground text-background">
			<div className="border-background/14 border-b">
				<div
					className={`${WRAP} grid items-center gap-x-10 gap-y-6 py-[clamp(2.5rem,6vh,4rem)] lg:grid-cols-2`}
				>
					<div>
						<h2 className="font-display font-medium text-[clamp(1.6rem,2.8vw,2.4rem)] tracking-[-0.01em]">
							{t("footer.letterTitle")}{" "}
							<span className="lume-turn text-(--lume-brass-light)">
								{t("footer.letterTurn")}
							</span>
						</h2>
						<p className="mt-[0.7rem] text-[0.95rem] text-background/60">
							{t("footer.letterSub")}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-x-6 gap-y-2 lg:justify-end">
						<a
							href={subjectMailto(t("footer.letterSubject"))}
							className="lume-btn lume-btn-paper"
						>
							{t("footer.letterCta")}
							<PillArrow />
						</a>
						<a
							href={ATELIER_MAILTO}
							className="flex min-h-11 items-center text-[0.9rem] text-background/60 transition-colors hover:text-(--lume-brass-light)"
						>
							{ATELIER_EMAIL}
						</a>
					</div>
				</div>
			</div>
			<div className={`${WRAP} pt-[clamp(3rem,7vh,5rem)] pb-6`}>
				<p
					aria-hidden="true"
					className="lume-monument text-center font-display font-semibold text-[clamp(4.5rem,19.5vw,17.5rem)] leading-[0.85] tracking-[0.06em]"
				>
					{t("site.wordmark")}
				</p>
				<div className="mt-[clamp(2.5rem,6vh,4rem)] flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-background/14 border-t pt-[1.6rem]">
					{/* On a phone the five links spread over the full width, so they stay on one row. */}
					<nav aria-label={t("footer.linksLabel")} className="max-sm:w-full">
						<ul className="flex flex-wrap gap-x-4 max-sm:justify-between sm:gap-x-[1.8rem]">
							{NAV_LINKS.map((link) => (
								<li key={link.href}>
									<a
										href={link.href}
										className="flex min-h-11 items-center text-[0.85rem] text-background/70 transition-colors hover:text-(--lume-brass-light)"
									>
										{t(link.labelKey)}
									</a>
								</li>
							))}
							<li>
								<a
									href="#reserve"
									className="flex min-h-11 items-center text-[0.85rem] text-background/70 transition-colors hover:text-(--lume-brass-light)"
								>
									{t("site.reserve")}
								</a>
							</li>
						</ul>
					</nav>
					<p className="flex min-h-11 items-center text-[0.8rem] text-background/45">
						{t("footer.copyright")}
					</p>
				</div>
			</div>
		</footer>
	);
}

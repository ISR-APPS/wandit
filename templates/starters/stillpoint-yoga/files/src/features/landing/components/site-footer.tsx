// The night footer: the moonlit breathing rings, the big wordmark, four columns, and the sign-off line.
// LandingPage renders it last. The ground is the ink of the page; the text is bone at three steps.
import { useT } from "~/shared/i18n";
import { NAV_LINKS } from "../lib/nav-links";

/** The footer links share this underline that turns clay on hover. */
const FOOT_LINK =
	"inline-flex min-h-11 items-center border-transparent border-b text-(--sp-on-night) no-underline transition-colors duration-500 hover:border-(--sp-terra) hover:text-background md:min-h-0";

/** A column title. */
const FOOT_HEAD =
	"mb-[18px] font-bold font-sans text-(--sp-on-night-soft) text-[0.7rem] uppercase tracking-[0.28em]";

/** The footer. The section links skip "The studio" and keep the four the visitor most needs. */
export function SiteFooter() {
	const { t } = useT();
	return (
		<footer className="relative overflow-hidden bg-foreground text-(--sp-on-night)">
			<svg
				viewBox="0 0 600 600"
				aria-hidden="true"
				className="sp-foot-rings pointer-events-none absolute -end-[10%] -top-[16%] w-[min(58vw,700px)] min-w-[360px]"
			>
				<circle cx="300" cy="300" r="170" className="sp-breathe" />
				<circle cx="300" cy="300" r="234" className="sp-breathe-late" />
				<circle cx="300" cy="300" r="296" className="sp-breathe-late2" />
			</svg>
			<div className="relative mx-auto w-full max-w-[1180px] px-[clamp(22px,5vw,72px)] pt-[clamp(64px,9vw,110px)] pb-10">
				<p className="font-display text-(--sp-bone) text-[clamp(3rem,8vw,6.4rem)] leading-none tracking-[-0.02em]">
					{t("site.brand")}
					<em className="text-(--sp-moon-sage) not-italic">.</em>
				</p>
				<div className="mt-[clamp(44px,6vw,72px)] grid gap-[clamp(28px,4vw,56px)] min-[521px]:grid-cols-2 min-[881px]:grid-cols-[1.4fr_1fr_1fr_1fr]">
					<div>
						<p className={FOOT_HEAD}>{t("footer.ideaLabel")}</p>
						<p className="max-w-[30ch] text-(--sp-on-night-soft) text-[0.95rem] leading-[1.7]">
							{t("footer.idea")}
						</p>
					</div>
					<div>
						<p className={FOOT_HEAD}>{t("footer.visitLabel")}</p>
						<ul className="flex list-none flex-col gap-2.5 text-[0.95rem]">
							<li>{t("begin.visitValue")}</li>
							<li className="tabular-nums">{t("begin.doorsWeek")}</li>
							<li className="tabular-nums">{t("begin.doorsWeekend")}</li>
						</ul>
					</div>
					<div>
						<p className={FOOT_HEAD}>{t("footer.talkLabel")}</p>
						<ul className="flex list-none flex-col gap-2.5 text-[0.95rem] md:gap-2.5">
							<li>
								<a
									href={t("begin.phoneHref")}
									className={`${FOOT_LINK} tabular-nums`}
								>
									{t("begin.phoneDisplay")}
								</a>
							</li>
							<li>
								<a
									href={`mailto:${t("begin.emailDisplay")}`}
									className={FOOT_LINK}
								>
									{t("begin.emailDisplay")}
								</a>
							</li>
						</ul>
					</div>
					<div>
						<p className={FOOT_HEAD}>{t("footer.exploreLabel")}</p>
						<ul className="flex list-none flex-col gap-2.5 text-[0.95rem]">
							{NAV_LINKS.filter((link) => link.href !== "#studio").map(
								(link) => (
									<li key={link.href}>
										<a href={link.href} className={FOOT_LINK}>
											{t(link.labelKey)}
										</a>
									</li>
								),
							)}
						</ul>
					</div>
				</div>
				<div className="mt-[clamp(48px,7vw,80px)] flex flex-wrap items-center justify-between gap-[18px] border-(--sp-on-night-soft)/30 border-t pt-[26px] text-(--sp-on-night-soft) text-[0.8rem]">
					{/* The prerender writes the build year. A visit in a later year keeps that text until the next build. */}
					<span suppressHydrationWarning>
						© {new Date().getFullYear()} {t("footer.copyright")}
					</span>
					<span className="inline-flex items-center gap-2.5">
						<i
							aria-hidden="true"
							className="sp-core-pulse block size-2 rounded-full bg-(--sp-moon-sage)"
						/>
						{t("footer.stillBreathing")}
					</span>
				</div>
			</div>
		</footer>
	);
}

// The first screen: the statement and the Art. 1 teaser on the start side, the letterhead, the drawn drawer,
// and the nameplate on the end rail, then the rail of five practice tabs on the rule that opens the next section.
// LandingPage renders it. The entrances are CSS animations, so the hero ends complete with no script.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { CONSULTATION_HREF } from "../lib/content";
import { enterDelay } from "../lib/motion";
import { BUTTON_TEXT, LABEL } from "../lib/type-styles";
import { ClauseHead } from "./clause-head";
import { FilingDrawer } from "./filing-drawer";
import { Nameplate } from "./nameplate";
import { PracticeRail } from "./practice-rail";

/** The tab-railed masthead. The h1 of the page is here. */
export function HeroSection() {
	const { t } = useT();
	const letterhead = [
		{
			label: t("hero.officeLabel"),
			value: [t("site.addressLine1"), t("site.addressLine2")],
		},
		{ label: t("hero.hoursLabel"), value: [t("site.hours")] },
		{ label: t("hero.barLabel"), value: [t("site.barNumber")] },
	];
	return (
		<section
			aria-labelledby="hero-title"
			className="pt-[clamp(2.2rem,5vh,4.2rem)]"
		>
			<div className="vt-wrap grid gap-10 lg:grid-cols-[minmax(0,1fr)_clamp(19rem,28%,23rem)] lg:gap-[clamp(2rem,3.6vw,3.6rem)]">
				<div className="flex flex-col gap-[clamp(1.3rem,2.4vw,2rem)]">
					<p
						className="vt-enter-start flex items-center gap-4"
						style={enterDelay(100)}
					>
						<span
							aria-hidden="true"
							className="h-px w-[clamp(34px,5vw,74px)] shrink-0 bg-(--vt-brass)"
						/>
						<span className={cn(LABEL, "text-(--vt-brass) leading-snug")}>
							{t("hero.eyebrow")}
						</span>
					</p>
					<h1
						id="hero-title"
						className="vt-enter-title font-display font-normal text-[clamp(2.4rem,5.6vw,4.7rem)] leading-[1.05] tracking-[-0.018em]"
					>
						{t("hero.titleLead")}{" "}
						<span className="text-(--vt-soft)">{t("hero.titleSoft")}</span>
					</h1>
					<p
						className="vt-enter-start max-w-[52ch] text-(--vt-ink-70) text-[clamp(1.05rem,1.25vw,1.2rem)] leading-[1.6]"
						style={enterDelay(650)}
					>
						{t("hero.lead")}
					</p>
					<div
						className="vt-enter-start flex flex-wrap gap-3"
						style={enterDelay(800)}
					>
						<a
							href={CONSULTATION_HREF}
							className={cn("vt-btn grow sm:grow-0", BUTTON_TEXT)}
						>
							{t("hero.ctaConsultation")}
						</a>
						<a
							href="#fees"
							className={cn("vt-btn vt-btn-ghost grow sm:grow-0", BUTTON_TEXT)}
						>
							{t("hero.ctaFees")}
						</a>
					</div>
					<div
						className="vt-enter-start vt-line max-w-[56ch] border-t pt-4"
						style={enterDelay(1000)}
					>
						<ClauseHead article={1} size="small">
							{t("hero.clauseTitle")}
						</ClauseHead>
						<p className="mt-2 text-(--vt-ink-70) text-[0.96rem]">
							{t("hero.clauseBody")}{" "}
							<a href="#firm" className="vt-renvoi">
								{t("hero.clauseLink")}
							</a>
						</p>
					</div>
				</div>

				<aside
					aria-label={t("hero.letterheadLabel")}
					className="grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:flex lg:flex-col lg:justify-between lg:gap-[clamp(1.2rem,2.2vw,1.9rem)]"
				>
					<dl
						className="vt-enter-end vt-line grid grid-cols-[auto_1fr] items-baseline gap-x-5 gap-y-2.5 border-t pt-3.5 sm:max-lg:self-start"
						style={enterDelay(250)}
					>
						{letterhead.map((entry) => (
							<div key={entry.label} className="contents">
								<dt className={cn(LABEL, "text-(--vt-brass) text-[10.5px]")}>
									{entry.label}
								</dt>
								<dd className="font-display text-(--vt-ink-70) text-[0.98rem] leading-[1.35]">
									{entry.value.map((line) => (
										<span key={line} className="block">
											{line}
										</span>
									))}
								</dd>
							</div>
						))}
					</dl>
					<div
						className="vt-enter-end w-full max-w-[26rem] sm:row-span-2 sm:self-center lg:max-w-none"
						style={enterDelay(500)}
					>
						<FilingDrawer className="block h-auto w-full" />
					</div>
					<div
						className="vt-enter-end flex flex-col gap-4"
						style={enterDelay(900)}
					>
						<Nameplate
							size="large"
							name={t("site.firmName")}
							sub={t("hero.plateSub")}
						/>
						<p className="flex flex-wrap gap-x-6 gap-y-1 text-(--vt-ink-50) text-xs tracking-[0.05em]">
							<span>{t("hero.factPartners")}</span>
							<span>{t("hero.factAssociates")}</span>
							<span>{t("hero.factAppointment")}</span>
						</p>
					</div>
				</aside>
			</div>
			<PracticeRail />
		</section>
	);
}

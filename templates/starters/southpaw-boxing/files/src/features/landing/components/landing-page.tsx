// The public home page of Southpaw Boxing Club: a fight poster, seven numbered rounds, and the footer.
// The "/" route renders it, and the build prerenders it.
// It owns one piece of state: the program on the booking ticket. The fight card and the ticket both set it.
import { useState } from "react";
import { useT } from "~/shared/i18n";
import "../landing.css";
import type { BoutChoice, BoutId } from "../lib/content";
import { BeltsSection } from "./belts-section";
import { BookSection } from "./book-section";
import { CodeSection } from "./code-section";
import { CornerSection } from "./corner-section";
import { DistanceSection } from "./distance-section";
import { FightCardSection } from "./fight-card-section";
import { GritDefs } from "./grit-defs";
import { HeroPoster } from "./hero-poster";
import { RoundDivider } from "./round-divider";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { WeeklyBillSection } from "./weekly-bill-section";

/** The landing page. Every section is one component of this folder. */
export function LandingPage() {
	const { t } = useT();
	// The main event starts on the ticket, so the card and the ticket show a real program at first sight.
	const [choice, setChoice] = useState<BoutChoice>("fundamentals");

	// A claim on the fight card fills the ticket, then shows it.
	const claimBout = (id: BoutId) => {
		setChoice(id);
		// The scroll is explicit: Safari does not focus a clicked button, so the CSS smooth scroll does not apply there.
		const isMotionReduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		document
			.getElementById("book")
			?.scrollIntoView({ behavior: isMotionReduced ? "auto" : "smooth" });
	};

	return (
		<div className="sp-page min-h-svh bg-background text-foreground">
			<a
				href="#top"
				className="sr-only z-60 bg-foreground px-4 py-2.5 font-bold text-background text-xs uppercase tracking-[0.14em] focus-visible:not-sr-only focus-visible:fixed focus-visible:start-4 focus-visible:top-4"
			>
				{t("site.skipLink")}
			</a>
			<GritDefs />
			<SiteHeader />
			<main id="top">
				<HeroPoster />
				<CodeSection />
				<RoundDivider nextRound={2} />
				<FightCardSection choice={choice} onClaim={claimBout} />
				<RoundDivider nextRound={3} />
				<CornerSection />
				<RoundDivider nextRound={4} />
				<WeeklyBillSection />
				<RoundDivider nextRound={5} />
				<DistanceSection />
				<RoundDivider nextRound={6} />
				<BeltsSection />
				<RoundDivider nextRound={7} isChampionship />
				<BookSection choice={choice} onChoose={setChoice} />
			</main>
			<SiteFooter />
		</div>
	);
}

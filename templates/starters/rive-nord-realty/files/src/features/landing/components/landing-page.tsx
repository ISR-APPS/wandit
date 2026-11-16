// The home page of Rive Nord Realty: today's board of an estate agency, as one long page.
// The "/" route renders it, and the build prerenders it. It imports landing.css and renders every section.
// It owns the register filter, because the district sheet of the map can set it too.
import { useState } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import "../landing.css";
import { LABEL } from "../lib/type-styles";
import { CallBar } from "./call-bar";
import { DistrictsSection } from "./districts-section";
import { HeroSection } from "./hero-section";
import { MethodSection } from "./method-section";
import { NumbersSection } from "./numbers-section";
import { type RegisterFilter, RegisterSection } from "./register-section";
import { SellSection } from "./sell-section";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { WordBand } from "./word-band";

/** Section order follows the printed board: hero, register, districts, method, numbers, words, sell. */
export function LandingPage() {
	const { t } = useT();
	const [filter, setFilter] = useState<RegisterFilter>("all");

	return (
		<div className="rn-page min-h-svh bg-background text-foreground">
			<a
				href="#register"
				className={cn(
					LABEL,
					"sr-only z-50 bg-primary px-4 py-2.5 text-primary-foreground focus:not-sr-only focus:fixed focus:start-2 focus:top-2",
				)}
			>
				{t("site.skipLink")}
			</a>
			<SiteHeader />
			<main>
				<HeroSection />
				<RegisterSection filter={filter} onFilterChange={setFilter} />
				<DistrictsSection onShowHomes={setFilter} />
				<MethodSection />
				<NumbersSection />
				<WordBand />
				<SellSection />
			</main>
			<SiteFooter />
			<CallBar />
		</div>
	);
}

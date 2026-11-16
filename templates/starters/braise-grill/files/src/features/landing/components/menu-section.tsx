// Section 02, the menu: the showpiece of the page. The smoke rises in a sticky rail while the slates scroll past.
// LandingPage renders it on the first ground. It reads MENU_SLATES of lib/content.ts and runs use-smoke-scrub.ts.
import { useRef } from "react";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useSmokeScrub } from "../hooks/use-smoke-scrub";
import { MENU_SLATES } from "../lib/content";
import { LEAD_TEXT, SECTION_TITLE } from "../lib/type-styles";
import { Eyebrow } from "./eyebrow";
import { FeastSlate } from "./feast-slate";
import { MenuSlate } from "./menu-slate";
import { SmokeRail } from "./smoke-rail";

/** The menu. Four slates in a 2 x 2 grid, then the wide fire menu. One column under 860px. */
export function MenuSection() {
	const { t } = useT();
	const sectionRef = useRef<HTMLElement>(null);
	useSmokeScrub(sectionRef);

	return (
		<section
			ref={sectionRef}
			id="menu"
			aria-labelledby="menu-title"
			className="br-section bg-background"
		>
			<div className="br-wrap br-carte">
				<header
					className="br-carte__head mb-[clamp(32px,5vh,58px)] grid gap-x-[clamp(20px,4vw,64px)] gap-y-[clamp(14px,2.4vh,22px)] min-[860px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] min-[860px]:items-end"
					data-reveal="rise"
				>
					<Eyebrow className="min-[860px]:col-span-2">
						{t("menu.eyebrow")}
					</Eyebrow>
					<div>
						<h2
							id="menu-title"
							className={cn(SECTION_TITLE, "mb-[18px] max-w-[20ch]")}
						>
							{t("menu.title")}
						</h2>
						<span aria-hidden="true" className="br-uline br-uline--wide" />
					</div>
					<p className={cn(LEAD_TEXT, "mb-1.5")}>{t("menu.lead")}</p>
				</header>

				<SmokeRail />

				<div className="br-carte__list">
					{MENU_SLATES.map((slate) => (
						<MenuSlate key={slate.id} slate={slate} />
					))}
					<FeastSlate />
				</div>
			</div>
		</section>
	);
}

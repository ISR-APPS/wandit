// The closing edge of the hero: five large tabs that name the practice areas, riding the rule of the next section.
// HeroSection renders it. Each tab is an anchor to the panel of its area in PracticesSection.
// Below 768px the five tabs sit in two columns, each cell on its own rule, so no tab is cut.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { PRACTICE_IDS } from "../lib/content";
import { enterDelay } from "../lib/motion";
import { DossierTab } from "./dossier-tab";

/** The 46px tab rail. The last cell spans the two columns on a phone. */
export function PracticeRail() {
	const { t } = useT();
	return (
		<nav
			aria-label={t("hero.railLabel")}
			className="mt-[clamp(3rem,6vh,5rem)] border-(--vt-line) md:border-b"
		>
			<ul className="vt-wrap grid grid-cols-2 gap-x-1.5 gap-y-3 md:flex md:items-end md:gap-1.5">
				{PRACTICE_IDS.map((id, index) => (
					<li
						key={id}
						className={cn(
							"vt-enter-start flex border-(--vt-line) border-b md:flex-1 md:border-b-0",
							index === PRACTICE_IDS.length - 1 && "col-span-2",
						)}
						// The rail starts after the last hero block (1000 ms) and staggers 60 ms per tab.
						style={enterDelay(1100 + index * 60)}
					>
						<DossierTab
							href={`#practice-${id}`}
							size="rail"
							className="w-full max-lg:[&>span]:text-[10px] max-lg:[&>span]:tracking-[0.1em]"
						>
							{t(`practices.${id}.name`)}
						</DossierTab>
					</li>
				))}
			</ul>
		</nav>
	);
}

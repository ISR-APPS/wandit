// The sticky header of the home page: the wordmark, the five section tabs on the brass rule, and the telephone.
// LandingPage renders it. Every link is an anchor of the same page, so it works with no script.
// Below 1024px the tabs move to the phone menu of site-menu.tsx. The ground is solid green, never glass.
import { useT } from "~/shared/i18n";
import { SECTIONS } from "../lib/content";
import { DossierTab } from "./dossier-tab";
import { SiteMenu } from "./site-menu";
import { Wordmark } from "./wordmark";

/** A 66px bar on a 1px brass rule. The last tab, Consultation, is the filled brass call to action. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className="vt-line sticky top-0 z-40 border-b bg-(--vt-ground)">
			<div className="vt-wrap flex min-h-16 items-end gap-6">
				<a
					href="#top"
					className="inline-flex min-h-11 items-center self-center text-[1.05rem] sm:text-[1.12rem]"
				>
					<Wordmark />
				</a>
				<nav
					aria-label={t("site.navLabel")}
					className="ms-auto hidden items-end gap-1 lg:flex"
				>
					{SECTIONS.map((section, index) => (
						<DossierTab
							key={section.href}
							href={section.href}
							isOn={index === SECTIONS.length - 1}
							className="[--tab-px:16px] xl:[--tab-px:20px]"
						>
							{t(section.label)}
						</DossierTab>
					))}
				</nav>
				<div className="ms-auto flex items-center gap-2 self-center lg:ms-0">
					{/* From 1024px to 1279px the five tabs need the room, so the number hides. Below 400px the menu needs it. */}
					<a
						href={t("site.phoneHref")}
						className="hidden min-h-11 items-center whitespace-nowrap px-1 font-display text-[1.02rem] tabular-nums transition-colors hover:text-(--vt-brass) xl:ms-4 xl:inline-flex min-[400px]:max-lg:inline-flex"
					>
						{t("site.phoneDisplay")}
					</a>
					<SiteMenu />
				</div>
			</div>
		</header>
	);
}

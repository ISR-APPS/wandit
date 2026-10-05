/**
 * The fixed top bar of the landing page. pages/landing-page.tsx and
 * pages/pricing-page.tsx render it. It is clear over the top of the ember
 * hero and the closing panel, solid ember when their content is under it,
 * and frosted paper in between.
 * It holds the section links, the language menu, and sign-in.
 */

import { Link, useLocation } from "@tanstack/react-router";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { cn } from "@wandit/ui/lib/utils";
import { ChevronDownIcon } from "lucide-react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useEffect, useState } from "react";

import { LocaleFlag } from "@/components/language-flags";
import { LanguageSwitcherMenuItems } from "@/components/language-switcher";
import { Spark } from "@/components/logo";
import { UserMenu, useAuthModal, useSession } from "@/features/auth";
import { localeMeta, useDictionary, useTranslation } from "@/lib/i18n";

import { LANDING_NAV_LINK_IDS } from "../lib/constants";
import { CLOSING_PANEL_ID, HERO_PANEL_ID, scrollToTop } from "../lib/scroll";
import { useSectionNav } from "../lib/use-section-nav";
import { KeycapButton, keycapClassName } from "./keycap-button";

// Vertical middle of the 64 px bar. The bar takes an ember look while
// this line is over an ember panel.
const BAR_MIDDLE_PX = 32;

// The sections the scroll spy watches. Pricing is a route, not a section.
const SPIED_SECTION_IDS = LANDING_NAV_LINK_IDS.filter((id) => id !== "pricing");

/**
 * The look of the bar. `clear` shows the ember panel through the bar.
 * `ember` is a solid fill, `paper` is frosted paper.
 */
type BarTone = "clear" | "ember" | "paper";

/**
 * Picks the bar look from the two ember panels. The hero can be taller than
 * the viewport on mobile, so the bar measures the panels, not the scroll position.
 */
function measureBarTone(): BarTone {
	for (const id of [HERO_PANEL_ID, CLOSING_PANEL_ID]) {
		const panel = document.getElementById(id);
		if (!panel) continue;
		const { top, bottom } = panel.getBoundingClientRect();
		if (top <= BAR_MIDDLE_PX && bottom >= BAR_MIDDLE_PX) {
			// When the panel top is above the viewport, the panel content is under
			// the bar. A clear bar then mixes that content with the logo and the buttons.
			return top >= 0 ? "clear" : "ember";
		}
	}
	return "paper";
}

/** Returns the id of the spied section under the middle of the viewport, or null. */
function useActiveSection() {
	const [activeId, setActiveId] = useState<string | null>(null);

	useEffect(() => {
		// The thin band at 45 to 50 % of the viewport height decides the
		// active section, so only one section can match at a time.
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const { id } = entry.target;
					if (entry.isIntersecting) {
						setActiveId(id);
					} else {
						setActiveId((current) => (current === id ? null : current));
					}
				}
			},
			{ rootMargin: "-45% 0px -50% 0px" },
		);
		for (const id of SPIED_SECTION_IDS) {
			const section = document.getElementById(id);
			if (section) observer.observe(section);
		}
		return () => observer.disconnect();
	}, []);

	return activeId;
}

/** Fixed landing bar. Signed out it opens the auth modal, signed in it links to the dashboard. */
export function SiteNav() {
	const { t, locale } = useTranslation();
	const nav = useDictionary().landing.nav;
	const { data: session } = useSession();
	const { open } = useAuthModal();
	const activeId = useActiveSection();
	const navigateToSection = useSectionNav();
	const pathname = useLocation({ select: (location) => location.pathname });
	const isHome = pathname === "/";
	const { scrollY } = useScroll();
	// The page opens at the top, over the hero. The panels are not in the DOM
	// at the first render, so the first scroll event sets the real value.
	const [barTone, setBarTone] = useState<BarTone>("clear");
	const isOnPaper = barTone === "paper";

	useMotionValueEvent(scrollY, "change", () => setBarTone(measureBarTone()));

	// Spark is under 3:1 on ember, so the ring is white there.
	const focusRing = isOnPaper
		? "focus-visible:outline-ember"
		: "focus-visible:outline-white";
	const quietControl = cn(
		"whitespace-nowrap rounded-full outline-offset-2 transition-colors duration-300 focus-visible:outline-2",
		focusRing,
		// Small text on ember stays night: white is only 3.9:1 there. A fill shows the hover.
		isOnPaper ? "text-night/70 hover:text-night" : "hover:bg-white/15",
	);

	return (
		<header
			className={cn(
				"fixed inset-x-0 top-0 z-40 border-b px-2 text-night transition-[background-color,border-color,padding] duration-300 motion-reduce:transition-[background-color,border-color] md:px-3",
				// Clear, the bar sits inside the inset panel. The gap keeps the buttons
				// off the top edge of the panel. A filled bar starts at the window top.
				barTone === "clear" && "pt-4 md:pt-6",
				isOnPaper
					? "border-night/10 bg-paper/85 backdrop-blur-md"
					: "border-transparent",
			)}
		>
			{/* The ember fill is inside the header padding. Thus its edges align
			    with the edges of the inset panel. */}
			<div
				className={cn(
					"transition-[background-color,box-shadow] duration-300",
					barTone === "ember" &&
						"bg-ember shadow-[0_12px_24px_-16px_rgb(11_16_51/0.45)]",
				)}
			>
				<div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 md:px-8 lg:grid lg:grid-cols-[1fr_auto_1fr]">
					{/* On the home page the logo scrolls to the top. On the pricing page it goes home. */}
					<Link
						to="/"
						onClick={(event) => {
							if (!isHome) return;
							event.preventDefault();
							scrollToTop();
						}}
						aria-label={
							isHome ? t("landing.nav.backToTop") : t("landing.nav.home")
						}
						className={cn(
							"group/logo flex min-h-11 items-center gap-2 justify-self-start rounded-xl outline-offset-4 focus-visible:outline-2",
							focusRing,
						)}
					>
						{/* The mark sits on an app-icon tile: Wandit makes apps. */}
						<span
							aria-hidden
							className="grid size-8 place-items-center rounded-[10px] bg-night"
						>
							<Spark className="size-4.5 text-spark transition-transform duration-500 ease-out group-hover/logo:rotate-90 motion-reduce:transition-none" />
						</span>
						{/* The wordmark keeps the Latin brand face in every locale: index.css
						    gives lang="en" the Latin face. Signed in on a phone, the dashboard
						    link and the avatar need its width. */}
						<span
							lang="en"
							className={cn(
								"font-extrabold font-grotesk text-[1.375rem] leading-none tracking-[-0.045em]",
								// 22 px extra bold is large text, so white passes 3:1 on ember.
								!isOnPaper && "text-white",
								session && "max-sm:hidden",
							)}
						>
							wandit
						</span>
					</Link>

					<nav className="hidden items-center gap-1 lg:flex">
						{LANDING_NAV_LINK_IDS.map((id) => {
							// Pricing is a page of its own. The other links are sections of the home page.
							const isActive =
								id === "pricing" ? pathname === "/pricing" : id === activeId;
							const linkClass = cn(
								quietControl,
								"relative px-3.5 py-2 font-medium text-sm",
								isActive && "text-night",
							);
							const label = (
								<>
									{/* The pill glides to the section the visitor reads now. */}
									{isActive ? (
										<motion.span
											layoutId="site-nav-active"
											aria-hidden
											transition={{
												type: "spring",
												bounce: 0.2,
												duration: 0.5,
											}}
											className={cn(
												"absolute inset-0 rounded-full",
												isOnPaper ? "bg-night/[0.07]" : "bg-white/25",
											)}
										/>
									) : null}
									<span className="relative">{nav.links[id]}</span>
								</>
							);
							if (id === "pricing") {
								return (
									<Link key={id} to="/pricing" className={linkClass}>
										{label}
									</Link>
								);
							}
							return (
								<a
									key={id}
									// The full path keeps the link true on the pricing page and in a new tab.
									href={`/#${id}`}
									onClick={(event) => {
										event.preventDefault();
										navigateToSection(id);
									}}
									aria-current={isActive ? "location" : undefined}
									className={linkClass}
								>
									{label}
								</a>
							);
						})}
					</nav>

					<div className="flex items-center gap-1.5 justify-self-end sm:gap-2">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									aria-label={t("common.changeLanguage")}
									className={cn(
										"group/lang flex h-11 min-w-11 items-center justify-center gap-2 rounded-full outline-offset-2 ring-1 transition-[background-color,box-shadow] duration-300 focus-visible:outline-2 md:ps-2 md:pe-3 lg:h-10",
										focusRing,
										isOnPaper
											? "ring-night/12 hover:bg-night/5"
											: "ring-night/20 hover:bg-white/15",
									)}
								>
									<LocaleFlag locale={locale} className="size-6 ring-0" />
									<span className="hidden font-medium text-sm md:inline">
										{localeMeta[locale].nativeLabel}
									</span>
									<ChevronDownIcon
										aria-hidden
										className="hidden size-3.5 opacity-70 transition-transform duration-200 group-data-[state=open]/lang:rotate-180 md:block"
									/>
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								sideOffset={10}
								className="min-w-52 rounded-2xl p-1.5"
							>
								<LanguageSwitcherMenuItems />
							</DropdownMenuContent>
						</DropdownMenu>

						{session ? (
							<>
								<Link
									to="/dashboard"
									className={cn(
										keycapClassName("sm"),
										"h-11 px-4 lg:h-10",
										focusRing,
									)}
								>
									{nav.dashboard}
								</Link>
								<UserMenu />
							</>
						) : (
							<>
								<button
									type="button"
									onClick={() => open()}
									className={cn(
										quietControl,
										"hidden h-11 px-3.5 font-medium text-sm md:block lg:h-10",
									)}
								>
									{nav.signIn}
								</button>
								<KeycapButton
									type="button"
									size="sm"
									onClick={() => open()}
									className={cn("h-11 px-4 lg:h-10", focusRing)}
								>
									{nav.getStarted}
								</KeycapButton>
							</>
						)}
					</div>
				</div>
			</div>
		</header>
	);
}

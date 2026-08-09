import { Link, useLocation } from "@tanstack/react-router";
import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { useEffect, useState } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { UserMenu, useAuthModal, useSession } from "@/features/auth";

import { LANDING_NAV_LINK_IDS } from "../lib/constants";
import { scrollToTop } from "../lib/scroll";
import { useSectionNav } from "../lib/use-section-nav";

const navLinkClass =
	"rounded-md px-3 py-1.5 text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function LandingNav() {
	const [scrolled, setScrolled] = useState(false);
	const { data: session } = useSession();
	const { open } = useAuthModal();
	const { t } = useTranslation();
	const nav = useDictionary().landing.nav;
	const navigateToSection = useSectionNav();
	const isHome = useLocation({
		select: (location) => location.pathname === "/",
	});

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 12);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<header
			className={cn(
				"fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-300",
				scrolled
					? "border-border bg-background/70 backdrop-blur-md"
					: "border-transparent bg-transparent",
			)}
		>
			<div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:h-16 md:px-6">
				{isHome ? (
					<button
						type="button"
						onClick={scrollToTop}
						className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
						aria-label={t("landing.nav.backToTop")}
					>
						<Logo />
					</button>
				) : (
					<Link
						to="/"
						className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
						aria-label={t("landing.nav.home")}
					>
						<Logo />
					</Link>
				)}

				<nav className="hidden items-center gap-1 md:flex">
					{LANDING_NAV_LINK_IDS.map((id) =>
						id === "pricing" ? (
							<Link key={id} to="/pricing" className={navLinkClass}>
								{nav.links[id]}
							</Link>
						) : (
							<a
								key={id}
								href={`#${id}`}
								onClick={(e) => {
									e.preventDefault();
									navigateToSection(id);
								}}
								className={navLinkClass}
							>
								{nav.links[id]}
							</a>
						),
					)}
				</nav>

				<div className="flex items-center gap-1.5 sm:gap-2">
					<LanguageSwitcher variant="ghost" />
					<ModeToggle />
					{session ? (
						<>
							<Button asChild size="sm" variant="secondary">
								<Link to="/dashboard">{t("landing.nav.dashboard")}</Link>
							</Button>
							<UserMenu />
						</>
					) : (
						<>
							<Button size="sm" variant="ghost" onClick={() => open()}>
								{t("landing.nav.signIn")}
							</Button>
							<Button size="sm" onClick={() => open()}>
								{t("landing.nav.getStarted")}
							</Button>
						</>
					)}
				</div>
			</div>
		</header>
	);
}

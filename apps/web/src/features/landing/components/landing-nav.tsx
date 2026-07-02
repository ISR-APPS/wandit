import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { useEffect, useState } from "react";

import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { UserMenu, useAuthModal, useSession } from "@/features/auth";

import { LANDING_NAV } from "../lib/constants";
import { scrollToId, scrollToTop } from "../lib/scroll";

export function LandingNav() {
	const [scrolled, setScrolled] = useState(false);
	const { data: session } = useSession();
	const { open } = useAuthModal();

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
				<button
					type="button"
					onClick={scrollToTop}
					className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
					aria-label="Wandit — back to top"
				>
					<Logo />
				</button>

				<nav className="hidden items-center gap-1 md:flex">
					{LANDING_NAV.links.map((link) => (
						<a
							key={link.id}
							href={`#${link.id}`}
							onClick={(e) => {
								e.preventDefault();
								scrollToId(link.id);
							}}
							className="rounded-md px-3 py-1.5 text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
						>
							{link.label}
						</a>
					))}
				</nav>

				<div className="flex items-center gap-1.5 sm:gap-2">
					<ModeToggle />
					{session ? (
						<>
							<Button asChild size="sm" variant="secondary">
								<Link to="/dashboard">{LANDING_NAV.dashboard}</Link>
							</Button>
							<UserMenu />
						</>
					) : (
						<>
							<Button size="sm" variant="ghost" onClick={open}>
								{LANDING_NAV.signIn}
							</Button>
							<Button size="sm" onClick={open}>
								{LANDING_NAV.getStarted}
							</Button>
						</>
					)}
				</div>
			</div>
		</header>
	);
}

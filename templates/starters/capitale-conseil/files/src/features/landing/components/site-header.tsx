// The sticky header of the home page: the wordmark, the five movements, the counter, and the telephone.
// LandingPage renders it. Every link is an anchor of the same page, so it works with no script.
// Below 1024px the links move to the phone menu of site-menu.tsx. The ground is solid paper, never glass.
import { useT } from "~/shared/i18n";
import { MOVEMENTS } from "../lib/content";
import { MovementCounter } from "./movement-counter";
import { ReadingProgress } from "./reading-progress";
import { SiteMenu } from "./site-menu";
import { Wordmark } from "./wordmark";

/** A slim bar of 64px (68px from 900px) on a hairline. The reading hairline sits under it below 1180px. */
export function SiteHeader() {
	const { t } = useT();
	return (
		<header className="sticky top-0 z-40 border-foreground/12 border-b bg-background">
			<div className="cap-wrap flex h-(--cap-bar) items-center gap-6">
				<a href="#top" className="inline-flex min-h-11 items-center">
					<Wordmark className="text-[clamp(1.1rem,1.6vw,1.35rem)]" />
				</a>
				<nav
					aria-label={t("site.navLabel")}
					className="ms-auto hidden gap-[clamp(1.1rem,1.9vw,1.6rem)] lg:flex"
				>
					{MOVEMENTS.map((movement) => (
						<a
							key={movement.href}
							href={movement.href}
							className="whitespace-nowrap border-transparent border-b py-1.5 font-semibold text-[0.71875rem] text-foreground/65 uppercase tracking-[0.13em] transition-colors duration-[180ms] ease-linear hover:border-primary hover:text-foreground focus-visible:border-primary focus-visible:text-foreground"
						>
							{t(movement.label)}
						</a>
					))}
				</nav>
				<div className="ms-auto flex items-center gap-[1.1rem] lg:ms-0">
					<MovementCounter />
					<a
						href={t("site.phoneHref")}
						className="hidden min-h-11 items-center whitespace-nowrap border border-foreground/18 px-[0.9rem] font-semibold text-[0.71875rem] tabular-nums tracking-[0.1em] transition-colors duration-[180ms] ease-linear hover:border-foreground hover:text-primary focus-visible:border-foreground lg:min-h-9.5 min-[32.5rem]:inline-flex"
					>
						{t("site.phoneDisplay")}
					</a>
					<SiteMenu />
				</div>
			</div>
			<ReadingProgress />
		</header>
	);
}

// The header of the home page: the serif wordmark with its arch, the section links, and the arch-pill phone.
// LandingPage renders it over the hero. Below the lg width, MobileMenu replaces the section links.
import { useT } from "~/shared/i18n";
import type { MaterialId } from "../lib/materials";
import { SECTION_LINKS } from "../lib/sections";
import { ArchGlyph } from "./arch-glyph";
import { MobileMenu } from "./mobile-menu";

/** The page header. It sits on the hero and scrolls away with it. `material` is the chosen library material. */
export function SiteHeader({ material }: { material: MaterialId }) {
	const { t } = useT();
	return (
		<header className="absolute inset-x-0 top-0 z-20">
			<div className="mx-auto flex max-w-[1340px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:py-5">
				<a
					href="#top"
					aria-label={t("site.homeLink")}
					className="inline-flex min-h-11 items-center gap-2.5 font-display text-[1.35rem] leading-none"
				>
					<ArchGlyph className="h-4 w-[22px]" />
					{t("site.brand")}
				</a>
				<nav
					aria-label={t("nav.label")}
					className="hidden items-center gap-8 lg:flex"
				>
					{SECTION_LINKS.map((link) => (
						<a
							key={link.href}
							href={link.href}
							className="font-bold text-[0.95rem] underline-offset-[6px] transition-colors hover:underline"
						>
							{t(link.key)}
						</a>
					))}
				</nav>
				<div className="flex items-center gap-2">
					<a
						href={t("site.phoneHref")}
						className="louz-btn-ghost hidden min-h-11 items-center px-[1.2em] pt-[0.1em] font-bold text-[0.95rem] sm:inline-flex"
					>
						{t("site.phoneDisplay")}
					</a>
					<MobileMenu material={material} />
				</div>
			</div>
		</header>
	);
}

/**
 * The top bar of the dashboard pages, beside the floating sidebar.
 * DashboardShell renders it. It holds the sidebar toggle, the page title,
 * the credits chip, and the theme toggle. The page links, the feedback
 * entry, and the user menu are in the sidebar.
 */
import { SidebarSimpleIcon } from "@phosphor-icons/react/SidebarSimple";
import { Button } from "@wandit/ui/components/button";
import { useSidebar } from "@wandit/ui/components/sidebar";

import { ModeToggle } from "@/components/mode-toggle";
import { CreditsChip } from "@/features/credits";
import { type TranslationKey, useTranslation } from "@/lib/i18n";

/** `titleKey` is the dictionary key of the page title. The default is "Projects". */
export function DashboardHeader({
	titleKey = "projects.headerTitle",
}: {
	titleKey?: TranslationKey;
}) {
	const { t } = useTranslation();
	const { toggleSidebar } = useSidebar();
	return (
		// Beside the card the bar is 72 px, so its row centers on the logo row of
		// the card (8 px inset, 8 px padding, 40 px row). The phone has no card.
		<header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 bg-background/80 px-4 backdrop-blur-md md:h-18 md:px-6">
			<Button
				variant="ghost"
				size="icon"
				onClick={toggleSidebar}
				aria-label={t("projects.sidebar.toggleSidebar")}
				className="-ms-1 text-night/70 hover:bg-night/[0.06] hover:text-night dark:text-foreground/70 dark:hover:bg-white/[0.06]"
			>
				{/* The panel is on the left of the glyph. In Arabic the sidebar is on the right, so the glyph flips. */}
				<SidebarSimpleIcon
					aria-hidden
					weight="duotone"
					className="size-[18px] rtl:-scale-x-100"
				/>
			</Button>
			<h1 className="truncate font-bold font-grotesk text-night text-xl tracking-[-0.03em] dark:text-foreground">
				{t(titleKey)}
			</h1>
			<div className="ms-auto flex items-center gap-1.5">
				{/* No border color here: the chip tints its own border green when another workspace has credits. */}
				<CreditsChip className="h-9 whitespace-nowrap bg-white px-3.5 font-grotesk font-semibold shadow-[0_2px_0_rgb(11_16_51/0.06)] dark:bg-card" />
				<ModeToggle />
			</div>
		</header>
	);
}

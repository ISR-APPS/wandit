import { Separator } from "@wandit/ui/components/separator";
import { SidebarTrigger } from "@wandit/ui/components/sidebar";

import { ModeToggle } from "@/components/mode-toggle";
import { UserMenu } from "@/features/auth";
import { CreditsChip } from "@/features/credits";
import { type TranslationKey, useTranslation } from "@/lib/i18n";

export function DashboardHeader({
	titleKey = "projects.headerTitle",
}: {
	titleKey?: TranslationKey;
}) {
	const { t } = useTranslation();
	return (
		<header className="sticky top-0 z-40 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/60 px-4 backdrop-blur-md md:rounded-t-xl">
			<SidebarTrigger
				className="-ms-1.5"
				label={t("projects.sidebar.toggleSidebar")}
			/>
			<Separator
				orientation="vertical"
				className="mx-1 data-[orientation=vertical]:h-4"
			/>
			<h1 className="font-display font-semibold text-base tracking-tight">
				{t(titleKey)}
			</h1>
			<div className="ms-auto flex items-center gap-1.5">
				<CreditsChip />
				<ModeToggle />
				<UserMenu />
			</div>
		</header>
	);
}

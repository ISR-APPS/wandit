import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import { Separator } from "@wandit/ui/components/separator";
import { SidebarTrigger } from "@wandit/ui/components/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { GraduationCap } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { UserMenu } from "@/features/auth";
import { CreditsChip } from "@/features/credits";
import { FeedbackButton } from "@/features/feedback";
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
				<Tooltip>
					<TooltipTrigger asChild>
						<Button asChild size="sm" variant="outline">
							<Link to="/academy" aria-label={t("academy.navLabel")}>
								<GraduationCap className="size-4" aria-hidden />
								<span className="hidden sm:inline">
									{t("academy.navLabel")}
								</span>
							</Link>
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">{t("academy.navLabel")}</TooltipContent>
				</Tooltip>
				<FeedbackButton />
				<CreditsChip />
				<ModeToggle />
				<UserMenu />
			</div>
		</header>
	);
}

// Workspace chrome: brand → dashboard, project switcher, autosave state,
// credits, theme, publish state and account. Workspace tabs live in the main
// card's header (shell/main-pane-header.tsx), not here. The header is a 52px
// translucent parchment bar floating over the ambient horizon band that the
// page layout renders behind it (see pages/workspace-page.tsx).

import { Link } from "@tanstack/react-router";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";

import { Spark } from "@/components/logo";
import { UserMenu } from "@/features/auth";
import { CreditsChip } from "@/features/credits";
import { useTranslation } from "@/lib/i18n";
import { WorkspaceSwitcher } from "@/features/workspaces/components/workspace-switcher";
import { ProjectSwitcher } from "./project-switcher";
import { PublishButton } from "./publish-button";

export function WorkspaceHeader() {
	const { t } = useTranslation();
	return (
		<header className="relative z-40 flex h-[52px] shrink-0 items-center gap-[11px] border-b bg-background/72 px-4 backdrop-blur-sm">
			<Tooltip>
				<TooltipTrigger asChild>
					<Link
						to="/dashboard"
						aria-label={t("workspace.backToDashboard")}
						className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						<span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-gradient-ember">
							<Spark className="size-3.5 text-background" />
						</span>
						<span className="hidden font-semibold text-foreground text-lg tracking-[-0.5px] sm:block">
							wandit
						</span>
					</Link>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					{t("workspace.backToDashboard")}
				</TooltipContent>
			</Tooltip>
			<span aria-hidden className="mx-[5px] h-[18px] w-px bg-border" />
			<WorkspaceSwitcher className="hidden w-44 md:flex" />
			<ProjectSwitcher />

			<div className="ms-auto flex items-center gap-2.5">
				<span className="hidden items-center gap-[7px] text-[13px] text-muted-foreground md:flex">
					<span aria-hidden className="size-1.5 rounded-full bg-success" />
					{t("workspace.autosaved")}
				</span>
				<CreditsChip />
				<PublishButton />
				<UserMenu />
			</div>
		</header>
	);
}

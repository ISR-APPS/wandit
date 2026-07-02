// Workspace chrome: brand → dashboard, project switcher, centered tabs,
// credits, theme, publish state and account.

import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import { Separator } from "@wandit/ui/components/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";

import { Spark } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { UserMenu } from "@/features/auth";
import { CreditsChip } from "@/features/credits";
import { WORKSPACE_COPY } from "../../lib/constants";
import { ProjectSwitcher } from "./project-switcher";
import { PublishButton } from "./publish-button";
import { WorkspaceTabs } from "./workspace-tabs";

export function WorkspaceHeader() {
	return (
		<header className="relative z-40 flex h-14 shrink-0 items-center gap-1.5 border-b bg-background/70 px-3 backdrop-blur-md">
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						asChild
						variant="ghost"
						size="icon-sm"
						aria-label={WORKSPACE_COPY.backToDashboard}
					>
						<Link to="/dashboard">
							<Spark className="size-4 text-primary" />
						</Link>
					</Button>
				</TooltipTrigger>
				<TooltipContent side="bottom">
					{WORKSPACE_COPY.backToDashboard}
				</TooltipContent>
			</Tooltip>
			<Separator
				orientation="vertical"
				className="mx-0.5 data-[orientation=vertical]:h-4"
			/>
			<ProjectSwitcher />

			<div className="absolute left-1/2 hidden -translate-x-1/2 lg:block">
				<WorkspaceTabs />
			</div>

			<div className="ml-auto flex items-center gap-1.5">
				<CreditsChip />
				<span className="hidden sm:block">
					<ModeToggle />
				</span>
				<Separator
					orientation="vertical"
					className="mx-0.5 hidden data-[orientation=vertical]:h-4 sm:block"
				/>
				<PublishButton />
				<UserMenu />
			</div>
		</header>
	);
}

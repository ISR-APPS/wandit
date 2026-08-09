/**
 * WorkspaceSwitcher — the dropdown that moves the whole app between the
 * personal workspace and the user's team workspaces (teams-workspaces.md §9).
 * Selecting an entry flips the shared scope store, so every subsequent
 * request (axios + AI stream) carries the new scope automatically.
 */

import { Link } from "@tanstack/react-router";
import type { WorkspaceSummary } from "@wandit/contracts";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@wandit/ui/components/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { cn } from "@wandit/ui/lib/utils";
import { Check, ChevronsUpDown, Gauge, Plus, User, Users } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/features/auth";
import { usePublicSettingsQuery } from "@/features/settings/api/settings.queries";
import { CreateWorkspaceDialog } from "@/features/workspaces/components/create-workspace-dialog";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { useTranslation } from "@/lib/i18n";

function workspaceInitials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? "")
		.join("");
}

function roleLabelKey(
	entry: WorkspaceSummary,
):
	| "workspaces.switcher.roleOwner"
	| "workspaces.switcher.roleAdmin"
	| "workspaces.switcher.roleMember" {
	if (entry.roles.includes("owner")) {
		return "workspaces.switcher.roleOwner";
	}

	if (entry.roles.includes("admin")) {
		return "workspaces.switcher.roleAdmin";
	}

	return "workspaces.switcher.roleMember";
}

export function WorkspaceSwitcher({ className }: { className?: string }) {
	const { t } = useTranslation();
	const [createOpen, setCreateOpen] = useState(false);
	const { data: session } = useSession();
	const settingsQuery = usePublicSettingsQuery();
	const {
		activeWorkspace,
		activeWorkspaceId,
		isPersonal,
		switchWorkspace,
		workspaces,
	} = useWorkspace();

	// Ships dark: without the kill switch (or memberships) the switcher
	// renders nothing and the app looks exactly like pre-teams.
	const organizationsEnabled =
		settingsQuery.data?.organizationsEnabled ?? false;
	// Creating a workspace goes straight into a Business subscription
	// checkout, so it also needs the paid-subscriptions switch — otherwise it
	// creates an org whose checkout the server then rejects.
	const canCreateWorkspace =
		organizationsEnabled &&
		settingsQuery.data?.paidSubscriptionsEnabled === true;

	if (!session || (!organizationsEnabled && workspaces.length === 0)) {
		return null;
	}

	const activeLabel = isPersonal
		? t("workspaces.switcher.personal")
		: (activeWorkspace?.name ?? "…");

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className={cn(
					"flex w-full items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-start text-sm hover:bg-accent",
					className,
				)}
				aria-label={t("workspaces.switcher.label")}
			>
				<Avatar className="size-5">
					{!isPersonal && activeWorkspace?.logo ? (
						<AvatarImage src={activeWorkspace.logo} alt="" />
					) : null}
					<AvatarFallback className="text-[10px]">
						{isPersonal ? (
							<User className="size-3" />
						) : (
							workspaceInitials(activeLabel)
						)}
					</AvatarFallback>
				</Avatar>
				<span className="min-w-0 flex-1 truncate font-medium">
					{activeLabel}
				</span>
				<ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-64">
				<DropdownMenuLabel>{t("workspaces.switcher.label")}</DropdownMenuLabel>
				<DropdownMenuItem
					onSelect={() => switchWorkspace("personal")}
					className="gap-2"
				>
					<Avatar className="size-6">
						<AvatarFallback>
							<User className="size-3.5" />
						</AvatarFallback>
					</Avatar>
					<span className="min-w-0 flex-1">
						<span className="block truncate font-medium">
							{t("workspaces.switcher.personal")}
						</span>
						<span className="block truncate text-muted-foreground text-xs">
							{t("workspaces.switcher.personalDescription")}
						</span>
					</span>
					{isPersonal ? <Check className="size-4 shrink-0" /> : null}
				</DropdownMenuItem>
				{workspaces.length > 0 ? <DropdownMenuSeparator /> : null}
				{workspaces.map((entry) => (
					<DropdownMenuItem
						key={entry.id}
						onSelect={() => switchWorkspace(entry.id)}
						className="gap-2"
					>
						<Avatar className="size-6">
							{entry.logo ? <AvatarImage src={entry.logo} alt="" /> : null}
							<AvatarFallback className="text-[10px]">
								{workspaceInitials(entry.name)}
							</AvatarFallback>
						</Avatar>
						<span className="min-w-0 flex-1">
							<span className="block truncate font-medium">{entry.name}</span>
							<span className="block truncate text-muted-foreground text-xs">
								{t(roleLabelKey(entry))}
							</span>
						</span>
						{activeWorkspaceId === entry.id ? (
							<Check className="size-4 shrink-0" />
						) : null}
					</DropdownMenuItem>
				))}
				{!isPersonal ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild className="gap-2">
							<Link to="/workspace/members">
								<Users className="size-4" />
								{t("workspaces.members.title")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild className="gap-2">
							<Link to="/workspace/limits">
								<Gauge className="size-4" />
								{t("workspaces.limits.title")}
							</Link>
						</DropdownMenuItem>
					</>
				) : null}
				{canCreateWorkspace ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onSelect={() => setCreateOpen(true)}
							className="gap-2"
						>
							<Plus className="size-4" />
							{t("workspaces.switcher.create")}
						</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuContent>
			<CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
		</DropdownMenu>
	);
}

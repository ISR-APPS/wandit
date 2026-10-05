/**
 * WorkspaceSwitcher — the dropdown that moves the whole app between the
 * personal workspace and the user's team workspaces (teams-workspaces.md §9).
 * Selecting an entry flips the shared scope store, so every subsequent
 * request (axios + AI stream) carries the new scope automatically.
 */

import { CaretUpDownIcon } from "@phosphor-icons/react/CaretUpDown";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { GaugeIcon } from "@phosphor-icons/react/Gauge";
import { PlusIcon } from "@phosphor-icons/react/Plus";
import { UserIcon } from "@phosphor-icons/react/User";
import { UsersThreeIcon } from "@phosphor-icons/react/UsersThree";
import { Link } from "@tanstack/react-router";
import { PERSONAL_WORKSPACE, type WorkspaceSummary } from "@wandit/contracts";
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
import { useState } from "react";
import { useSession } from "@/features/auth";
import { useWorkspaceCreditBalancesQuery } from "@/features/credits/api/credits.queries";
import { formatCreditBalance } from "@/features/credits/lib/format-credits";
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

// The row of the current workspace gets the spark tint, like the picked rows of the other menus.
const ACTIVE_ROW_CLASS = "bg-spark/[0.14] focus:bg-spark/20";

/** The ember check at the end of the current workspace row. */
function ActiveCheck() {
	return (
		<CheckIcon
			aria-hidden
			weight="bold"
			className="size-4 shrink-0 text-primary"
		/>
	);
}

function SettledBalanceValue({ value }: { value: string | null }) {
	if (value === null) {
		return null;
	}

	return (
		<span className="shrink-0 font-grotesk font-semibold text-popover-foreground/60 text-xs tabular-nums">
			{value}
		</span>
	);
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
	const { locale, t } = useTranslation();
	const [createOpen, setCreateOpen] = useState(false);
	const { data: session } = useSession();
	const settingsQuery = usePublicSettingsQuery();
	const balancesQuery = useWorkspaceCreditBalancesQuery({
		enabled: Boolean(session),
	});
	const {
		activeWorkspace,
		activeWorkspaceId,
		isPersonal,
		switchWorkspace,
		workspaces,
	} = useWorkspace();

	// Each entry's settled credit pool, right-aligned and muted. Settled
	// balances (holds added back) so a running generation never bounces the
	// number mid-dropdown.
	const settledBalanceFor = (workspaceId: string): string | null => {
		const item = balancesQuery.data?.items.find(
			(entry) => entry.workspaceId === workspaceId,
		);

		return item ? formatCreditBalance(item.settledBalance, locale) : null;
	};

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
							<UserIcon aria-hidden weight="duotone" className="size-3.5" />
						) : (
							workspaceInitials(activeLabel)
						)}
					</AvatarFallback>
				</Avatar>
				<span className="min-w-0 flex-1 truncate font-medium">
					{activeLabel}
				</span>
				<CaretUpDownIcon
					aria-hidden
					weight="bold"
					className="size-3.5 shrink-0 text-muted-foreground"
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-64">
				<DropdownMenuLabel>{t("workspaces.switcher.label")}</DropdownMenuLabel>
				<DropdownMenuItem
					onSelect={() => switchWorkspace("personal")}
					className={cn(isPersonal && ACTIVE_ROW_CLASS)}
				>
					<Avatar className="size-8">
						<AvatarFallback>
							<UserIcon aria-hidden weight="duotone" className="size-4" />
						</AvatarFallback>
					</Avatar>
					<span className="min-w-0 flex-1">
						<span className="block truncate">
							{t("workspaces.switcher.personal")}
						</span>
						<span className="block truncate font-normal font-sans text-muted-foreground text-xs">
							{t("workspaces.switcher.personalDescription")}
						</span>
					</span>
					<SettledBalanceValue value={settledBalanceFor(PERSONAL_WORKSPACE)} />
					{isPersonal ? <ActiveCheck /> : null}
				</DropdownMenuItem>
				{workspaces.length > 0 ? <DropdownMenuSeparator /> : null}
				{workspaces.map((entry) => (
					<DropdownMenuItem
						key={entry.id}
						onSelect={() => switchWorkspace(entry.id)}
						className={cn(activeWorkspaceId === entry.id && ACTIVE_ROW_CLASS)}
					>
						<Avatar className="size-8">
							{entry.logo ? <AvatarImage src={entry.logo} alt="" /> : null}
							<AvatarFallback className="text-[10px]">
								{workspaceInitials(entry.name)}
							</AvatarFallback>
						</Avatar>
						<span className="min-w-0 flex-1">
							<span className="block truncate">{entry.name}</span>
							<span className="block truncate font-normal font-sans text-muted-foreground text-xs">
								{t(roleLabelKey(entry))}
							</span>
						</span>
						<SettledBalanceValue value={settledBalanceFor(entry.id)} />
						{activeWorkspaceId === entry.id ? <ActiveCheck /> : null}
					</DropdownMenuItem>
				))}
				{!isPersonal ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem asChild>
							<Link to="/workspace/members">
								<UsersThreeIcon aria-hidden weight="duotone" />
								{t("workspaces.members.title")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link to="/workspace/limits">
								<GaugeIcon aria-hidden weight="duotone" />
								{t("workspaces.limits.title")}
							</Link>
						</DropdownMenuItem>
					</>
				) : null}
				{canCreateWorkspace ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onSelect={() => setCreateOpen(true)}>
							<PlusIcon aria-hidden weight="bold" />
							{t("workspaces.switcher.create")}
						</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuContent>
			<CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
		</DropdownMenu>
	);
}

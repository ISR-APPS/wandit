/**
 * WorkspaceSwitcher — the dropdown that moves the whole app between the
 * user's workspaces (workspaces-sharing.md 6): the own personal workspace
 * (scope id `personal`, no header), team workspaces, then other users'
 * personal workspaces (their org id as the header).
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
import {
	formatCreditBalance,
	useWorkspaceCreditBalancesQuery,
} from "@/features/credits";
import { usePublicSettingsQuery } from "@/features/settings";
import { CreateWorkspaceDialog } from "@/features/workspaces/components/create-workspace-dialog";
import { initials } from "@/features/workspaces/lib/helpers";
import {
	useCollaborationGates,
	useWorkspace,
} from "@/features/workspaces/lib/workspace-provider";
import { highestWorkspaceRole } from "@/features/workspaces/lib/workspace-roles";
import { useTranslation } from "@/lib/i18n";

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

/** Rendered in the dashboard sidebar and the V1 builder header. Hidden while collaboration is off. */
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
	const { showsCollaboration, showsLimits, showsPeople } =
		useCollaborationGates();

	// Each entry's settled credit pool, right-aligned and muted. Settled
	// balances (holds added back) so a running generation never bounces the
	// number mid-dropdown.
	const settledBalanceFor = (workspaceId: string): string | null => {
		const item = balancesQuery.data?.items.find(
			(entry) => entry.workspaceId === workspaceId,
		);

		return item ? formatCreditBalance(item.settledBalance, locale) : null;
	};

	// Creating a workspace goes straight into a Business subscription
	// checkout, so it also needs the paid-subscriptions switch — otherwise it
	// creates an org whose checkout the server then rejects.
	const canCreateWorkspace =
		settingsQuery.data?.organizationsEnabled === true &&
		settingsQuery.data.paidSubscriptionsEnabled;

	// Ships dark: without the kill switch (or another membership) the switcher
	// renders nothing and the app looks exactly like pre-teams.
	if (!session || !showsCollaboration) {
		return null;
	}

	// An older API does not list the own personal workspace, so its name falls back to "Personal".
	const ownPersonal = workspaces.find((entry) => entry.isOwnPersonal);
	const ownPersonalName =
		ownPersonal?.name ?? t("workspaces.switcher.personal");
	const teamWorkspaces = workspaces.filter((entry) => entry.kind === "team");
	const sharedPersonalWorkspaces = workspaces.filter(
		(entry) => entry.kind === "personal" && !entry.isOwnPersonal,
	);
	const activeLabel = isPersonal
		? ownPersonalName
		: (activeWorkspace?.name ?? "…");

	const roleLabel = (entry: WorkspaceSummary): string => {
		const role = highestWorkspaceRole(entry.roles);

		return role ? t(`workspaces.roles.${role}`) : entry.role;
	};

	const workspaceRow = (entry: WorkspaceSummary) => (
		<DropdownMenuItem
			key={entry.id}
			onSelect={() => switchWorkspace(entry.id)}
			className={cn(activeWorkspaceId === entry.id && ACTIVE_ROW_CLASS)}
		>
			<Avatar className="size-8">
				{entry.logo ? <AvatarImage src={entry.logo} alt="" /> : null}
				<AvatarFallback className="text-[10px]">
					{/* A person icon marks another user's personal workspace. */}
					{entry.kind === "personal" ? (
						<UserIcon aria-hidden weight="duotone" className="size-4" />
					) : (
						initials(entry.name)
					)}
				</AvatarFallback>
			</Avatar>
			<span className="min-w-0 flex-1">
				<span className="block truncate">{entry.name}</span>
				<span className="block truncate font-normal font-sans text-muted-foreground text-xs">
					{roleLabel(entry)}
				</span>
			</span>
			<SettledBalanceValue value={settledBalanceFor(entry.id)} />
			{activeWorkspaceId === entry.id ? <ActiveCheck /> : null}
		</DropdownMenuItem>
	);

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
						{isPersonal || activeWorkspace?.kind === "personal" ? (
							<UserIcon aria-hidden weight="duotone" className="size-3.5" />
						) : (
							initials(activeLabel)
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
					onSelect={() => switchWorkspace(PERSONAL_WORKSPACE)}
					className={cn(isPersonal && ACTIVE_ROW_CLASS)}
				>
					<Avatar className="size-8">
						<AvatarFallback>
							<UserIcon aria-hidden weight="duotone" className="size-4" />
						</AvatarFallback>
					</Avatar>
					<span className="min-w-0 flex-1">
						<span className="block truncate">{ownPersonalName}</span>
						<span className="block truncate font-normal font-sans text-muted-foreground text-xs">
							{t("workspaces.roles.owner")}
						</span>
					</span>
					<SettledBalanceValue value={settledBalanceFor(PERSONAL_WORKSPACE)} />
					{isPersonal ? <ActiveCheck /> : null}
				</DropdownMenuItem>
				{teamWorkspaces.length > 0 ? <DropdownMenuSeparator /> : null}
				{teamWorkspaces.map(workspaceRow)}
				{sharedPersonalWorkspaces.length > 0 ? <DropdownMenuSeparator /> : null}
				{sharedPersonalWorkspaces.map(workspaceRow)}
				{showsPeople || showsLimits ? <DropdownMenuSeparator /> : null}
				{showsPeople ? (
					<DropdownMenuItem asChild>
						<Link to="/workspace/people">
							<UsersThreeIcon aria-hidden weight="duotone" />
							{t("workspaces.people.title")}
						</Link>
					</DropdownMenuItem>
				) : null}
				{showsLimits ? (
					<DropdownMenuItem asChild>
						<Link to="/workspace/limits">
							<GaugeIcon aria-hidden weight="duotone" />
							{t("workspaces.limits.title")}
						</Link>
					</DropdownMenuItem>
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

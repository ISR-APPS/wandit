import { Link } from "@tanstack/react-router";
import { PERSONAL_WORKSPACE } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { ArrowRightLeft } from "lucide-react";
import { useBillingPlansQuery } from "@/features/billing/api/billing.queries";
import { useBillingModal } from "@/features/billing/components/billing-modal-provider";
import { areTopupsAvailable } from "@/features/billing/lib/billing-ui-policy";
import { usePublicSettingsQuery } from "@/features/settings/api/settings.queries";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { useTranslation } from "@/lib/i18n";
import {
	useCreditBalanceQuery,
	useCreditLedgerQuery,
	useWorkspaceCreditBalancesQuery,
} from "../api/credits.queries";
import { findCreditsElsewhere } from "../lib/credits-elsewhere";
import { formatCreditBalance } from "../lib/format-credits";
import { LedgerList } from "./ledger-list";

export function CreditsChip({ className }: { className?: string }) {
	const { locale, t } = useTranslation();
	const {
		activeWorkspace,
		activeWorkspaceId,
		actorCanManageBilling,
		isPersonal,
		switchWorkspace,
	} = useWorkspace();
	const { openPlanPicker } = useBillingModal();
	const balanceQuery = useCreditBalanceQuery();
	const ledgerQuery = useCreditLedgerQuery({ page: 1, pageSize: 3 });
	const balancesQuery = useWorkspaceCreditBalancesQuery();
	const settingsQuery = usePublicSettingsQuery();
	const plansQuery = useBillingPlansQuery();
	const balance = balanceQuery.data;
	const topupsAvailable = areTopupsAvailable(
		settingsQuery.data?.topupsEnabled,
		plansQuery.data?.topupPacks.length,
	);
	// Credits-elsewhere hint: the drained active pool has a sibling workspace
	// with settled credits — tint the chip and offer a switch in the dropdown.
	const elsewhere = findCreditsElsewhere(
		activeWorkspaceId,
		balancesQuery.data?.items,
	);
	const elsewhereName = elsewhere
		? elsewhere.workspaceId === PERSONAL_WORKSPACE
			? t("workspaces.switcher.personal")
			: (elsewhere.name ?? "")
		: null;
	// Scope label inside the chip ("69.9 credits · Personal"): the balance is
	// per-workspace, and users in a drained org read the bare number as "I have
	// no credits at all" — naming the workspace right where they look fixes it.
	const workspaceLabel = isPersonal
		? t("workspaces.switcher.personal")
		: (activeWorkspace?.name ?? "");

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label={
						workspaceLabel
							? `${t("credits.chipAriaLabel")} · ${workspaceLabel}`
							: t("credits.chipAriaLabel")
					}
					title={workspaceLabel || undefined}
					aria-busy={balanceQuery.isPending}
					className={cn(
						"inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/35 bg-transparent px-3 transition-[border-color,transform] hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98]",
						elsewhere && "border-success/45 hover:border-success/70",
						className,
					)}
				>
					{balanceQuery.isPending ? (
						<Skeleton className="h-3 w-16" />
					) : (
						<>
							{elsewhere ? (
								<span
									aria-hidden
									className="size-1.5 shrink-0 rounded-full bg-success"
								/>
							) : null}
							<span className="text-[13px] text-ember-text">
								{balance
									? t("credits.creditUnit", {
											count: balance.settledBalance,
											countDisplay: formatCreditBalance(
												balance.settledBalance,
												locale,
											),
										})
									: t("credits.balanceUnavailableShort")}
							</span>
							{workspaceLabel ? (
								// Hidden on phones like the header's other secondary texts
								// (the workspace header row cannot wrap or scroll).
								<>
									<span
										aria-hidden
										className="hidden text-[13px] text-border sm:inline"
									>
										·
									</span>
									<span className="hidden max-w-24 truncate text-[13px] text-muted-foreground sm:inline">
										{workspaceLabel}
									</span>
								</>
							) : null}
						</>
					)}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-72 p-0">
				<div className="px-4 pt-4 pb-3">
					<p className="text-muted-foreground text-xs">
						{isPersonal
							? t("credits.balanceLabel")
							: t("workspaces.credits.poolLabel", {
									workspace: activeWorkspace?.name ?? "",
								})}
					</p>
					{balanceQuery.isPending ? (
						<Skeleton className="mt-2 h-8 w-24" />
					) : balance ? (
						<>
							<p className="mt-1 font-medium font-mono text-2xl tabular-nums">
								{formatCreditBalance(balance.settledBalance, locale)}
							</p>
							<dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3">
								<BalanceBucket
									label={t("credits.buckets.plan")}
									value={formatCreditBalance(balance.plan, locale)}
								/>
								<BalanceBucket
									label={t("credits.buckets.promo")}
									value={formatCreditBalance(balance.promo, locale)}
								/>
								<BalanceBucket
									label={t("credits.buckets.topup")}
									value={formatCreditBalance(balance.topup, locale)}
								/>
							</dl>
						</>
					) : (
						<p role="alert" className="mt-2 text-muted-foreground text-xs">
							{t("credits.balanceLoadError")}
						</p>
					)}
				</div>
				{elsewhere ? (
					<>
						<DropdownMenuSeparator />
						<div className="p-2">
							<DropdownMenuItem
								onSelect={() => switchWorkspace(elsewhere.workspaceId)}
								className="gap-2"
							>
								<ArrowRightLeft
									className="size-4 shrink-0 text-success"
									aria-hidden
								/>
								<span className="min-w-0 flex-1 text-sm">
									{t("credits.elsewhere.chipHint", {
										name: elsewhereName ?? "",
									})}
								</span>
								<span className="shrink-0 font-medium text-success text-xs">
									{t("credits.elsewhere.switch")}
								</span>
							</DropdownMenuItem>
						</div>
					</>
				) : null}
				<DropdownMenuSeparator />
				<div className="px-2 py-2">
					<p className="px-2 pb-1 text-[10px] text-muted-foreground uppercase tracking-widest">
						{t("credits.recentActivity")}
					</p>
					<LedgerList
						entries={ledgerQuery.data?.items ?? []}
						isPending={ledgerQuery.isPending}
						isError={ledgerQuery.isError}
						compact
					/>
				</div>
				{settingsQuery.isSuccess ? (
					<>
						<DropdownMenuSeparator />
						<div className="p-2">
							{!actorCanManageBilling ? (
								<p className="px-2 py-1 text-muted-foreground text-xs">
									{t("workspaces.billing.ownerOnlyBody")}
								</p>
							) : topupsAvailable ? (
								<Button
									type="button"
									variant="secondary"
									size="sm"
									className="w-full"
									onClick={() => openPlanPicker("credits_chip")}
								>
									{t("credits.topUpChip")}
								</Button>
							) : (
								<Button
									asChild
									variant="secondary"
									size="sm"
									className="w-full"
								>
									<Link to="/billing">{t("credits.manageBilling")}</Link>
								</Button>
							)}
						</div>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function BalanceBucket({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0">
			<dt className="truncate text-[10px] text-muted-foreground">{label}</dt>
			<dd className="mt-0.5 font-mono text-xs tabular-nums">{value}</dd>
		</div>
	);
}

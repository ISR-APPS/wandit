import { Link } from "@tanstack/react-router";
import { formatNumber } from "@wandit/internationalization";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { useBillingPlansQuery } from "@/features/billing/api/billing.queries";
import { useBillingModal } from "@/features/billing/components/billing-modal-provider";
import { areTopupsAvailable } from "@/features/billing/lib/billing-ui-policy";
import { usePublicSettingsQuery } from "@/features/settings/api/settings.queries";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { useTranslation } from "@/lib/i18n";
import {
	useCreditBalanceQuery,
	useCreditLedgerQuery,
} from "../api/credits.queries";
import { LedgerList } from "./ledger-list";

export function CreditsChip({ className }: { className?: string }) {
	const { locale, t } = useTranslation();
	const { activeWorkspace, actorCanManageBilling, isPersonal } = useWorkspace();
	const { openPlanPicker } = useBillingModal();
	const balanceQuery = useCreditBalanceQuery();
	const ledgerQuery = useCreditLedgerQuery({ page: 1, pageSize: 3 });
	const settingsQuery = usePublicSettingsQuery();
	const plansQuery = useBillingPlansQuery();
	const balance = balanceQuery.data;
	const topupsAvailable = areTopupsAvailable(
		settingsQuery.data?.topupsEnabled,
		plansQuery.data?.topupPacks.length,
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					aria-label={t("credits.chipAriaLabel")}
					aria-busy={balanceQuery.isPending}
					className={cn(
						"inline-flex h-8 items-center rounded-full border border-primary/35 bg-transparent px-3 transition-[border-color,transform] hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98]",
						className,
					)}
				>
					{balanceQuery.isPending ? (
						<Skeleton className="h-3 w-16" />
					) : (
						<span className="text-[13px] text-ember-text">
							{balance
								? t("credits.creditUnit", { count: balance.balance })
								: t("credits.balanceUnavailableShort")}
						</span>
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
								{formatNumber(balance.balance, locale)}
							</p>
							<dl className="mt-3 grid grid-cols-3 gap-2 border-t pt-3">
								<BalanceBucket
									label={t("credits.buckets.plan")}
									value={formatNumber(balance.plan, locale)}
								/>
								<BalanceBucket
									label={t("credits.buckets.promo")}
									value={formatNumber(balance.promo, locale)}
								/>
								<BalanceBucket
									label={t("credits.buckets.topup")}
									value={formatNumber(balance.topup, locale)}
								/>
							</dl>
						</>
					) : (
						<p role="alert" className="mt-2 text-muted-foreground text-xs">
							{t("credits.balanceLoadError")}
						</p>
					)}
				</div>
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
									onClick={() => openPlanPicker()}
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

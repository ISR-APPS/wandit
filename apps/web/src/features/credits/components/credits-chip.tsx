/**
 * The credits pill of the top bars and its dropdown: a navy credits card with
 * the balance and its three buckets, the last three credit events, and a
 * billing action. The dashboard and workspace top bars render it.
 * Reads the credit balance, activity, and workspace balances queries.
 */
import { ArrowsLeftRightIcon } from "@phosphor-icons/react/ArrowsLeftRight";
import { Link } from "@tanstack/react-router";
import { PERSONAL_WORKSPACE } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@wandit/ui/components/dropdown-menu";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { Spark } from "@/components/logo";
import { useBillingPlansQuery } from "@/features/billing/api/billing.queries";
import { useBillingModal } from "@/features/billing/components/billing-modal-provider";
import { areTopupsAvailable } from "@/features/billing/lib/billing-ui-policy";
import { usePublicSettingsQuery } from "@/features/settings/api/settings.queries";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { useTranslation } from "@/lib/i18n";
import {
	useCreditActivityQuery,
	useCreditBalanceQuery,
	useWorkspaceCreditBalancesQuery,
} from "../api/credits.queries";
import { findCreditsElsewhere } from "../lib/credits-elsewhere";
import { formatCreditBalance } from "../lib/format-credits";
import { ActivityList } from "./activity-list";

// The billing action at the foot of the dropdown: a night pill, like the active sidebar link.
const FOOTER_ACTION_CLASS =
	"h-9 w-full rounded-full bg-night font-grotesk font-semibold text-paper hover:bg-night/90 dark:bg-spark dark:text-night dark:hover:bg-spark/90";

/** The credits pill and its dropdown. `className` lets each top bar size and color the pill. */
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
	const activityQuery = useCreditActivityQuery({ page: 1, pageSize: 3 });
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
							{/* The green dot replaces the spark when another workspace has credits. */}
							{elsewhere ? (
								<span
									aria-hidden
									className="size-1.5 shrink-0 rounded-full bg-success"
								/>
							) : (
								<Spark className="size-3.5 text-ember-text" />
							)}
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
										className="mx-0.5 hidden h-3.5 w-px bg-border sm:inline-block"
									/>
									<span className="hidden max-w-24 truncate text-[13px] text-muted-foreground sm:inline">
										{workspaceLabel}
									</span>
								</>
							) : null}
						</>
					)}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80">
				{/* The credits card: the one bold surface of the menu, like a navy wallet card. */}
				<div className="relative rounded-[14px] bg-night p-4 text-paper dark:ring-1 dark:ring-white/10">
					<Spark className="absolute end-4 top-4 size-5 text-spark" />
					{/* pe-8 keeps a long workspace name clear of the spark in the corner. */}
					<p className="pe-8 font-grotesk font-medium text-paper/60 text-xs">
						{isPersonal
							? t("credits.balanceLabel")
							: t("workspaces.credits.poolLabel", {
									workspace: activeWorkspace?.name ?? "",
								})}
					</p>
					{balanceQuery.isPending ? (
						<Skeleton className="mt-2 h-8 w-28 bg-white/10" />
					) : balance ? (
						<>
							<p className="mt-1.5 font-extrabold font-grotesk text-[2rem] tabular-nums leading-none tracking-[-0.03em]">
								{formatCreditBalance(balance.settledBalance, locale)}
							</p>
							<dl className="mt-4 grid grid-cols-3 gap-2 border-white/10 border-t pt-3">
								<BalanceBucket
									label={t("credits.buckets.plan")}
									value={formatCreditBalance(balance.settledPlan, locale)}
								/>
								<BalanceBucket
									label={t("credits.buckets.promo")}
									value={formatCreditBalance(balance.settledPromo, locale)}
								/>
								<BalanceBucket
									label={t("credits.buckets.topup")}
									value={formatCreditBalance(balance.settledTopup, locale)}
								/>
							</dl>
						</>
					) : (
						<p role="alert" className="mt-2 text-paper/70 text-xs">
							{t("credits.balanceLoadError")}
						</p>
					)}
				</div>
				{elsewhere ? (
					<DropdownMenuItem
						onSelect={() => switchWorkspace(elsewhere.workspaceId)}
						className="mt-1.5"
					>
						<ArrowsLeftRightIcon
							aria-hidden
							weight="duotone"
							className="text-success"
						/>
						<span className="min-w-0 flex-1">
							{t("credits.elsewhere.chipHint", {
								name: elsewhereName ?? "",
							})}
						</span>
						<span className="shrink-0 font-semibold text-success text-xs">
							{t("credits.elsewhere.switch")}
						</span>
					</DropdownMenuItem>
				) : null}
				<DropdownMenuLabel className="mt-1.5">
					{t("credits.recentActivity")}
				</DropdownMenuLabel>
				<ActivityList
					items={activityQuery.data?.items ?? []}
					isPending={activityQuery.isPending}
					isError={activityQuery.isError}
					compact
				/>
				{settingsQuery.isSuccess ? (
					<>
						<DropdownMenuSeparator />
						<div className="p-1">
							{!actorCanManageBilling ? (
								<p className="px-1.5 py-1 text-muted-foreground text-xs">
									{t("workspaces.billing.ownerOnlyBody")}
								</p>
							) : topupsAvailable ? (
								<Button
									type="button"
									className={FOOTER_ACTION_CLASS}
									onClick={() => openPlanPicker("credits_chip")}
								>
									{t("credits.topUpChip")}
								</Button>
							) : (
								<Button asChild className={FOOTER_ACTION_CLASS}>
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

/** One bucket of the balance (plan, promo, or top-up) on the navy credits card. */
function BalanceBucket({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0">
			<dt className="truncate font-grotesk font-medium text-[11px] text-paper/60">
				{label}
			</dt>
			<dd className="mt-0.5 font-grotesk font-semibold text-sm tabular-nums">
				{value}
			</dd>
		</div>
	);
}

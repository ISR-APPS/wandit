/**
 * The credits pill of the top bars and its dropdown. The dropdown has a navy card with the one wallet number
 * and the trophy level. It also has the last three credit events and a "Top up" action.
 * The dashboard and workspace top bars render it.
 * Reads the credit balance, activity, workspace balances, and trophies queries.
 */
import { ArrowsLeftRightIcon } from "@phosphor-icons/react/ArrowsLeftRight";
import { TrophyIcon } from "@phosphor-icons/react/Trophy";
import { Link } from "@tanstack/react-router";
import { PERSONAL_WORKSPACE } from "@wandit/contracts";
import { formatNumber } from "@wandit/internationalization";
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
import { useBillingModal, usePurchasesEnabled } from "@/features/billing";
import { useTrophiesQuery } from "@/features/trophies";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { useDictionary, useTranslation } from "@/lib/i18n";
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
		isSharedPersonal,
		switchWorkspace,
	} = useWorkspace();
	const { openTopup } = useBillingModal();
	const purchasesEnabled = usePurchasesEnabled();
	const balanceQuery = useCreditBalanceQuery();
	// Same rule as the API: the activity of another user's personal pool shows that
	// user's own spend, so only an admin of that workspace reads it.
	const canReadActivity =
		!isSharedPersonal || (activeWorkspace?.roles.includes("admin") ?? false);
	const activityQuery = useCreditActivityQuery(
		{ page: 1, pageSize: 3 },
		{ enabled: canReadActivity },
	);
	const balancesQuery = useWorkspaceCreditBalancesQuery();
	const balance = balanceQuery.data;
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
						// One wallet number: the three ledger buckets are an internal detail.
						<p className="mt-1.5 font-extrabold font-grotesk text-[2rem] tabular-nums leading-none tracking-[-0.03em]">
							{formatCreditBalance(balance.settledBalance, locale)}
						</p>
					) : (
						<p role="alert" className="mt-2 text-paper/70 text-xs">
							{t("credits.balanceLoadError")}
						</p>
					)}
					<TrophyLevelPill />
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
				{canReadActivity ? (
					<>
						<DropdownMenuLabel className="mt-1.5">
							{t("credits.recentActivity")}
						</DropdownMenuLabel>
						<ActivityList
							items={activityQuery.data?.items ?? []}
							isPending={activityQuery.isPending}
							isError={activityQuery.isError}
							compact
						/>
					</>
				) : null}
				<DropdownMenuSeparator />
				<div className="p-1">
					{!actorCanManageBilling ? (
						<p className="px-1.5 py-1 text-muted-foreground text-xs">
							{t("workspaces.billing.ownerOnlyBody")}
						</p>
					) : purchasesEnabled === false ? (
						// Every payment method is off: the wallet page still shows the balance and the history.
						<Button asChild className={FOOTER_ACTION_CLASS}>
							<Link to="/billing">{t("credits.manageBilling")}</Link>
						</Button>
					) : (
						<Button
							type="button"
							className={FOOTER_ACTION_CLASS}
							onClick={() => openTopup("credits_chip")}
						>
							{t("credits.topUpChip")}
						</Button>
					)}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/**
 * "Lv 3 · Flame" under the wallet number. It opens /trophies.
 * The level belongs to the user, so it is the same in every workspace. It renders nothing until the query answers.
 */
function TrophyLevelPill() {
	const { locale, t } = useTranslation();
	const levelNames = useDictionary().trophies.levels;
	const trophiesQuery = useTrophiesQuery();
	const level = trophiesQuery.data?.level;
	if (!level) return null;

	return (
		// A menu item, so the arrow keys reach it and a click closes the menu.
		<DropdownMenuItem
			asChild
			className="mt-3 inline-flex h-7 w-auto gap-1.5 rounded-full bg-white/10 px-2.5 py-0 font-semibold text-[12px] text-spark focus:bg-white/20"
		>
			<Link to="/trophies">
				<TrophyIcon aria-hidden weight="fill" className="size-3.5 text-spark" />
				{t("trophies.chip.level", {
					index: formatNumber(level.index, locale),
					name: levelNames[level.id],
				})}
			</Link>
		</DropdownMenuItem>
	);
}

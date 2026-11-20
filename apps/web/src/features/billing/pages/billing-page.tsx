/**
 * The wallet page at /billing: the balance and its runway, the top-up meter, the trophies, and the history.
 * The /billing route renders it inside the dashboard frame (sidebar and top bar).
 * Calls the billing and credits queries. WalletTopupCard opens the top-up dialog through useBillingModal.
 */
import type { Icon } from "@phosphor-icons/react";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/ArrowSquareOut";
import { CaretLeftIcon } from "@phosphor-icons/react/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";
import { CoinsIcon } from "@phosphor-icons/react/Coins";
import { HandCoinsIcon } from "@phosphor-icons/react/HandCoins";
import { LockSimpleIcon } from "@phosphor-icons/react/LockSimple";
import { ReceiptIcon } from "@phosphor-icons/react/Receipt";
import { WarningIcon } from "@phosphor-icons/react/Warning";
import type {
	BillingWalletResponse,
	ManualSubscriptionRequest,
} from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@wandit/ui/components/tabs";
import { cn } from "@wandit/ui/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import {
	useCancelManualSubscriptionRequest,
	useCreateBillingPortal,
} from "@/features/billing/api/billing.mutations";
import {
	useBillingWalletQuery,
	useManualSubscriptionRequestQuery,
} from "@/features/billing/api/billing.queries";
import { ManualRequestCancelDialog } from "@/features/billing/components/manual-payment-request-panel";
import { PaymentHistoryCard } from "@/features/billing/components/payment-history-card";
import { WalletTopupCard } from "@/features/billing/components/wallet-topup-card";
import { usePurchaseSummary } from "@/features/billing/lib/purchase-summary";
import { walletRunwayDays } from "@/features/billing/lib/wallet-runway";
import {
	ActivityList,
	formatCreditBalance,
	useCreditActivityQuery,
	useCreditBalanceQuery,
} from "@/features/credits";
import { DashboardShell } from "@/features/projects/components/shell/dashboard-shell";
import { TrophySummaryCard } from "@/features/trophies";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import {
	formatNumber,
	type Locale,
	useDictionary,
	useTranslation,
} from "@/lib/i18n";

const LEDGER_PAGE_SIZE = 10;

// The white card of the dashboard pages, the same as the affiliate metric and table cards.
const CARD_CLASS =
	"rounded-[1.5rem] bg-white shadow-[0_2px_0_rgb(11_16_51/0.06)] ring-1 ring-night/[0.08] dark:bg-card dark:shadow-[0_2px_0_rgb(0_0_0/0.35)] dark:ring-white/10";

// Small grotesk capitals over a value. Arabic letters join, so `rtl:` removes the letter spacing.
const LABEL_CLASS =
	"font-grotesk font-semibold text-[11px] uppercase tracking-[0.08em] rtl:tracking-normal";

// Runway steps of the balance card: days below 2 weeks, weeks up to about 6 months, then one fixed text.
const RUNWAY_WEEKS_FROM_DAYS = 14;
const RUNWAY_LONGER_THAN_DAYS = 180;

/** The /billing route renders this page: the wallet of the active workspace. */
export default function BillingPage() {
	return (
		<DashboardShell titleKey="billing.page.title">
			<div className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-6">
				<BillingContent />
			</div>
		</DashboardShell>
	);
}

function BillingContent() {
	const { t } = useTranslation();
	const { activeWorkspace, actorCanManageBilling, isPersonal } = useWorkspace();
	const copy = useDictionary().billing;
	const [ledgerPage, setLedgerPage] = useState(1);
	const walletQuery = useBillingWalletQuery();
	// Only a billing manager sees the ledger below. The API refuses the activity of
	// another user's personal pool to a member who is not an admin.
	const activityQuery = useCreditActivityQuery(
		{ page: ledgerPage, pageSize: LEDGER_PAGE_SIZE },
		{ enabled: actorCanManageBilling },
	);
	const manualRequestQuery = useManualSubscriptionRequestQuery();
	const cancelManualRequest = useCancelManualSubscriptionRequest();

	const header = (
		<div className="mt-8">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<h2 className="font-bold font-grotesk text-[1.75rem] text-night tracking-[-0.035em] dark:text-foreground">
					{copy.page.title}
				</h2>
				{/* The wallet belongs to the active workspace, so the page names it. */}
				<span className="max-w-full truncate rounded-full bg-night/[0.06] px-2.5 py-1 font-grotesk font-semibold text-night/70 text-xs dark:bg-white/10 dark:text-foreground/70">
					{isPersonal
						? copy.page.workspacePersonal
						: (activeWorkspace?.name ?? "")}
				</span>
			</div>
			<p className="mt-1 text-night/60 text-sm dark:text-foreground/60">
				{copy.page.description}
			</p>
		</div>
	);

	// Money controls are owner-only in org workspaces (Zack's decision). Trophies belong to the
	// user, so every member still sees them.
	if (!actorCanManageBilling) {
		return (
			<>
				<div className="mt-8 flex flex-col items-center justify-center rounded-[2rem] border-2 border-night/15 border-dashed px-6 py-16 text-center dark:border-white/15">
					<span
						aria-hidden
						className="grid size-16 -rotate-6 place-items-center rounded-[28%] bg-night shadow-[0_12px_22px_-12px_rgb(11_16_51/0.55)] dark:ring-1 dark:ring-white/10"
					>
						<LockSimpleIcon weight="duotone" className="size-7 text-spark" />
					</span>
					<h2 className="mt-6 font-bold font-grotesk text-2xl text-night tracking-[-0.03em] dark:text-foreground">
						{t("workspaces.billing.ownerOnlyTitle")}
					</h2>
					<p className="mt-2 max-w-sm text-night/60 text-sm dark:text-foreground/60">
						{t("workspaces.billing.ownerOnlyBody")}
					</p>
				</div>
				<TrophySummaryCard className={cn(CARD_CLASS, "mt-4")} />
			</>
		);
	}

	return (
		<>
			{header}

			{walletQuery.isPending ? (
				<BillingPageSkeleton />
			) : walletQuery.isError ? (
				<div
					role="alert"
					className="mt-8 flex flex-col items-center justify-center rounded-[2rem] bg-destructive/[0.035] px-6 py-12 text-center ring-2 ring-destructive/25"
				>
					<span
						aria-hidden
						className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive"
					>
						<WarningIcon weight="duotone" className="size-5" />
					</span>
					<h3 className="mt-4 font-bold font-grotesk text-lg text-night tracking-[-0.02em] dark:text-foreground">
						{copy.page.loadErrorTitle}
					</h3>
					<p className="mt-1 max-w-sm text-night/60 text-sm dark:text-foreground/60">
						{copy.page.loadErrorBody}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="mt-4 font-grotesk"
						onClick={() => void walletQuery.refetch()}
					>
						<ArrowClockwiseIcon aria-hidden weight="bold" className="size-4" />
						{copy.page.retry}
					</Button>
				</div>
			) : (
				<>
					<div className="mt-6 flex flex-col gap-4">
						{manualRequestQuery.data?.request ? (
							<ManualRequestNotice
								request={manualRequestQuery.data.request}
								isCancelPending={cancelManualRequest.isPending}
								onCancel={() => {
									void cancelManualRequest
										.mutateAsync()
										.then(() =>
											toast.success(copy.offlineRequest.cancelSuccess),
										)
										.catch((error) => {
											if (
												isApiClientError(error) &&
												error.code === "NOT_FOUND"
											) {
												void manualRequestQuery.refetch();
												return;
											}
											toast.error(getApiErrorMessage(error));
										});
								}}
							/>
						) : null}

						<div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
							<BalanceCard wallet={walletQuery.data} />
							<WalletTopupCard
								wallet={walletQuery.data}
								className={CARD_CLASS}
							/>
						</div>
					</div>

					<TrophySummaryCard className={cn(CARD_CLASS, "mt-4")} />

					<Tabs
						defaultValue="activity"
						className={cn(CARD_CLASS, "mt-4 gap-0 overflow-hidden")}
					>
						<div className="border-night/[0.06] border-b px-4 pt-4 pb-3 sm:px-6 dark:border-white/[0.06]">
							<TabsList aria-label={copy.page.tabs.label}>
								<TabsTrigger value="activity" className="font-grotesk">
									{copy.page.tabs.activity}
								</TabsTrigger>
								<TabsTrigger value="payments" className="font-grotesk">
									{copy.page.tabs.payments}
								</TabsTrigger>
							</TabsList>
						</div>
						<TabsContent value="activity">
							<div className="border-night/[0.06] border-b px-4 py-4 sm:px-6 dark:border-white/[0.06]">
								<CardHeading
									icon={ReceiptIcon}
									title={copy.page.ledgerTitle}
									description={copy.page.ledgerDescription}
								/>
							</div>
							<div className="px-2 py-1 sm:px-4">
								<ActivityList
									items={activityQuery.data?.items ?? []}
									isPending={activityQuery.isPending}
									isError={activityQuery.isError}
								/>
							</div>
							<LedgerPagination
								page={ledgerPage}
								total={activityQuery.data?.total ?? 0}
								onPageChange={setLedgerPage}
							/>
						</TabsContent>
						<TabsContent value="payments">
							<PaymentHistoryCard />
						</TabsContent>
					</Tabs>
				</>
			)}
		</>
	);
}

type CardHeadingProps = {
	/** A Phosphor icon, drawn in duotone on a small rounded tile. */
	icon: Icon;
	title: string;
	description: string;
};

/** The icon tile, the title, and one line of description at the top of a card. */
function CardHeading({
	icon: HeadingIcon,
	title,
	description,
}: CardHeadingProps) {
	return (
		<div className="flex items-start gap-3">
			<span
				aria-hidden
				className="grid size-10 shrink-0 place-items-center rounded-xl bg-night/[0.05] text-night/70 dark:bg-white/10 dark:text-foreground/70"
			>
				<HeadingIcon weight="duotone" className="size-5" />
			</span>
			<div className="min-w-0">
				<h3 className="font-grotesk font-semibold text-[15px] text-night tracking-[-0.01em] dark:text-foreground">
					{title}
				</h3>
				<p className="mt-0.5 text-night/60 text-sm dark:text-foreground/60">
					{description}
				</p>
			</div>
		</div>
	);
}

/** The night card of the wallet: one balance number, its runway, and the past invoices link. */
function BalanceCard({ wallet }: { wallet: BillingWalletResponse }) {
	const { locale, t } = useTranslation();
	const copy = useDictionary().billing.page;
	const { activeWorkspace, isPersonal } = useWorkspace();
	const portal = useCreateBillingPortal();
	// Turn settles and 402 refusals invalidate only the credits balance key, not the wallet key.
	// The wallet copy shows only while that query loads or fails. So the card and the chip show one number.
	const balanceQuery = useCreditBalanceQuery();
	// Decimal credits. The wallet is the sum of the three ledger buckets; the page shows only the sum.
	const balance = (balanceQuery.data ?? wallet.balance).settledBalance;
	const runwayDays = walletRunwayDays(balance, wallet.spentLast30DaysCredits);

	return (
		<section className="flex flex-col rounded-[1.5rem] bg-night p-5 text-paper sm:p-6 dark:bg-card dark:text-foreground dark:ring-1 dark:ring-white/10">
			<div className="flex items-start gap-3">
				<span
					aria-hidden
					className="grid size-10 shrink-0 place-items-center rounded-xl bg-spark text-night"
				>
					<CoinsIcon weight="fill" className="size-5" />
				</span>
				<div className="min-w-0">
					<h3 className="font-grotesk font-semibold text-[15px] tracking-[-0.01em]">
						{copy.balanceTitle}
					</h3>
					<p className="mt-0.5 truncate text-paper/70 text-sm dark:text-foreground/70">
						{isPersonal
							? copy.personalWallet
							: t("billing.page.teamWallet", {
									name: activeWorkspace?.name ?? "",
								})}
					</p>
				</div>
			</div>
			<p
				className={cn(
					LABEL_CLASS,
					"mt-8 text-paper/60 dark:text-foreground/60",
				)}
			>
				{copy.totalBalance}
			</p>
			<p className="mt-1 font-bold font-grotesk text-[3rem] tabular-nums leading-none tracking-[-0.04em]">
				<span dir="ltr">{formatCreditBalance(balance, locale)}</span>
			</p>
			<p className="mt-3 text-paper/70 text-sm dark:text-foreground/70">
				{runwayText(runwayDays, locale, t, copy)}
			</p>
			{/* A refund or a dispute of spent credits makes the balance negative. The text explains it. */}
			{balance < 0 ? (
				<p
					role="status"
					className="mt-3 flex items-start gap-2 text-amber-200 text-sm dark:text-amber-300"
				>
					<WarningIcon
						aria-hidden
						weight="duotone"
						className="mt-0.5 size-4 shrink-0"
					/>
					{copy.negativeBalance}
				</p>
			) : null}
			{/* The Stripe portal lists the invoices of old subscriptions. A wallet with no Stripe customer has none. */}
			{wallet.hasStripeCustomer ? (
				<div className="mt-auto flex flex-wrap items-center gap-2 pt-8">
					<Button
						type="button"
						variant="outline"
						className="h-10 border-white/20 bg-transparent font-grotesk text-paper hover:bg-white/10 hover:text-paper dark:text-foreground"
						disabled={portal.isPending}
						onClick={() => {
							void portal
								.mutateAsync()
								.catch((error) => toast.error(getApiErrorMessage(error)));
						}}
					>
						<ArrowSquareOutIcon aria-hidden weight="bold" className="size-4" />
						{copy.pastInvoices}
					</Button>
				</div>
			) : null}
		</section>
	);
}

/**
 * Runway line of the balance card, from walletRunwayDays.
 * Null (no spend, or no balance) gives "Your credits never expire".
 * 0 (the balance covers less than one day) gives "Less than a day at your pace".
 */
function runwayText(
	runwayDays: number | null,
	locale: Locale,
	t: ReturnType<typeof useTranslation>["t"],
	copy: {
		neverExpire: string;
		runway: { longer: string; lessThanDay: string };
	},
): string {
	if (runwayDays === null) {
		return copy.neverExpire;
	}
	if (runwayDays === 0) {
		return copy.runway.lessThanDay;
	}
	if (runwayDays > RUNWAY_LONGER_THAN_DAYS) {
		return copy.runway.longer;
	}
	if (runwayDays < RUNWAY_WEEKS_FROM_DAYS) {
		return t("billing.page.runway.days", {
			count: runwayDays,
			countDisplay: formatNumber(runwayDays, locale),
		});
	}
	// 7 days in a week. "About 3 weeks" reads better than "About 21 days".
	const weeks = Math.round(runwayDays / 7);
	return t("billing.page.runway.weeks", {
		count: weeks,
		countDisplay: formatNumber(weeks, locale),
	});
}

/** An open offline top-up request: its USD amount and a cancel button. A request from before pricing v8 names its plan. */
function ManualRequestNotice({
	request,
	isCancelPending,
	onCancel,
}: {
	request: ManualSubscriptionRequest;
	isCancelPending: boolean;
	onCancel: () => void;
}) {
	const { t } = useTranslation();
	const copy = useDictionary().billing.offlineRequest;
	const purchaseSummary = usePurchaseSummary();

	return (
		<section
			className={cn(
				CARD_CLASS,
				"flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6",
			)}
		>
			<div className="flex min-w-0 flex-1 items-start gap-3">
				<span
					aria-hidden
					className="grid size-10 shrink-0 place-items-center rounded-xl bg-spark/25 text-night dark:bg-spark/20 dark:text-spark"
				>
					<HandCoinsIcon weight="duotone" className="size-5" />
				</span>
				<div className="min-w-0">
					<h3 className="font-grotesk font-semibold text-[15px] text-night tracking-[-0.01em] dark:text-foreground">
						{copy.title}
					</h3>
					<p className="mt-0.5 text-night/60 text-sm dark:text-foreground/60">
						{t("billing.offlineRequest.body", { phone: request.phone })}
					</p>
					<p className="mt-2 font-grotesk font-semibold text-night text-sm dark:text-foreground">
						{purchaseSummary(request)}
					</p>
				</div>
			</div>
			<ManualRequestCancelDialog
				copy={copy}
				isPending={isCancelPending}
				onConfirm={onCancel}
			/>
		</section>
	);
}

function LedgerPagination({
	page,
	total,
	onPageChange,
}: {
	page: number;
	total: number;
	onPageChange: (page: number) => void;
}) {
	const { t } = useTranslation();
	const copy = useDictionary().billing.page;
	const totalPages = Math.max(1, Math.ceil(total / LEDGER_PAGE_SIZE));

	if (total <= LEDGER_PAGE_SIZE) return null;

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 border-night/[0.06] border-t px-4 py-3 sm:px-6 dark:border-white/[0.06]">
			<p className="text-night/60 text-xs tabular-nums dark:text-foreground/60">
				{t("billing.page.pageStatus", { page, totalPages })}
			</p>
			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="font-grotesk"
					disabled={page <= 1}
					onClick={() => onPageChange(Math.max(1, page - 1))}
				>
					<CaretLeftIcon
						aria-hidden
						weight="bold"
						className="size-3.5 rtl:-scale-x-100"
					/>
					{copy.previousPage}
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="font-grotesk"
					disabled={page >= totalPages}
					onClick={() => onPageChange(Math.min(totalPages, page + 1))}
				>
					{copy.nextPage}
					<CaretRightIcon
						aria-hidden
						weight="bold"
						className="size-3.5 rtl:-scale-x-100"
					/>
				</Button>
			</div>
		</div>
	);
}

/** The balance and top-up row, the trophies card, and the history card, in their real shapes. */
function BillingPageSkeleton() {
	return (
		<div
			className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
			aria-hidden
		>
			<Skeleton className="h-80 rounded-[1.5rem]" />
			<Skeleton className="h-80 rounded-[1.5rem]" />
			<Skeleton className="h-56 rounded-[1.5rem] lg:col-span-2" />
			<Skeleton className="h-80 rounded-[1.5rem] lg:col-span-2" />
		</div>
	);
}

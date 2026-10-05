/**
 * Shows workspace billing, subscription controls, and credit activity.
 * The /billing route renders this page inside the dashboard frame (sidebar and top bar).
 * It calls the billing and credits queries and mutations, and opens the plan picker.
 */
import type { Icon } from "@phosphor-icons/react";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/ArrowSquareOut";
import { CaretLeftIcon } from "@phosphor-icons/react/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/CaretRight";
import { CoinsIcon } from "@phosphor-icons/react/Coins";
import { CreditCardIcon } from "@phosphor-icons/react/CreditCard";
import { HandCoinsIcon } from "@phosphor-icons/react/HandCoins";
import { InfoIcon } from "@phosphor-icons/react/Info";
import { LockSimpleIcon } from "@phosphor-icons/react/LockSimple";
import { ReceiptIcon } from "@phosphor-icons/react/Receipt";
import { WalletIcon } from "@phosphor-icons/react/Wallet";
import { WarningIcon } from "@phosphor-icons/react/Warning";
import type {
	BillingCancelRequest,
	BillingTopupPack,
	ManualSubscriptionRequest,
	Subscription,
} from "@wandit/contracts";
import { isManualSubscription } from "@wandit/contracts";
import {
	formatDate,
	formatNumber,
	type Locale,
} from "@wandit/internationalization";
import { Button } from "@wandit/ui/components/button";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import {
	useCancelBillingSubscription,
	useCancelManualSubscriptionRequest,
	useCreateBillingPortal,
	useCreateBillingTopupCheckout,
	useResumeBillingSubscription,
} from "@/features/billing/api/billing.mutations";
import {
	useBillingPlansQuery,
	useBillingSubscriptionQuery,
	useManualSubscriptionRequestQuery,
} from "@/features/billing/api/billing.queries";
import { useBillingModal } from "@/features/billing/components/billing-modal-provider";
import { CancelSubscriptionDialog } from "@/features/billing/components/cancel-subscription-dialog";
import { ManualRequestCancelDialog } from "@/features/billing/components/manual-payment-request-panel";
import {
	areTopupsAvailable,
	getManualGraceNoticeDates,
	getPendingSubscriptionChange,
	getStarterCancelOffer,
	type StarterCancelOffer,
} from "@/features/billing/lib/billing-ui-policy";
import { getBillingPlanName } from "@/features/billing/lib/plan-copy";
import {
	useCreditActivityQuery,
	useCreditBalanceQuery,
} from "@/features/credits/api/credits.queries";
import { ActivityList } from "@/features/credits/components/activity-list";
import { formatCreditBalance } from "@/features/credits/lib/format-credits";
import { KeycapButton } from "@/features/landing";
import { DashboardShell } from "@/features/projects/components/shell/dashboard-shell";
import { usePublicSettingsQuery } from "@/features/settings/api/settings.queries";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { useDictionary, useTranslation } from "@/lib/i18n";

const LEDGER_PAGE_SIZE = 10;

// The white card of the dashboard pages, the same as the affiliate metric and table cards.
const CARD_CLASS =
	"rounded-[1.5rem] bg-white shadow-[0_2px_0_rgb(11_16_51/0.06)] ring-1 ring-night/[0.08] dark:bg-card dark:shadow-[0_2px_0_rgb(0_0_0/0.35)] dark:ring-white/10";

// Small grotesk capitals over a value. Arabic letters join, so `rtl:` removes the letter spacing.
const LABEL_CLASS =
	"font-grotesk font-semibold text-[11px] uppercase tracking-[0.08em] rtl:tracking-normal";

// The keycap has a white focus outline for ember and night ground. On a white card it needs ember.
const KEYCAP_ON_CARD_CLASS = "focus-visible:outline-ember";

/** The /billing route renders this page: subscription, credits, ledger, and the plan picker. */
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
	const { locale, t } = useTranslation();
	const { actorCanManageBilling, isPersonal } = useWorkspace();
	const copy = useDictionary().billing;
	const { openPlanPicker } = useBillingModal();
	const [ledgerPage, setLedgerPage] = useState(1);
	const balanceQuery = useCreditBalanceQuery();
	const activityQuery = useCreditActivityQuery({
		page: ledgerPage,
		pageSize: LEDGER_PAGE_SIZE,
	});
	const subscriptionQuery = useBillingSubscriptionQuery();
	const manualRequestQuery = useManualSubscriptionRequestQuery();
	const settingsQuery = usePublicSettingsQuery();
	const plansQuery = useBillingPlansQuery();
	const cancelSubscription = useCancelBillingSubscription();
	const cancelManualRequest = useCancelManualSubscriptionRequest();
	const resumeSubscription = useResumeBillingSubscription();
	const portal = useCreateBillingPortal();
	const topup = useCreateBillingTopupCheckout();
	const corePending =
		balanceQuery.isPending ||
		subscriptionQuery.isPending ||
		settingsQuery.isPending;
	const coreError =
		balanceQuery.isError || subscriptionQuery.isError || settingsQuery.isError;
	const topupsAvailable = areTopupsAvailable(
		settingsQuery.data?.topupsEnabled,
		plansQuery.data?.topupPacks.length,
	);
	const subscriptionPlansAvailable = Boolean(
		settingsQuery.data?.paidSubscriptionsEnabled ||
			settingsQuery.data?.manualPaymentsEnabled,
	);
	const subscriptionPlansPaused =
		settingsQuery.data !== undefined && !subscriptionPlansAvailable;
	const manualGraceNoticeDates = getManualGraceNoticeDates(
		subscriptionQuery.data?.subscription,
		settingsQuery.data?.manualGraceDays ?? 0,
	);

	const subscription = subscriptionQuery.data?.subscription;
	const starterPlan = plansQuery.data?.plans.find(
		(plan) => plan.id === "starter",
	);
	const starterOffer = getStarterCancelOffer({
		subscription,
		starterPlan,
		isPersonal,
		paidSubscriptionsEnabled:
			settingsQuery.data?.paidSubscriptionsEnabled === true,
	});

	const retryCore = () => {
		void Promise.all([
			balanceQuery.refetch(),
			subscriptionQuery.refetch(),
			settingsQuery.refetch(),
		]);
	};

	// Billing is owner-only in org workspaces (Zack's decision): admins and
	// members get a notice, never money controls.
	if (!actorCanManageBilling) {
		return (
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
		);
	}

	return (
		<>
			<div className="mt-8">
				<div className="flex flex-wrap items-center gap-2.5">
					<h2 className="font-bold font-grotesk text-[1.75rem] text-night tracking-[-0.035em] dark:text-foreground">
						{copy.page.title}
					</h2>
					{subscriptionPlansPaused ? (
						<StatusPill tone="neutral" label={copy.page.betaBadge} />
					) : null}
				</div>
				<p className="mt-1 text-night/60 text-sm dark:text-foreground/60">
					{copy.page.description}
				</p>
			</div>

			{subscriptionPlansPaused ? (
				<div
					role="status"
					className="mt-5 flex items-start gap-3 rounded-[1.5rem] bg-spark/[0.12] px-4 py-3.5 text-night text-sm ring-1 ring-spark/30 dark:text-foreground"
				>
					{/* Night does not show on the dark page, so the icon turns spark there. */}
					<InfoIcon
						aria-hidden
						weight="duotone"
						className="size-5 shrink-0 text-night dark:text-spark"
					/>
					<p>{copy.page.betaBody}</p>
				</div>
			) : null}

			{corePending ? (
				<BillingPageSkeleton />
			) : coreError ? (
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
						onClick={retryCore}
					>
						<ArrowClockwiseIcon aria-hidden weight="bold" className="size-4" />
						{copy.page.retry}
					</Button>
				</div>
			) : balanceQuery.data && subscriptionQuery.data && settingsQuery.data ? (
				<>
					<div className="mt-6 flex flex-col gap-4">
						{manualGraceNoticeDates ? (
							<ManualGraceNotice
								accessEndDate={manualGraceNoticeDates.accessEndDate}
								locale={locale}
								periodEndDate={manualGraceNoticeDates.periodEndDate}
							/>
						) : null}
						{manualRequestQuery.data?.request ? (
							<ManualRequestNotice
								request={manualRequestQuery.data.request}
								isCancelPending={cancelManualRequest.isPending}
								onCancel={() => {
									void cancelManualRequest
										.mutateAsync()
										.then(() =>
											toast.success(copy.page.offline.pending.cancelSuccess),
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
							<BalanceCard balance={balanceQuery.data} locale={locale} />
							<SubscriptionCard
								subscription={subscriptionQuery.data.subscription}
								paidSubscriptionsEnabled={
									settingsQuery.data.paidSubscriptionsEnabled
								}
								manualPaymentsEnabled={settingsQuery.data.manualPaymentsEnabled}
								locale={locale}
								starterOffer={starterOffer}
								onAcceptStarterOffer={() => {
									// The picker opens on Starter and runs the existing renewal change flow.
									if (starterOffer) {
										openPlanPicker("billing_page", starterOffer);
									}
								}}
								onOpenPlanPicker={() => openPlanPicker("billing_page")}
								onOpenOfflinePlanPicker={() => {
									const subscription = subscriptionQuery.data.subscription;
									if (!subscription) return;

									openPlanPicker("billing_page", {
										interval: subscription.interval,
										paymentMethod: "offline",
										plan: subscription.plan,
										tierCredits: subscription.tierCredits,
									});
								}}
								onOpenPortal={() => {
									void portal
										.mutateAsync()
										.catch((error) => toast.error(getApiErrorMessage(error)));
								}}
								portalPending={portal.isPending}
								cancelPending={cancelSubscription.isPending}
								resumePending={resumeSubscription.isPending}
								onCancel={(request) => {
									void cancelSubscription
										.mutateAsync(request)
										.then(() => toast.success(copy.page.cancelSuccess))
										.catch((error) => toast.error(getApiErrorMessage(error)));
								}}
								onResume={() => {
									void resumeSubscription
										.mutateAsync()
										.then(() => toast.success(copy.page.resumeSuccess))
										.catch((error) => toast.error(getApiErrorMessage(error)));
								}}
							/>
						</div>
					</div>

					{topupsAvailable ? (
						<TopupSection
							isPending={topup.isPending}
							packs={plansQuery.data?.topupPacks ?? []}
							locale={locale}
							onBuy={(packId) => {
								void topup
									.mutateAsync({ packId })
									.catch((error) => toast.error(getApiErrorMessage(error)));
							}}
						/>
					) : null}

					<section className={cn(CARD_CLASS, "mt-4 overflow-hidden")}>
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
					</section>
				</>
			) : null}
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

type StatusTone = "success" | "warning" | "danger" | "neutral";

// The same tones as the affiliate status pills. Green: active. Amber: ends soon.
// Red: not entitled. Neutral: plain facts, for example "Paid offline".
const TONE_CLASS = {
	success:
		"bg-green-500/[0.12] text-green-800 dark:bg-green-400/15 dark:text-green-300",
	warning:
		"bg-amber-500/15 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300",
	danger: "bg-red-500/[0.12] text-red-700 dark:bg-red-400/15 dark:text-red-300",
	neutral:
		"bg-night/[0.06] text-night/70 dark:bg-white/[0.08] dark:text-foreground/70",
} as const satisfies Record<StatusTone, string>;

function StatusPill({ tone, label }: { tone: StatusTone; label: string }) {
	return (
		<span
			className={cn(
				"inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 font-grotesk font-semibold text-[11px]",
				TONE_CLASS[tone],
			)}
		>
			{label}
		</span>
	);
}

/** The night card of the balance: the total in large type, then the three buckets. */
function BalanceCard({
	balance,
	locale,
}: {
	/** Settled credits from the credits API, in credits with decimals. */
	balance: {
		settledBalance: number;
		settledPlan: number;
		settledPromo: number;
		settledTopup: number;
	};
	locale: Locale;
}) {
	const copy = useDictionary();

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
						{copy.billing.page.balanceTitle}
					</h3>
					<p className="mt-0.5 text-paper/70 text-sm dark:text-foreground/70">
						{copy.billing.page.balanceDescription}
					</p>
				</div>
			</div>
			<p
				className={cn(
					LABEL_CLASS,
					"mt-8 text-paper/60 dark:text-foreground/60",
				)}
			>
				{copy.billing.page.totalBalance}
			</p>
			<p className="mt-1 font-bold font-grotesk text-[3rem] tabular-nums leading-none tracking-[-0.04em]">
				<span dir="ltr">
					{formatCreditBalance(balance.settledBalance, locale)}
				</span>
			</p>
			<dl className="mt-auto grid grid-cols-3 gap-2 pt-8">
				<BucketMetric
					label={copy.credits.buckets.plan}
					value={formatCreditBalance(balance.settledPlan, locale)}
				/>
				<BucketMetric
					label={copy.credits.buckets.promo}
					value={formatCreditBalance(balance.settledPromo, locale)}
				/>
				<BucketMetric
					label={copy.credits.buckets.topup}
					value={formatCreditBalance(balance.settledTopup, locale)}
				/>
			</dl>
		</section>
	);
}

function BucketMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-2xl bg-white/[0.07] px-2.5 py-2.5 sm:px-3">
			{/* On a phone the three tiles are about 100 px wide, so the label gets 10 px to fit "PROMOTIONAL". */}
			<dt
				className={cn(
					LABEL_CLASS,
					"truncate text-[10px] text-paper/60 sm:text-[11px] dark:text-foreground/60",
				)}
			>
				{label}
			</dt>
			<dd className="mt-1 font-grotesk font-semibold text-lg tabular-nums">
				<span dir="ltr">{value}</span>
			</dd>
		</div>
	);
}

function SubscriptionCard({
	subscription,
	starterOffer,
	onAcceptStarterOffer,
	paidSubscriptionsEnabled,
	manualPaymentsEnabled,
	locale,
	onOpenPlanPicker,
	onOpenOfflinePlanPicker,
	onOpenPortal,
	portalPending,
	cancelPending,
	resumePending,
	onCancel,
	onResume,
}: {
	subscription: Subscription | null;
	starterOffer: StarterCancelOffer | null;
	onAcceptStarterOffer: () => void;
	paidSubscriptionsEnabled: boolean;
	manualPaymentsEnabled: boolean;
	locale: Locale;
	onOpenPlanPicker: () => void;
	onOpenOfflinePlanPicker: () => void;
	onOpenPortal: () => void;
	portalPending: boolean;
	cancelPending: boolean;
	resumePending: boolean;
	onCancel: (request: BillingCancelRequest) => void;
	onResume: () => void;
}) {
	const { t } = useTranslation();
	const copy = useDictionary().billing;
	const manualSubscription = isManualSubscription(subscription);
	const pendingChange = getPendingSubscriptionChange(subscription);
	const subscriptionPlansAvailable =
		paidSubscriptionsEnabled || manualPaymentsEnabled;

	return (
		<section className={cn(CARD_CLASS, "flex flex-col p-5 sm:p-6")}>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<CardHeading
					icon={CreditCardIcon}
					title={copy.page.subscriptionTitle}
					description={copy.page.subscriptionDescription}
				/>
				{subscription ? (
					<div className="flex flex-wrap gap-1.5">
						{manualSubscription ? (
							<StatusPill tone="neutral" label={copy.page.offline.badge} />
						) : null}
						<StatusPill
							tone={
								subscription.cancelAtPeriodEnd
									? "warning"
									: subscription.entitled
										? "success"
										: "danger"
							}
							label={
								subscription.cancelAtPeriodEnd
									? copy.status.canceling
									: statusLabel(subscription.status, copy.status)
							}
						/>
					</div>
				) : null}
			</div>
			{subscription ? (
				<>
					<p className="mt-7 font-bold font-grotesk text-[1.75rem] text-night leading-tight tracking-[-0.035em] dark:text-foreground">
						{getBillingPlanName(subscription.plan, copy.planPicker)}
					</p>
					<p className="mt-1 text-night/60 text-sm dark:text-foreground/60">
						{t("billing.page.creditsPerCycle", {
							count: formatNumber(subscription.tierCredits, locale),
						})}
						{" · "}
						{subscription.interval === "year"
							? copy.planPicker.yearly
							: copy.planPicker.monthly}
					</p>
					<dl className="mt-5 grid gap-2 sm:grid-cols-2">
						<PlanDetail
							label={copy.page.statusLabel}
							value={statusLabel(subscription.status, copy.status)}
						/>
						<PlanDetail
							label={
								manualSubscription
									? copy.page.offline.expiresLabel
									: subscription.cancelAtPeriodEnd
										? copy.page.endsLabel
										: copy.page.renewsLabel
							}
							value={formatDate(subscription.currentPeriodEnd, locale, {
								dateStyle: "medium",
							})}
						/>
						{pendingChange ? (
							<PlanDetail
								label={copy.page.pendingTierLabel}
								value={`${getBillingPlanName(pendingChange.plan, copy.planPicker)} · ${t(
									"credits.creditUnit",
									{
										count: pendingChange.tierCredits,
									},
								)} · ${pendingChange.interval === "year" ? copy.planPicker.yearly : copy.planPicker.monthly}`}
							/>
						) : null}
					</dl>
					{/* mt-auto keeps the actions at the card bottom when the balance card is taller. */}
					<div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
						{manualSubscription && subscription.cancelAtPeriodEnd ? (
							<KeycapButton
								type="button"
								size="md"
								className={KEYCAP_ON_CARD_CLASS}
								disabled={resumePending}
								onClick={onResume}
							>
								{resumePending ? copy.page.resuming : copy.page.resumePlan}
							</KeycapButton>
						) : null}
						{manualSubscription ? (
							<KeycapButton
								type="button"
								size="md"
								className={KEYCAP_ON_CARD_CLASS}
								onClick={onOpenOfflinePlanPicker}
							>
								<HandCoinsIcon aria-hidden weight="bold" className="size-4" />
								{copy.page.offline.requestChange}
							</KeycapButton>
						) : subscription.cancelAtPeriodEnd && paidSubscriptionsEnabled ? (
							<KeycapButton
								type="button"
								size="md"
								className={KEYCAP_ON_CARD_CLASS}
								disabled={resumePending}
								onClick={onResume}
							>
								{resumePending ? copy.page.resuming : copy.page.resumePlan}
							</KeycapButton>
						) : !subscription.cancelAtPeriodEnd && paidSubscriptionsEnabled ? (
							<KeycapButton
								type="button"
								size="md"
								className={KEYCAP_ON_CARD_CLASS}
								onClick={onOpenPlanPicker}
							>
								{copy.page.changePlan}
							</KeycapButton>
						) : null}
						{manualSubscription ? null : (
							<Button
								type="button"
								variant="outline"
								className="h-10 font-grotesk"
								disabled={portalPending}
								onClick={onOpenPortal}
							>
								<ArrowSquareOutIcon
									aria-hidden
									weight="bold"
									className="size-4"
								/>
								{copy.page.openPortal}
							</Button>
						)}
						{!subscription.cancelAtPeriodEnd ? (
							<CancelSubscriptionDialog
								starterOffer={starterOffer}
								onAcceptStarterOffer={onAcceptStarterOffer}
								periodEnd={subscription.currentPeriodEnd}
								locale={locale}
								pending={cancelPending}
								onConfirm={onCancel}
							/>
						) : null}
					</div>
				</>
			) : (
				<div className="mt-auto pt-8">
					<p className="font-bold font-grotesk text-night text-xl tracking-[-0.03em] dark:text-foreground">
						{copy.page.noSubscriptionTitle}
					</p>
					<p className="mt-1 max-w-md text-night/60 text-sm dark:text-foreground/60">
						{copy.page.noSubscriptionBody}
					</p>
					{subscriptionPlansAvailable ? (
						<KeycapButton
							type="button"
							size="md"
							className={cn("mt-5", KEYCAP_ON_CARD_CLASS)}
							onClick={onOpenPlanPicker}
						>
							{copy.page.choosePlan}
						</KeycapButton>
					) : null}
				</div>
			)}
		</section>
	);
}

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
	const copy = useDictionary().billing;
	const pending = copy.page.offline.pending;

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
						{pending.title}
					</h3>
					<p className="mt-0.5 text-night/60 text-sm dark:text-foreground/60">
						{t("billing.page.offline.pending.body", {
							phone: request.phone,
						})}
					</p>
					<p className="mt-2 font-grotesk font-semibold text-night text-sm dark:text-foreground">
						{getBillingPlanName(request.plan, copy.planPicker)}
						{" · "}
						{t("credits.creditUnit", { count: request.tierCredits })}
						{" · "}
						{request.interval === "year"
							? copy.planPicker.yearly
							: copy.planPicker.monthly}
					</p>
				</div>
			</div>
			<ManualRequestCancelDialog
				copy={pending}
				isPending={isCancelPending}
				onConfirm={onCancel}
			/>
		</section>
	);
}

function ManualGraceNotice({
	accessEndDate,
	locale,
	periodEndDate,
}: {
	accessEndDate: Date;
	locale: Locale;
	periodEndDate: Date;
}) {
	const { t } = useTranslation();
	const copy = useDictionary().billing.page.offline;

	return (
		<div
			role="status"
			className="flex items-start gap-3 rounded-[1.5rem] bg-amber-500/[0.1] px-4 py-3.5 text-night text-sm ring-1 ring-amber-500/30 dark:text-foreground"
		>
			<WarningIcon
				aria-hidden
				weight="duotone"
				className="size-5 shrink-0 text-amber-700 dark:text-amber-300"
			/>
			<div className="min-w-0">
				<p className="font-grotesk font-semibold">{copy.graceTitle}</p>
				<p className="mt-0.5 text-night/70 dark:text-foreground/70">
					{t("billing.page.offline.graceNotice", {
						accessEndDate: formatDate(accessEndDate, locale, {
							dateStyle: "medium",
						}),
						endDate: formatDate(periodEndDate, locale, {
							dateStyle: "medium",
						}),
					})}
				</p>
			</div>
		</div>
	);
}

function PlanDetail({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl bg-night/[0.03] px-4 py-3 ring-1 ring-night/[0.06] dark:bg-white/[0.04] dark:ring-white/10">
			<dt className={cn(LABEL_CLASS, "text-night/60 dark:text-foreground/60")}>
				{label}
			</dt>
			<dd className="mt-1 font-grotesk font-semibold text-night text-sm dark:text-foreground">
				{value}
			</dd>
		</div>
	);
}

function TopupSection({
	isPending,
	packs,
	locale,
	onBuy,
}: {
	isPending: boolean;
	packs: readonly BillingTopupPack[];
	locale: Locale;
	onBuy: (packId: BillingTopupPack["id"]) => void;
}) {
	const { t } = useTranslation();
	const copy = useDictionary().billing.page;

	return (
		<section className={cn(CARD_CLASS, "mt-4 p-5 sm:p-6")}>
			<CardHeading
				icon={WalletIcon}
				title={copy.topupsTitle}
				description={copy.topupsDescription}
			/>
			{isPending ? (
				<div className="mt-5 grid gap-3 sm:grid-cols-3" aria-hidden>
					<Skeleton className="h-20 rounded-2xl" />
					<Skeleton className="h-20 rounded-2xl" />
					<Skeleton className="h-20 rounded-2xl" />
				</div>
			) : (
				<div className="mt-5 grid gap-3 sm:grid-cols-3">
					{packs.map((pack) => (
						<button
							key={pack.id}
							type="button"
							className="flex items-center justify-between gap-3 rounded-2xl bg-night/[0.03] px-4 py-4 text-start outline-offset-2 ring-1 ring-night/[0.08] transition-[background-color,box-shadow] hover:bg-night/[0.05] hover:ring-night/20 focus-visible:outline-2 focus-visible:outline-ember sm:flex-col sm:items-start sm:gap-1 dark:bg-white/[0.04] dark:ring-white/10 dark:hover:bg-white/[0.07]"
							onClick={() => onBuy(pack.id)}
						>
							<span className="font-grotesk font-semibold text-night dark:text-foreground">
								{t("credits.creditUnit", { count: pack.credits })}
							</span>
							<span className="text-night/60 text-sm tabular-nums dark:text-foreground/60">
								{formatUsd(pack.usd, locale)}
							</span>
						</button>
					))}
				</div>
			)}
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

/** The balance card, the plan card, and the activity card, in their real shapes. */
function BillingPageSkeleton() {
	return (
		<div className="mt-6 grid gap-4 lg:grid-cols-2" aria-hidden>
			<Skeleton className="h-72 rounded-[1.5rem]" />
			<Skeleton className="h-72 rounded-[1.5rem]" />
			<Skeleton className="h-80 rounded-[1.5rem] lg:col-span-2" />
		</div>
	);
}

function statusLabel(status: string, copy: Record<string, string>) {
	return Object.hasOwn(copy, status)
		? (copy[status] ?? copy.unknown)
		: copy.unknown;
}

function formatUsd(value: number, locale: Locale) {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(value);
}

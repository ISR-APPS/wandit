import { Link } from "@tanstack/react-router";
import type {
	BillingCancelRequest,
	BillingTopupPack,
	CancellationReasonCode,
	Subscription,
} from "@wandit/contracts";
import {
	formatDate,
	formatNumber,
	type Locale,
} from "@wandit/internationalization";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@wandit/ui/components/alert-dialog";
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@wandit/ui/components/card";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Textarea } from "@wandit/ui/components/textarea";
import {
	ArrowLeft,
	CreditCard,
	ExternalLink,
	ReceiptText,
	RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Spark } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { UserMenu } from "@/features/auth";
import {
	useCancelBillingSubscription,
	useCreateBillingPortal,
	useCreateBillingTopupCheckout,
	useResumeBillingSubscription,
} from "@/features/billing/api/billing.mutations";
import {
	useBillingPlansQuery,
	useBillingSubscriptionQuery,
} from "@/features/billing/api/billing.queries";
import { useBillingModal } from "@/features/billing/components/billing-modal-provider";
import { areTopupsAvailable } from "@/features/billing/lib/billing-ui-policy";
import { parseBillingCancelRequest } from "@/features/billing/lib/cancel-subscription";
import {
	useCreditBalanceQuery,
	useCreditLedgerQuery,
} from "@/features/credits/api/credits.queries";
import { LedgerList } from "@/features/credits/components/ledger-list";
import { formatCreditBalance } from "@/features/credits/lib/format-credits";
import { usePublicSettingsQuery } from "@/features/settings/api/settings.queries";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { getApiErrorMessage } from "@/lib/api-client";
import { useDictionary, useTranslation } from "@/lib/i18n";

const LEDGER_PAGE_SIZE = 10;
const CANCELLATION_REASON_CODES = [
	"too_expensive",
	"not_using_enough",
	"missing_features",
	"technical_issues",
	"switching_provider",
	"temporary_pause",
	"other",
] as const satisfies readonly CancellationReasonCode[];

export default function BillingPage() {
	const { locale, t } = useTranslation();
	const { actorCanManageBilling } = useWorkspace();
	const copy = useDictionary().billing;
	const { openPlanPicker } = useBillingModal();
	const [ledgerPage, setLedgerPage] = useState(1);
	const balanceQuery = useCreditBalanceQuery();
	const ledgerQuery = useCreditLedgerQuery({
		page: ledgerPage,
		pageSize: LEDGER_PAGE_SIZE,
	});
	const subscriptionQuery = useBillingSubscriptionQuery();
	const settingsQuery = usePublicSettingsQuery();
	const plansQuery = useBillingPlansQuery();
	const cancelSubscription = useCancelBillingSubscription();
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
			<div className="min-h-[100dvh] bg-background">
				<BillingHeader />
				<main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
					<div className="rounded-xl border bg-card p-8 text-center">
						<h1 className="font-display text-xl tracking-tight">
							{t("workspaces.billing.ownerOnlyTitle")}
						</h1>
						<p className="mt-2 text-muted-foreground text-sm">
							{t("workspaces.billing.ownerOnlyBody")}
						</p>
					</div>
				</main>
			</div>
		);
	}

	return (
		<div className="min-h-[100dvh] bg-background">
			<BillingHeader />
			<main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
				<Link
					to="/dashboard"
					className="inline-flex items-center gap-1.5 rounded-md text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
				>
					<ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
					{copy.page.backToDashboard}
				</Link>

				<div className="mt-7 flex flex-wrap items-start justify-between gap-4">
					<div>
						<div className="flex flex-wrap items-center gap-2.5">
							<h1 className="font-display font-semibold text-3xl tracking-tight">
								{copy.page.title}
							</h1>
							{settingsQuery.data?.paidSubscriptionsEnabled === false ? (
								<Badge variant="secondary">{copy.page.betaBadge}</Badge>
							) : null}
						</div>
						<p className="mt-2 max-w-2xl text-muted-foreground text-sm">
							{copy.page.description}
						</p>
					</div>
				</div>

				{settingsQuery.data?.paidSubscriptionsEnabled === false ? (
					<div className="mt-6 rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 text-sm">
						{copy.page.betaBody}
					</div>
				) : null}

				{corePending ? (
					<BillingPageSkeleton />
				) : coreError ? (
					<div
						role="alert"
						className="mt-8 rounded-2xl border border-destructive/25 bg-destructive/[0.035] p-6"
					>
						<h2 className="font-display font-semibold text-lg">
							{copy.page.loadErrorTitle}
						</h2>
						<p className="mt-2 text-muted-foreground text-sm">
							{copy.page.loadErrorBody}
						</p>
						<Button
							type="button"
							variant="outline"
							className="mt-4"
							onClick={retryCore}
						>
							<RefreshCw aria-hidden />
							{copy.page.retry}
						</Button>
					</div>
				) : balanceQuery.data &&
					subscriptionQuery.data &&
					settingsQuery.data ? (
					<>
						<div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
							<BalanceCard balance={balanceQuery.data} locale={locale} />
							<SubscriptionCard
								subscription={subscriptionQuery.data.subscription}
								paidSubscriptionsEnabled={
									settingsQuery.data.paidSubscriptionsEnabled
								}
								locale={locale}
								onOpenPlanPicker={() => openPlanPicker("billing_page")}
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

						<Card className="mt-5 gap-0 overflow-hidden py-0">
							<CardHeader className="border-b px-5 py-5 sm:px-6">
								<div className="flex items-start gap-3">
									<span className="grid size-9 shrink-0 place-items-center rounded-xl border bg-muted/45">
										<ReceiptText
											className="size-4 text-muted-foreground"
											aria-hidden
										/>
									</span>
									<div>
										<CardTitle>{copy.page.ledgerTitle}</CardTitle>
										<CardDescription className="mt-1">
											{copy.page.ledgerDescription}
										</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent className="px-3 py-2 sm:px-5">
								<LedgerList
									entries={ledgerQuery.data?.items ?? []}
									isPending={ledgerQuery.isPending}
									isError={ledgerQuery.isError}
								/>
								<LedgerPagination
									page={ledgerPage}
									total={ledgerQuery.data?.total ?? 0}
									onPageChange={setLedgerPage}
								/>
							</CardContent>
						</Card>
					</>
				) : null}
			</main>
		</div>
	);
}

function BillingHeader() {
	const copy = useDictionary().billing.page;

	return (
		<header className="sticky top-0 z-40 border-b bg-background/82 backdrop-blur-md">
			<div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6">
				<Link
					to="/dashboard"
					aria-label={copy.backToDashboard}
					className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
				>
					<span className="grid size-7 place-items-center rounded-full bg-gradient-ember">
						<Spark className="size-3.5 text-background" />
					</span>
					<span className="font-display font-semibold text-lg tracking-tight">
						wandit
					</span>
				</Link>
				<div className="ms-auto flex items-center gap-1.5">
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}

function BalanceCard({
	balance,
	locale,
}: {
	balance: { balance: number; plan: number; promo: number; topup: number };
	locale: Locale;
}) {
	const copy = useDictionary();

	return (
		<Card className="gap-0 overflow-hidden py-0">
			<CardHeader className="border-b px-5 py-5 sm:px-6">
				<CardTitle>{copy.billing.page.balanceTitle}</CardTitle>
				<CardDescription>
					{copy.billing.page.balanceDescription}
				</CardDescription>
			</CardHeader>
			<CardContent className="px-5 py-6 sm:px-6">
				<p className="text-muted-foreground text-xs">
					{copy.billing.page.totalBalance}
				</p>
				<p className="mt-1 font-mono font-semibold text-4xl tabular-nums tracking-tight">
					{formatCreditBalance(balance.balance, locale)}
				</p>
				<dl className="mt-6 grid grid-cols-3 divide-x divide-border border-t pt-4 rtl:divide-x-reverse">
					<BucketMetric
						label={copy.credits.buckets.plan}
						value={formatCreditBalance(balance.plan, locale)}
					/>
					<BucketMetric
						label={copy.credits.buckets.promo}
						value={formatCreditBalance(balance.promo, locale)}
					/>
					<BucketMetric
						label={copy.credits.buckets.topup}
						value={formatCreditBalance(balance.topup, locale)}
					/>
				</dl>
			</CardContent>
		</Card>
	);
}

function BucketMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 px-3 first:ps-0 last:pe-0">
			<dt className="truncate text-[10px] text-muted-foreground uppercase tracking-wider">
				{label}
			</dt>
			<dd className="mt-1 font-medium font-mono text-base tabular-nums">
				{value}
			</dd>
		</div>
	);
}

function SubscriptionCard({
	subscription,
	paidSubscriptionsEnabled,
	locale,
	onOpenPlanPicker,
	onOpenPortal,
	portalPending,
	cancelPending,
	resumePending,
	onCancel,
	onResume,
}: {
	subscription: Subscription | null;
	paidSubscriptionsEnabled: boolean;
	locale: Locale;
	onOpenPlanPicker: () => void;
	onOpenPortal: () => void;
	portalPending: boolean;
	cancelPending: boolean;
	resumePending: boolean;
	onCancel: (request: BillingCancelRequest) => void;
	onResume: () => void;
}) {
	const { t } = useTranslation();
	const copy = useDictionary().billing;

	return (
		<Card className="gap-0 overflow-hidden py-0">
			<CardHeader className="border-b px-5 py-5 sm:px-6">
				<div className="flex items-start justify-between gap-3">
					<div>
						<CardTitle>{copy.page.subscriptionTitle}</CardTitle>
						<CardDescription className="mt-1">
							{copy.page.subscriptionDescription}
						</CardDescription>
					</div>
					{subscription ? (
						<Badge
							variant={
								subscription.cancelAtPeriodEnd
									? "warning"
									: subscription.entitled
										? "success"
										: "destructive"
							}
						>
							{subscription.cancelAtPeriodEnd
								? copy.status.canceling
								: statusLabel(subscription.status, copy.status)}
						</Badge>
					) : null}
				</div>
			</CardHeader>
			<CardContent className="px-5 py-6 sm:px-6">
				{subscription ? (
					<>
						<p className="font-display font-semibold text-2xl tracking-tight">
							{copy.page.proPlan}
						</p>
						<p className="mt-1 text-muted-foreground text-sm">
							{t("billing.page.creditsPerCycle", {
								count: formatNumber(subscription.tierCredits, locale),
							})}
							·{" "}
							{subscription.interval === "year"
								? copy.planPicker.yearly
								: copy.planPicker.monthly}
						</p>
						<dl className="mt-5 grid gap-3 rounded-xl border bg-muted/25 p-4 sm:grid-cols-2">
							<PlanDetail
								label={copy.page.statusLabel}
								value={statusLabel(subscription.status, copy.status)}
							/>
							<PlanDetail
								label={
									subscription.cancelAtPeriodEnd
										? copy.page.endsLabel
										: copy.page.renewsLabel
								}
								value={formatDate(subscription.currentPeriodEnd, locale, {
									dateStyle: "medium",
								})}
							/>
							{subscription.pendingTierCredits ? (
								<PlanDetail
									label={copy.page.pendingTierLabel}
									value={t("credits.creditUnit", {
										count: subscription.pendingTierCredits,
									})}
								/>
							) : null}
						</dl>
						<div className="mt-5 flex flex-wrap gap-2">
							{subscription.cancelAtPeriodEnd && paidSubscriptionsEnabled ? (
								<Button
									type="button"
									disabled={resumePending}
									onClick={onResume}
								>
									{resumePending ? copy.page.resuming : copy.page.resumePlan}
								</Button>
							) : !subscription.cancelAtPeriodEnd &&
								paidSubscriptionsEnabled ? (
								<Button type="button" onClick={onOpenPlanPicker}>
									{copy.page.changePlan}
								</Button>
							) : null}
							<Button
								type="button"
								variant="outline"
								disabled={portalPending}
								onClick={onOpenPortal}
							>
								<ExternalLink aria-hidden />
								{copy.page.openPortal}
							</Button>
							{!subscription.cancelAtPeriodEnd ? (
								<CancelSubscriptionDialog
									pending={cancelPending}
									onConfirm={onCancel}
								/>
							) : null}
						</div>
					</>
				) : (
					<div className="flex min-h-52 flex-col justify-between">
						<div>
							<span className="grid size-10 place-items-center rounded-xl border bg-muted/45">
								<CreditCard
									className="size-4 text-muted-foreground"
									aria-hidden
								/>
							</span>
							<h3 className="mt-4 font-display font-semibold text-xl tracking-tight">
								{copy.page.noSubscriptionTitle}
							</h3>
							<p className="mt-2 max-w-md text-muted-foreground text-sm">
								{copy.page.noSubscriptionBody}
							</p>
						</div>
						{paidSubscriptionsEnabled ? (
							<Button
								type="button"
								className="mt-5 w-fit"
								onClick={onOpenPlanPicker}
							>
								{copy.page.choosePlan}
							</Button>
						) : null}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function PlanDetail({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<dt className="text-[10px] text-muted-foreground uppercase tracking-wider">
				{label}
			</dt>
			<dd className="mt-1 text-sm">{value}</dd>
		</div>
	);
}

function CancelSubscriptionDialog({
	pending,
	onConfirm,
}: {
	pending: boolean;
	onConfirm: (request: BillingCancelRequest) => void;
}) {
	const copy = useDictionary().billing.page;
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState<CancellationReasonCode | null>(null);
	const [details, setDetails] = useState("");
	const request = parseBillingCancelRequest(reason, details);
	const detailsRequired = reason === "other" && details.trim().length === 0;

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) {
			setReason(null);
			setDetails("");
		}
	};

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogTrigger asChild>
				<Button type="button" variant="ghost" className="text-destructive">
					{copy.cancelPlan}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
				<AlertDialogHeader>
					<AlertDialogTitle>{copy.cancelTitle}</AlertDialogTitle>
					<AlertDialogDescription>{copy.cancelBody}</AlertDialogDescription>
				</AlertDialogHeader>
				<fieldset className="space-y-2">
					<legend className="font-medium text-sm">
						{copy.cancelReasonPrompt}
					</legend>
					<div className="grid gap-2">
						{CANCELLATION_REASON_CODES.map((reasonCode) => (
							<label
								key={reasonCode}
								className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted/40 has-[:disabled]:cursor-not-allowed has-[:checked]:border-primary/50 has-[:checked]:bg-primary/[0.04] has-[:disabled]:opacity-50"
							>
								<input
									type="radio"
									name="cancellation-reason"
									value={reasonCode}
									checked={reason === reasonCode}
									disabled={pending}
									required
									className="size-4 shrink-0 accent-primary"
									onChange={() => setReason(reasonCode)}
								/>
								<span>{copy.cancelReasons[reasonCode]}</span>
							</label>
						))}
					</div>
				</fieldset>
				<div className="space-y-2">
					<label htmlFor="cancellation-details" className="font-medium text-sm">
						{copy.cancelDetailsLabel}
						{reason === "other" ? null : (
							<span className="ms-1 font-normal text-muted-foreground">
								{copy.cancelDetailsOptional}
							</span>
						)}
					</label>
					<Textarea
						id="cancellation-details"
						value={details}
						disabled={pending}
						required={reason === "other"}
						maxLength={1000}
						rows={3}
						placeholder={copy.cancelDetailsPlaceholder}
						aria-invalid={detailsRequired || undefined}
						aria-describedby={
							detailsRequired ? "cancellation-details-error" : undefined
						}
						onChange={(event) => setDetails(event.target.value)}
					/>
					{detailsRequired ? (
						<p
							id="cancellation-details-error"
							className="text-destructive text-xs"
						>
							{copy.cancelDetailsRequired}
						</p>
					) : null}
				</div>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={pending}>
						{copy.keepPlan}
					</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={pending || !request.success}
						onClick={() => {
							if (request.success) {
								onConfirm(request.data);
							}
						}}
					>
						{pending ? copy.cancelling : copy.confirmCancel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
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
		<section className="mt-5 rounded-2xl border bg-card px-5 py-5 sm:px-6">
			<div className="flex items-start gap-3">
				<span className="grid size-9 shrink-0 place-items-center rounded-xl border bg-muted/45">
					<CreditCard className="size-4 text-muted-foreground" aria-hidden />
				</span>
				<div>
					<h2 className="font-semibold">{copy.topupsTitle}</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						{copy.topupsDescription}
					</p>
				</div>
			</div>
			{isPending ? (
				<div className="mt-5 grid gap-3 sm:grid-cols-3" aria-hidden>
					<Skeleton className="h-20 rounded-xl" />
					<Skeleton className="h-20 rounded-xl" />
					<Skeleton className="h-20 rounded-xl" />
				</div>
			) : (
				<div className="mt-5 grid gap-3 sm:grid-cols-3">
					{packs.map((pack) => (
						<Button
							key={pack.id}
							type="button"
							variant="outline"
							className="h-auto justify-between rounded-xl px-4 py-4 sm:flex-col sm:items-start"
							onClick={() => onBuy(pack.id)}
						>
							<span>{t("credits.creditUnit", { count: pack.credits })}</span>
							<span className="font-mono text-muted-foreground text-xs">
								{formatUsd(pack.usd, locale)}
							</span>
						</Button>
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
		<div className="flex flex-wrap items-center justify-between gap-3 border-t px-2 py-3">
			<p className="text-muted-foreground text-xs">
				{t("billing.page.pageStatus", { page, totalPages })}
			</p>
			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={page <= 1}
					onClick={() => onPageChange(Math.max(1, page - 1))}
				>
					{copy.previousPage}
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={page >= totalPages}
					onClick={() => onPageChange(Math.min(totalPages, page + 1))}
				>
					{copy.nextPage}
				</Button>
			</div>
		</div>
	);
}

function BillingPageSkeleton() {
	return (
		<div className="mt-8 grid gap-5 lg:grid-cols-2" aria-hidden>
			<Skeleton className="h-72 rounded-xl" />
			<Skeleton className="h-72 rounded-xl" />
			<Skeleton className="h-80 rounded-xl lg:col-span-2" />
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

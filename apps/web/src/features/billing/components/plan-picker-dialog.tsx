import type {
	BillingInterval,
	BillingSubscriptionChangeOutcomeResponse,
	BillingSubscriptionChangePreviewResponse,
	BillingTierPrice,
	BillingTopupPack,
	CreditTier,
	Subscription,
} from "@wandit/contracts";
import { creditTierSchema } from "@wandit/contracts";
import { formatNumber, type Locale } from "@wandit/internationalization";
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@wandit/ui/components/dialog";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@wandit/ui/components/tabs";
import { cn } from "@wandit/ui/lib/utils";
import {
	AlertTriangle,
	ArrowLeft,
	Check,
	CreditCard,
	ExternalLink,
} from "lucide-react";
import { useState } from "react";

import {
	useChangeBillingSubscription,
	useCreateBillingCheckout,
	useCreateBillingPortal,
	useCreateBillingTopupCheckout,
	usePreviewBillingSubscriptionChange,
	useResumeBillingSubscription,
} from "@/features/billing/api/billing.mutations";
import {
	useBillingPlansQuery,
	useBillingSubscriptionQuery,
} from "@/features/billing/api/billing.queries";
import {
	areTopupsAvailable,
	resolvePlanPickerInterval,
} from "@/features/billing/lib/billing-ui-policy";
import {
	isRenewalDowngrade,
	tierPriceUsd,
	tierSavingsPercent,
} from "@/features/billing/lib/plan-pricing";
import { usePublicSettingsQuery } from "@/features/settings/api/settings.queries";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { useDictionary, useTranslation } from "@/lib/i18n";

export type PlanPickerDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialInterval?: BillingInterval;
	initialTierCredits?: CreditTier;
	requiredCredits?: number;
	availableCredits?: number;
};

type PickerStep = "select" | "preview" | "outcome";

type ChangeTarget = {
	interval: BillingInterval;
	tierCredits: CreditTier;
};

export function PlanPickerDialog({
	open,
	onOpenChange,
	initialInterval,
	initialTierCredits,
	requiredCredits,
	availableCredits,
}: PlanPickerDialogProps) {
	const { t } = useTranslation();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{open ? (
				<DialogContent
					className="max-h-[min(760px,calc(100dvh-2rem))] overflow-y-auto sm:max-w-[620px]"
					closeLabel={t("common.close")}
				>
					<PlanPickerContent
						initialInterval={initialInterval}
						initialTierCredits={initialTierCredits}
						onClose={() => onOpenChange(false)}
						requiredCredits={requiredCredits}
						availableCredits={availableCredits}
					/>
				</DialogContent>
			) : null}
		</Dialog>
	);
}

function PlanPickerContent({
	onClose,
	initialInterval,
	initialTierCredits,
	requiredCredits,
	availableCredits,
}: {
	onClose: () => void;
	initialInterval?: BillingInterval;
	initialTierCredits?: CreditTier;
	requiredCredits?: number;
	availableCredits?: number;
}) {
	const { locale, t } = useTranslation();
	const copy = useDictionary().billing.planPicker;
	const plansQuery = useBillingPlansQuery();
	const subscriptionQuery = useBillingSubscriptionQuery();
	const settingsQuery = usePublicSettingsQuery();
	const checkout = useCreateBillingCheckout();
	const topup = useCreateBillingTopupCheckout();
	const portal = useCreateBillingPortal();
	const resume = useResumeBillingSubscription();
	const previewChange = usePreviewBillingSubscriptionChange();
	const applyChange = useChangeBillingSubscription();
	const [step, setStep] = useState<PickerStep>("select");
	const [selectedInterval, setSelectedInterval] =
		useState<BillingInterval | null>(initialInterval ?? null);
	const [selectedTierCredits, setSelectedTierCredits] =
		useState<CreditTier | null>(initialTierCredits ?? null);
	const [preview, setPreview] =
		useState<BillingSubscriptionChangePreviewResponse | null>(null);
	const [target, setTarget] = useState<ChangeTarget | null>(null);
	const [outcome, setOutcome] =
		useState<BillingSubscriptionChangeOutcomeResponse | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	if (
		plansQuery.isPending ||
		subscriptionQuery.isPending ||
		settingsQuery.isPending
	) {
		return (
			<PlanPickerSkeleton
				requiredCredits={requiredCredits}
				availableCredits={availableCredits}
			/>
		);
	}

	if (
		plansQuery.isError ||
		subscriptionQuery.isError ||
		settingsQuery.isError
	) {
		return (
			<PickerNotice
				tone="error"
				title={copy.loadErrorTitle}
				body={copy.loadErrorBody}
				requiredCredits={requiredCredits}
				availableCredits={availableCredits}
				action={
					<Button type="button" variant="outline" onClick={onClose}>
						{copy.close}
					</Button>
				}
			/>
		);
	}

	const settings = settingsQuery.data;
	const catalog = plansQuery.data;
	const subscriptionView = subscriptionQuery.data;

	if (!settings || !catalog || !subscriptionView) {
		return null;
	}

	const subscription = subscriptionView.subscription;
	const noticeAvailableCredits =
		availableCredits ?? subscriptionView.balance.balance;
	const topupsAvailable = areTopupsAvailable(
		settings.topupsEnabled,
		catalog.topupPacks.length,
	);

	if (!settings.paidSubscriptionsEnabled) {
		return (
			<PickerNotice
				tone="neutral"
				badge={copy.betaBadge}
				title={copy.betaTitle}
				body={copy.betaBody}
				requiredCredits={requiredCredits}
				availableCredits={noticeAvailableCredits}
				extra={
					topupsAvailable ? (
						<TopupPackChoices
							packs={catalog.topupPacks}
							isPending={topup.isPending}
							onSelect={(packId) => {
								setErrorMessage(null);
								void topup
									.mutateAsync({ packId })
									.catch((error) => setErrorMessage(getApiErrorMessage(error)));
							}}
						/>
					) : undefined
				}
				error={errorMessage}
				action={
					<Button type="button" onClick={onClose}>
						{copy.close}
					</Button>
				}
			/>
		);
	}

	if (subscription?.cancelAtPeriodEnd) {
		return (
			<PickerNotice
				tone="warning"
				title={copy.resumeFirstTitle}
				body={copy.resumeFirstBody}
				requiredCredits={requiredCredits}
				availableCredits={noticeAvailableCredits}
				error={errorMessage}
				extra={
					topupsAvailable ? (
						<TopupPackChoices
							packs={catalog.topupPacks}
							isPending={topup.isPending}
							onSelect={(packId) => {
								setErrorMessage(null);
								void topup
									.mutateAsync({ packId })
									.catch((error) => setErrorMessage(getApiErrorMessage(error)));
							}}
						/>
					) : undefined
				}
				action={
					<Button
						type="button"
						disabled={resume.isPending}
						onClick={() => {
							setErrorMessage(null);
							void resume.mutateAsync().catch((error) => {
								setErrorMessage(getApiErrorMessage(error));
							});
						}}
					>
						{resume.isPending ? copy.resuming : copy.resume}
					</Button>
				}
			/>
		);
	}

	if (subscription && !subscription.entitled) {
		return (
			<PickerNotice
				tone="warning"
				title={copy.paymentAttentionTitle}
				body={copy.paymentAttentionBody}
				requiredCredits={requiredCredits}
				availableCredits={noticeAvailableCredits}
				error={errorMessage}
				extra={
					topupsAvailable ? (
						<TopupPackChoices
							packs={catalog.topupPacks}
							isPending={topup.isPending}
							onSelect={(packId) => {
								setErrorMessage(null);
								void topup
									.mutateAsync({ packId })
									.catch((error) => setErrorMessage(getApiErrorMessage(error)));
							}}
						/>
					) : undefined
				}
				action={
					<Button
						type="button"
						disabled={portal.isPending}
						onClick={() => {
							setErrorMessage(null);
							void portal.mutateAsync().catch((error) => {
								setErrorMessage(getApiErrorMessage(error));
							});
						}}
					>
						<ExternalLink aria-hidden />
						{copy.openPortal}
					</Button>
				}
			/>
		);
	}

	if (step === "preview" && preview && target && subscription) {
		const downgrade = isRenewalDowngrade(subscription, target);

		return (
			<ChangePreview
				preview={preview}
				target={target}
				downgrade={downgrade}
				isPending={applyChange.isPending}
				errorMessage={errorMessage}
				onBack={() => {
					setErrorMessage(null);
					setStep("select");
				}}
				onConfirm={() => {
					setErrorMessage(null);
					void applyChange
						.mutateAsync({ intentId: preview.intentId })
						.then((result) => {
							setOutcome(result);
							setStep("outcome");
						})
						.catch((error) => {
							setErrorMessage(changeErrorMessage(error, copy));
						});
				}}
			/>
		);
	}

	if (step === "outcome" && outcome && target) {
		return (
			<ChangeOutcome
				outcome={outcome}
				target={target}
				previousSubscription={subscription}
				onClose={onClose}
				onTryAgain={() => {
					setOutcome(null);
					setPreview(null);
					setErrorMessage(null);
					setStep("select");
				}}
			/>
		);
	}

	const plan = catalog.plans.find((item) => item.id === "pro");

	if (!plan || plan.tiers.length === 0) {
		return (
			<PickerNotice
				tone="error"
				title={copy.loadErrorTitle}
				body={copy.catalogEmptyBody}
				requiredCredits={requiredCredits}
				availableCredits={noticeAvailableCredits}
				action={
					<Button type="button" variant="outline" onClick={onClose}>
						{copy.close}
					</Button>
				}
			/>
		);
	}

	const interval = resolvePlanPickerInterval(
		selectedInterval,
		subscription?.interval,
	);
	const tierCredits =
		selectedTierCredits ?? suggestedTierCredits(plan.tiers, subscription);
	const tier =
		plan.tiers.find((item) => item.tierCredits === tierCredits) ??
		plan.tiers[0];

	if (!tier) {
		return null;
	}

	const sameAsCurrent =
		subscription?.interval === interval &&
		subscription.tierCredits === tier.tierCredits;
	const savings = tierSavingsPercent(tier);
	const visibleAvailableCredits =
		availableCredits ?? subscriptionView.balance.balance;

	const handlePrimaryAction = () => {
		setErrorMessage(null);

		if (!subscription) {
			void checkout
				.mutateAsync({
					plan: "pro",
					tierCredits: tier.tierCredits,
					interval,
				})
				.catch((error) => setErrorMessage(getApiErrorMessage(error)));
			return;
		}

		const nextTarget = {
			interval,
			plan: "pro" as const,
			tierCredits: tier.tierCredits,
		};
		void previewChange
			.mutateAsync(nextTarget)
			.then((result) => {
				setTarget({ interval, tierCredits: tier.tierCredits });
				setPreview(result);
				setStep("preview");
			})
			.catch((error) => {
				setErrorMessage(changeErrorMessage(error, copy));
			});
	};

	return (
		<>
			<DialogHeader className="text-start">
				<div className="flex flex-wrap items-center gap-2">
					<DialogTitle className="font-display tracking-tight">
						{subscription ? copy.changeTitle : copy.chooseTitle}
					</DialogTitle>
					{subscription ? (
						<Badge variant="outline">{copy.currentPlan}</Badge>
					) : null}
				</div>
				<DialogDescription>
					{subscription ? copy.changeDescription : copy.chooseDescription}
				</DialogDescription>
			</DialogHeader>

			{requiredCredits !== undefined ? (
				<div className="grid grid-cols-2 gap-3 rounded-xl border border-primary/25 bg-primary/[0.045] p-3">
					<RequirementMetric
						label={copy.requiredCredits}
						value={formatNumber(requiredCredits, locale)}
					/>
					<RequirementMetric
						label={copy.availableCredits}
						value={formatNumber(visibleAvailableCredits, locale)}
					/>
				</div>
			) : null}

			<div className="grid gap-5 rounded-2xl border bg-card/70 p-4 sm:p-5">
				<div className="grid gap-2">
					<span className="font-medium text-sm">{copy.billingCycle}</span>
					<Tabs
						value={interval}
						onValueChange={(value) => {
							if (value === "month" || value === "year") {
								setSelectedInterval(value);
							}
						}}
					>
						<TabsList
							className={cn(
								"grid h-auto w-full",
								subscription?.interval === "year"
									? "grid-cols-1"
									: "grid-cols-2",
							)}
						>
							{subscription?.interval !== "year" ? (
								<TabsTrigger value="month" className="py-2">
									{copy.monthly}
								</TabsTrigger>
							) : null}
							<TabsTrigger value="year" className="gap-2 py-2">
								{copy.yearly}
								<Badge variant="success" className="px-1.5 py-0 text-[10px]">
									{copy.twoMonthsFree}
								</Badge>
							</TabsTrigger>
						</TabsList>
					</Tabs>
					{subscription?.interval === "year" ? (
						<p className="text-muted-foreground text-xs">
							{copy.yearlyToMonthlyUnavailable}
						</p>
					) : null}
				</div>

				<div className="grid gap-2">
					<label htmlFor="billing-tier" className="font-medium text-sm">
						{copy.creditTier}
					</label>
					<Select
						value={String(tier.tierCredits)}
						onValueChange={(value) => {
							const parsed = creditTierSchema.safeParse(Number(value));
							if (parsed.success) setSelectedTierCredits(parsed.data);
						}}
					>
						<SelectTrigger id="billing-tier" className="h-11 w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{plan.tiers.map((option) => {
									const optionSavings = tierSavingsPercent(option);
									return (
										<SelectItem
											key={option.tierCredits}
											value={String(option.tierCredits)}
										>
											<span className="flex min-w-0 items-center gap-2">
												<span>
													{t("credits.creditUnit", {
														count: option.tierCredits,
													})}
												</span>
												<span className="text-muted-foreground">
													{formatUsd(tierPriceUsd(option, interval), locale)}
												</span>
												{optionSavings > 0 ? (
													<Badge
														variant="success"
														className="px-1.5 py-0 text-[10px]"
													>
														{t("billing.planPicker.savePercent", {
															percent: optionSavings,
														})}
													</Badge>
												) : null}
											</span>
										</SelectItem>
									);
								})}
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-wrap items-end justify-between gap-3 border-t pt-4">
					<div>
						<p className="text-muted-foreground text-xs">
							{copy.selectedPrice}
						</p>
						<p className="mt-1 font-mono font-semibold text-2xl tabular-nums">
							{formatUsd(tierPriceUsd(tier, interval), locale)}
							<span className="ms-1 font-normal text-muted-foreground text-xs">
								{interval === "year" ? copy.perYear : copy.perMonth}
							</span>
						</p>
					</div>
					{savings > 0 ? (
						<Badge variant="success">
							{t("billing.planPicker.savePercent", { percent: savings })}
						</Badge>
					) : null}
				</div>
			</div>

			{topupsAvailable ? (
				<TopupPackChoices
					packs={catalog.topupPacks}
					isPending={topup.isPending}
					onSelect={(packId) => {
						setErrorMessage(null);
						void topup
							.mutateAsync({ packId })
							.catch((error) => setErrorMessage(getApiErrorMessage(error)));
					}}
				/>
			) : null}

			{errorMessage ? <InlineError message={errorMessage} /> : null}

			<DialogFooter>
				<Button type="button" variant="outline" onClick={onClose}>
					{copy.close}
				</Button>
				<Button
					type="button"
					disabled={
						sameAsCurrent || checkout.isPending || previewChange.isPending
					}
					onClick={handlePrimaryAction}
				>
					{sameAsCurrent
						? copy.currentSelection
						: checkout.isPending || previewChange.isPending
							? copy.preparing
							: subscription
								? copy.previewChange
								: copy.continueToCheckout}
				</Button>
			</DialogFooter>
		</>
	);
}

function ChangePreview({
	preview,
	target,
	downgrade,
	isPending,
	errorMessage,
	onBack,
	onConfirm,
}: {
	preview: BillingSubscriptionChangePreviewResponse;
	target: ChangeTarget;
	downgrade: boolean;
	isPending: boolean;
	errorMessage: string | null;
	onBack: () => void;
	onConfirm: () => void;
}) {
	const { locale, t } = useTranslation();
	const copy = useDictionary().billing.planPicker;
	const amount = formatMinorCurrency(
		preview.amountDueMinor,
		preview.currency,
		locale,
	);

	return (
		<>
			<DialogHeader className="text-start">
				<DialogTitle className="font-display tracking-tight">
					{copy.previewTitle}
				</DialogTitle>
				<DialogDescription>{copy.previewDescription}</DialogDescription>
			</DialogHeader>
			<div className="rounded-2xl border bg-card/70 p-5">
				<div className="flex items-center justify-between gap-4">
					<div>
						<p className="text-muted-foreground text-xs">{copy.newPlan}</p>
						<p className="mt-1 font-medium">
							{t("credits.creditUnit", { count: target.tierCredits })} ·{" "}
							{target.interval === "year" ? copy.yearly : copy.monthly}
						</p>
					</div>
					<CreditCard className="size-5 text-ember-text" aria-hidden />
				</div>
				<div className="mt-5 border-t pt-4">
					{downgrade ? (
						<>
							<Badge variant="warning">{copy.changesAtRenewal}</Badge>
							<p className="mt-2 text-muted-foreground text-sm">
								{copy.downgradeExplanation}
							</p>
						</>
					) : (
						<p className="font-medium text-base">
							{t("billing.planPicker.payNowCredits", {
								amount,
								credits: signedNumber(preview.creditsDelta, locale),
							})}
						</p>
					)}
				</div>
			</div>
			{errorMessage ? <InlineError message={errorMessage} /> : null}
			<DialogFooter>
				<Button type="button" variant="outline" onClick={onBack}>
					<ArrowLeft className="rtl:rotate-180" aria-hidden />
					{copy.back}
				</Button>
				<Button type="button" disabled={isPending} onClick={onConfirm}>
					{isPending ? copy.applying : copy.confirmChange}
				</Button>
			</DialogFooter>
		</>
	);
}

function ChangeOutcome({
	outcome,
	target,
	previousSubscription,
	onClose,
	onTryAgain,
}: {
	outcome: BillingSubscriptionChangeOutcomeResponse;
	target: ChangeTarget;
	previousSubscription: Subscription | null;
	onClose: () => void;
	onTryAgain: () => void;
}) {
	const copy = useDictionary().billing.planPicker;

	if (outcome.outcome === "payment_required") {
		return (
			<PickerNotice
				tone="warning"
				title={copy.paymentRequiredTitle}
				body={copy.paymentRequiredBody}
				action={
					outcome.hostedInvoiceUrl ? (
						<Button asChild>
							<a href={outcome.hostedInvoiceUrl}>
								{copy.openInvoice}
								<ExternalLink aria-hidden />
							</a>
						</Button>
					) : (
						<Button type="button" onClick={onClose}>
							{copy.close}
						</Button>
					)
				}
			/>
		);
	}

	if (outcome.outcome === "failed") {
		return (
			<PickerNotice
				tone="error"
				title={copy.changeFailedTitle}
				body={copy.changeFailedBody}
				action={
					<Button type="button" onClick={onTryAgain}>
						{copy.tryAgain}
					</Button>
				}
			/>
		);
	}

	const downgrade = previousSubscription
		? isRenewalDowngrade(previousSubscription, target)
		: false;

	return (
		<PickerNotice
			tone="success"
			title={copy.changeAppliedTitle}
			body={downgrade ? copy.downgradeAppliedBody : copy.changeAppliedBody}
			action={
				<Button type="button" onClick={onClose}>
					{copy.done}
				</Button>
			}
		/>
	);
}

function PickerNotice({
	tone,
	badge,
	title,
	body,
	error,
	requiredCredits,
	availableCredits,
	extra,
	action,
}: {
	tone: "error" | "neutral" | "success" | "warning";
	badge?: string;
	title: string;
	body: string;
	error?: string | null;
	requiredCredits?: number;
	availableCredits?: number;
	extra?: React.ReactNode;
	action: React.ReactNode;
}) {
	const { locale } = useTranslation();
	const copy = useDictionary().billing.planPicker;

	return (
		<>
			<DialogHeader className="text-start">
				{badge ? <Badge variant="secondary">{badge}</Badge> : null}
				<span
					className={cn(
						"grid size-10 place-items-center rounded-xl border",
						tone === "success" &&
							"border-success/30 bg-success/10 text-success",
						tone === "warning" &&
							"border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
						tone === "error" &&
							"border-destructive/30 bg-destructive/10 text-destructive",
						tone === "neutral" && "border-border bg-muted text-foreground",
					)}
				>
					{tone === "success" ? (
						<Check className="size-5" aria-hidden />
					) : (
						<AlertTriangle className="size-5" aria-hidden />
					)}
				</span>
				<DialogTitle className="font-display tracking-tight">
					{title}
				</DialogTitle>
				<DialogDescription>{body}</DialogDescription>
			</DialogHeader>
			{requiredCredits !== undefined && availableCredits !== undefined ? (
				<div className="grid grid-cols-2 gap-3 rounded-xl border border-primary/25 bg-primary/[0.045] p-3">
					<RequirementMetric
						label={copy.requiredCredits}
						value={formatNumber(requiredCredits, locale)}
					/>
					<RequirementMetric
						label={copy.availableCredits}
						value={formatNumber(availableCredits, locale)}
					/>
				</div>
			) : null}
			{extra}
			{error ? <InlineError message={error} /> : null}
			<DialogFooter>{action}</DialogFooter>
		</>
	);
}

function PlanPickerSkeleton({
	requiredCredits,
	availableCredits,
}: {
	requiredCredits?: number;
	availableCredits?: number;
}) {
	const { locale } = useTranslation();
	const copy = useDictionary().billing.planPicker;

	return (
		<>
			<DialogHeader className="text-start">
				<DialogTitle className="font-display tracking-tight">
					{copy.loadingTitle}
				</DialogTitle>
				<DialogDescription>{copy.loadingBody}</DialogDescription>
			</DialogHeader>
			{requiredCredits !== undefined && availableCredits !== undefined ? (
				<div className="grid grid-cols-2 gap-3 rounded-xl border border-primary/25 bg-primary/[0.045] p-3">
					<RequirementMetric
						label={copy.requiredCredits}
						value={formatNumber(requiredCredits, locale)}
					/>
					<RequirementMetric
						label={copy.availableCredits}
						value={formatNumber(availableCredits, locale)}
					/>
				</div>
			) : null}
			<div className="grid gap-4" aria-hidden>
				<Skeleton className="h-10 w-full rounded-lg" />
				<Skeleton className="h-12 w-full rounded-lg" />
				<Skeleton className="h-24 w-full rounded-xl" />
			</div>
		</>
	);
}

function InlineError({ message }: { message: string }) {
	return (
		<p
			role="alert"
			className="rounded-lg border border-destructive/25 bg-destructive/[0.045] px-3 py-2 text-destructive text-sm"
		>
			{message}
		</p>
	);
}

function RequirementMetric({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="text-[10px] text-muted-foreground uppercase tracking-wider">
				{label}
			</p>
			<p className="mt-1 font-medium font-mono text-lg tabular-nums">{value}</p>
		</div>
	);
}

function TopupPackChoices({
	packs,
	isPending,
	onSelect,
}: {
	packs: readonly BillingTopupPack[];
	isPending: boolean;
	onSelect: (packId: BillingTopupPack["id"]) => void;
}) {
	const { locale, t } = useTranslation();
	const copy = useDictionary().billing.planPicker;

	return (
		<section className="grid gap-3 border-t pt-5">
			<div>
				<h3 className="font-medium text-sm">{copy.topupTitle}</h3>
				<p className="mt-1 text-muted-foreground text-xs">{copy.topupBody}</p>
			</div>
			<div className="grid gap-2 sm:grid-cols-3">
				{packs.map((pack) => (
					<Button
						key={pack.id}
						type="button"
						variant="outline"
						className="h-auto justify-between px-3 py-2.5 sm:flex-col sm:items-start"
						disabled={isPending}
						onClick={() => onSelect(pack.id)}
					>
						<span>{t("credits.creditUnit", { count: pack.credits })}</span>
						<span className="font-mono text-muted-foreground text-xs">
							{formatUsd(pack.usd, locale)}
						</span>
					</Button>
				))}
			</div>
		</section>
	);
}

function suggestedTierCredits(
	tiers: readonly BillingTierPrice[],
	subscription: Subscription | null,
): CreditTier {
	if (!subscription) return tiers[0]?.tierCredits ?? 100;

	return (
		tiers.find((tier) => tier.tierCredits > subscription.tierCredits)
			?.tierCredits ?? subscription.tierCredits
	);
}

function changeErrorMessage(
	error: unknown,
	copy: ReturnType<typeof useDictionary>["billing"]["planPicker"],
) {
	if (isApiClientError(error)) {
		if (error.code === "SUBSCRIPTION_CHANGE_PENDING") {
			return copy.changePendingError;
		}
		if (error.code === "BILLING_CHANGE_INTENT_EXPIRED") {
			return copy.previewExpiredError;
		}
		if (error.code === "BILLING_CHANGE_INTENT_INVALID") {
			return copy.previewInvalidError;
		}
	}

	return getApiErrorMessage(error);
}

function formatUsd(value: number, locale: Locale) {
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(value);
}

function formatMinorCurrency(value: number, currency: string, locale: Locale) {
	try {
		const formatter = new Intl.NumberFormat(locale, {
			style: "currency",
			currency: currency.toUpperCase(),
		});
		const fractionDigits =
			formatter.resolvedOptions().maximumFractionDigits ?? 2;

		return formatter.format(value / 10 ** fractionDigits);
	} catch {
		return `${currency.toUpperCase()} ${(value / 100).toFixed(2)}`;
	}
}

function signedNumber(value: number, locale: Locale) {
	const formatted = formatNumber(Math.abs(value), locale);
	return value >= 0 ? `+${formatted}` : `−${formatted}`;
}

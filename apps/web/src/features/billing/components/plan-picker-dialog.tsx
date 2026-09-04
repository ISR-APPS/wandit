import type {
	BillingInterval,
	BillingPlanCatalogItem,
	BillingPlanId,
	BillingSubscriptionChangeOutcomeResponse,
	BillingSubscriptionChangePreviewResponse,
	BillingTierPrice,
	BillingTopupPack,
	CreditTier,
	ProductEventSurface,
} from "@wandit/contracts";
import { isManualSubscription } from "@wandit/contracts";
import type { Locale } from "@wandit/internationalization";
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
import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@wandit/ui/components/tabs";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@wandit/ui/components/toggle-group";
import { cn } from "@wandit/ui/lib/utils";
import {
	AlertTriangle,
	ArrowLeft,
	Check,
	CreditCard,
	ExternalLink,
	HandCoins,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useSession } from "@/features/auth";
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
	getPendingSubscriptionChange,
	type PlanPickerPaymentMethod,
	resolvePlanPickerInterval,
	resolvePlanPickerPaymentMethod,
} from "@/features/billing/lib/billing-ui-policy";
import { completeCardCheckoutStart } from "@/features/billing/lib/checkout-product-events";
import {
	getBillingPlanCopy,
	getBillingPlanName,
} from "@/features/billing/lib/plan-copy";
import {
	formatUsd,
	isRenewalDowngrade,
} from "@/features/billing/lib/plan-pricing";
import {
	type PlanSelection,
	resolveSelectedTier,
} from "@/features/billing/lib/plan-selection";
import { CreditsElsewhereNotice } from "@/features/credits/components/credits-elsewhere-notice";
import {
	formatCreditAmount,
	formatCreditBalance,
} from "@/features/credits/lib/format-credits";
import {
	emitPricingViewed,
	getProductEventSessionState,
} from "@/features/product-events";
import { usePublicSettingsQuery } from "@/features/settings/api/settings.queries";
import { CreateWorkspaceDialog } from "@/features/workspaces/components/create-workspace-dialog";
import { useWorkspace } from "@/features/workspaces/lib/workspace-provider";
import { getApiErrorMessage, isApiClientError } from "@/lib/api-client";
import { useDictionary, useTranslation } from "@/lib/i18n";
import {
	ManualPaymentRequestPanel,
	type ManualPaymentSelection,
} from "./manual-payment-request-panel";
import { PlanCard } from "./plan-card";

export type PlanPickerDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialInterval?: BillingInterval;
	initialPlan?: BillingPlanId;
	initialTierCredits?: CreditTier;
	initialPaymentMethod?: PlanPickerPaymentMethod;
	requiredCredits?: number;
	availableCredits?: number;
	heldCredits?: number;
	surface: ProductEventSurface;
};

type PickerStep = "select" | "preview" | "outcome";
type ChangeKind = "upgrade" | "downgrade" | "keep";

type ChangeTarget = {
	interval: BillingInterval;
	plan: BillingPlanId;
	tierCredits: CreditTier;
};

const PERSONAL_PLAN_IDS = ["starter", "pro"] as const;
const ORGANIZATION_PLAN_IDS = ["business"] as const;

export function PlanPickerDialog({
	open,
	onOpenChange,
	initialInterval,
	initialPlan,
	initialTierCredits,
	initialPaymentMethod,
	requiredCredits,
	availableCredits,
	heldCredits,
	surface,
}: PlanPickerDialogProps) {
	const { t } = useTranslation();
	const { data: session, isPending: isSessionPending } = useSession();
	const sessionUserId = session?.user.id;
	const sessionState = getProductEventSessionState(
		isSessionPending,
		sessionUserId,
	);
	const [createTeamOpen, setCreateTeamOpen] = useState(false);
	const wasOpen = useRef(false);

	useEffect(() => {
		if (!open) {
			wasOpen.current = false;
			return;
		}

		if (wasOpen.current) {
			return;
		}

		wasOpen.current = true;
		emitPricingViewed("plan_picker", sessionState);
	}, [open, sessionState]);

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				{open ? (
					<DialogContent
						className="max-h-[min(820px,calc(100dvh-2rem))] overflow-y-auto sm:max-w-[720px]"
						closeLabel={t("common.close")}
					>
						{/* Credits-elsewhere hint above every purchase branch: switching
						    workspaces may beat buying, and switching closes the picker. */}
						<CreditsElsewhereNotice onSwitched={() => onOpenChange(false)} />
						<PlanPickerContent
							initialInterval={initialInterval}
							initialPlan={initialPlan}
							initialTierCredits={initialTierCredits}
							initialPaymentMethod={initialPaymentMethod}
							defaultFullName={session?.user.name ?? ""}
							surface={surface}
							onClose={() => onOpenChange(false)}
							onCreateTeam={() => {
								onOpenChange(false);
								setCreateTeamOpen(true);
							}}
							requiredCredits={requiredCredits}
							availableCredits={availableCredits}
							heldCredits={heldCredits}
						/>
					</DialogContent>
				) : null}
			</Dialog>
			<CreateWorkspaceDialog
				open={createTeamOpen}
				onOpenChange={setCreateTeamOpen}
			/>
		</>
	);
}

function PlanPickerContent({
	onClose,
	onCreateTeam,
	initialInterval,
	initialPlan,
	initialTierCredits,
	initialPaymentMethod,
	defaultFullName,
	requiredCredits,
	availableCredits,
	heldCredits,
	surface,
}: {
	onClose: () => void;
	onCreateTeam: () => void;
	initialInterval?: BillingInterval;
	initialPlan?: BillingPlanId;
	initialTierCredits?: CreditTier;
	initialPaymentMethod?: PlanPickerPaymentMethod;
	defaultFullName: string;
	requiredCredits?: number;
	availableCredits?: number;
	heldCredits?: number;
	surface: ProductEventSurface;
}) {
	const { locale, t } = useTranslation();
	const dictionary = useDictionary();
	const copy = dictionary.billing.planPicker;
	const { isPersonal } = useWorkspace();
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
	const [selectedPlanTiers, setSelectedPlanTiers] = useState<PlanSelection>(
		() =>
			initialPlan && initialTierCredits
				? { [initialPlan]: initialTierCredits }
				: {},
	);
	const [lastSelectedPlanId, setLastSelectedPlanId] =
		useState<BillingPlanId | null>(initialPlan ?? null);
	const [lastOfflineSelection, setLastOfflineSelection] =
		useState<ManualPaymentSelection | null>(null);
	const [businessTierCredits, setBusinessTierCredits] =
		useState<CreditTier | null>(null);
	const [selectedPaymentMethod, setSelectedPaymentMethod] =
		useState<PlanPickerPaymentMethod | null>(initialPaymentMethod ?? null);
	const [preview, setPreview] =
		useState<BillingSubscriptionChangePreviewResponse | null>(null);
	const [target, setTarget] = useState<ChangeTarget | null>(null);
	const [changeKind, setChangeKind] = useState<ChangeKind>("upgrade");
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
				heldCredits={heldCredits}
			/>
		);
	}

	if (plansQuery.isError || subscriptionQuery.isError) {
		return (
			<PickerNotice
				tone="error"
				title={copy.loadErrorTitle}
				body={copy.loadErrorBody}
				requiredCredits={requiredCredits}
				availableCredits={availableCredits}
				heldCredits={heldCredits}
				action={
					<Button type="button" variant="outline" onClick={onClose}>
						{copy.close}
					</Button>
				}
			/>
		);
	}

	const catalog = plansQuery.data;
	const subscriptionView = subscriptionQuery.data;

	if (!catalog || !subscriptionView) {
		return null;
	}

	// The server still enforces every billing switch at checkout. If the public
	// settings request fails, keep card checkout usable while hiding optional
	// organization, manual-payment, and top-up surfaces.
	const settings = settingsQuery.isError ? undefined : settingsQuery.data;
	const paidSubscriptionsEnabled = settings?.paidSubscriptionsEnabled ?? true;
	const topupsEnabled = settings?.topupsEnabled ?? false;
	const organizationsEnabled = settings?.organizationsEnabled ?? false;
	const manualPaymentsEnabled = settings?.manualPaymentsEnabled ?? false;

	const subscription = subscriptionView.subscription;
	const pendingChange = getPendingSubscriptionChange(subscription);
	const noticeAvailableCredits =
		availableCredits ?? subscriptionView.balance.settledBalance;
	const topupsAvailable = areTopupsAvailable(
		topupsEnabled,
		catalog.topupPacks.length,
	);
	const manualSubscription = isManualSubscription(subscription);
	const cardAvailable = paidSubscriptionsEnabled && !manualSubscription;
	const offlineAvailable = manualPaymentsEnabled;
	const paymentMethod = resolvePlanPickerPaymentMethod(
		selectedPaymentMethod,
		cardAvailable,
		offlineAvailable,
	);

	if (manualSubscription && !offlineAvailable) {
		return (
			<PickerNotice
				tone="neutral"
				title={copy.offline.managed.title}
				body={dictionary.errors.codes.MANUAL_PAYMENTS_DISABLED}
				requiredCredits={requiredCredits}
				availableCredits={noticeAvailableCredits}
				heldCredits={heldCredits}
				action={
					<Button type="button" onClick={onClose}>
						{copy.close}
					</Button>
				}
			/>
		);
	}

	if (!paidSubscriptionsEnabled && !offlineAvailable) {
		return (
			<PickerNotice
				tone="neutral"
				badge={copy.betaBadge}
				title={copy.betaTitle}
				body={copy.betaBody}
				requiredCredits={requiredCredits}
				availableCredits={noticeAvailableCredits}
				heldCredits={heldCredits}
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

	if (!paymentMethod) {
		return null;
	}

	if (
		paymentMethod === "card" &&
		!manualSubscription &&
		subscription?.cancelAtPeriodEnd
	) {
		return (
			<PickerNotice
				tone="warning"
				title={copy.resumeFirstTitle}
				body={copy.resumeFirstBody}
				requiredCredits={requiredCredits}
				availableCredits={noticeAvailableCredits}
				heldCredits={heldCredits}
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

	if (
		paymentMethod === "card" &&
		!manualSubscription &&
		subscription &&
		!subscription.entitled
	) {
		return (
			<PickerNotice
				tone="warning"
				title={copy.paymentAttentionTitle}
				body={copy.paymentAttentionBody}
				requiredCredits={requiredCredits}
				availableCredits={noticeAvailableCredits}
				heldCredits={heldCredits}
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

	if (
		step === "preview" &&
		preview &&
		target &&
		subscription &&
		!manualSubscription
	) {
		return (
			<ChangePreview
				preview={preview}
				target={target}
				changeKind={changeKind}
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
				changeKind={changeKind}
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

	const scopedPlanIds: readonly BillingPlanId[] = isPersonal
		? PERSONAL_PLAN_IDS
		: ORGANIZATION_PLAN_IDS;
	const scopedPlans = scopedPlanIds.flatMap((planId) => {
		const catalogPlan = catalog.plans.find((item) => item.id === planId);
		return catalogPlan && catalogPlan.tiers.length > 0 ? [catalogPlan] : [];
	});

	if (scopedPlans.length !== scopedPlanIds.length) {
		return (
			<PickerNotice
				tone="error"
				title={copy.loadErrorTitle}
				body={copy.catalogEmptyBody}
				requiredCredits={requiredCredits}
				availableCredits={noticeAvailableCredits}
				heldCredits={heldCredits}
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
	const visibleAvailableCredits =
		availableCredits ?? subscriptionView.balance.settledBalance;

	const handlePrimaryAction = (
		plan: BillingPlanCatalogItem,
		tier: BillingTierPrice,
	) => {
		setErrorMessage(null);
		setLastSelectedPlanId(plan.id);
		setSelectedPlanTiers((current) => ({
			...current,
			[plan.id]: tier.tierCredits,
		}));
		if (isManualSubscription(subscription)) {
			return;
		}

		if (!subscription) {
			void checkout
				.mutateAsync({
					plan: plan.id,
					tierCredits: tier.tierCredits,
					interval,
				})
				.then(({ url }) => completeCardCheckoutStart(url, surface))
				.catch((error) => setErrorMessage(getApiErrorMessage(error)));
			return;
		}

		const nextTarget = {
			interval,
			plan: plan.id,
			tierCredits: tier.tierCredits,
		};
		void previewChange
			.mutateAsync(nextTarget)
			.then((result) => {
				setTarget(nextTarget);
				setChangeKind(
					pendingChange &&
						nextTarget.plan === subscription.plan &&
						nextTarget.tierCredits === subscription.tierCredits &&
						nextTarget.interval === subscription.interval
						? "keep"
						: isRenewalDowngrade(subscription, nextTarget)
							? "downgrade"
							: "upgrade",
				);
				setPreview(result);
				setStep("preview");
			})
			.catch((error) => {
				setErrorMessage(changeErrorMessage(error, copy));
			});
	};

	// Business remains a create-team teaser in personal scope. Organization
	// scope renders Business as its only purchasable plan.
	const businessPlan = catalog.plans.find((item) => item.id === "business");
	const showBusinessTeaser =
		isPersonal &&
		organizationsEnabled &&
		businessPlan !== undefined &&
		businessPlan.tiers.length > 0;
	const businessTier = businessPlan
		? (businessPlan.tiers.find(
				(item) => item.tierCredits === businessTierCredits,
			) ?? businessPlan.tiers[0])
		: undefined;
	const cardPanel = (
		<div className="flex flex-col gap-4">
			<div className="grid gap-2">
				<span className="font-medium text-sm">{copy.billingCycle}</span>
				<ToggleGroup
					type="single"
					value={interval}
					variant="outline"
					spacing={0}
					className="w-full"
					aria-label={copy.billingCycle}
					onValueChange={(value) => {
						if (value === "month" || value === "year") {
							setSelectedInterval(value);
						}
					}}
				>
					{subscription?.interval !== "year" ? (
						<ToggleGroupItem value="month" className="flex-1">
							{copy.monthly}
						</ToggleGroupItem>
					) : null}
					<ToggleGroupItem value="year" className="flex-1 gap-2">
						{copy.yearly}
						<Badge variant="secondary" className="px-1.5 font-mono text-[9px]">
							{copy.twoMonthsFree}
						</Badge>
					</ToggleGroupItem>
				</ToggleGroup>
				{subscription?.interval === "year" ? (
					<p className="text-muted-foreground text-xs">
						{copy.yearlyToMonthlyUnavailable}
					</p>
				) : null}
			</div>

			<div className={cn("grid gap-4", isPersonal && "sm:grid-cols-2")}>
				{scopedPlans.map((plan) => {
					const planCopy = getBillingPlanCopy(plan.id, copy);
					const tier = resolveSelectedTier(
						plan,
						selectedPlanTiers,
						subscription,
					);

					if (!tier) return null;

					const sameAsCurrent =
						subscription?.plan === plan.id &&
						subscription.interval === interval &&
						subscription.tierCredits === tier.tierCredits &&
						pendingChange === null;

					return (
						<PlanCard
							key={plan.id}
							name={planCopy.name}
							badge={plan.id === "pro" ? copy.popularBadge : undefined}
							tagline={planCopy.tagline}
							tier={tier}
							tiers={plan.tiers}
							basePer100Usd={plan.basePer100Usd}
							interval={interval}
							perLabel={interval === "year" ? copy.perYear : copy.perMonth}
							selectId={`billing-tier-${plan.id}`}
							selectLabel={copy.creditTier}
							onSelectTier={(tierCredits) => {
								setLastSelectedPlanId(plan.id);
								setSelectedPlanTiers((current) => ({
									...current,
									[plan.id]: tierCredits,
								}));
							}}
							features={planCopy.features}
							highlighted={plan.id === "pro" || !isPersonal}
							action={
								<Button
									type="button"
									className="mt-4 w-full"
									disabled={
										sameAsCurrent ||
										checkout.isPending ||
										previewChange.isPending
									}
									onClick={() => handlePrimaryAction(plan, tier)}
								>
									{sameAsCurrent
										? copy.currentSelection
										: checkout.isPending || previewChange.isPending
											? copy.preparing
											: subscription
												? copy.previewChange
												: copy.continueToCheckout}
								</Button>
							}
						/>
					);
				})}
			</div>

			{showBusinessTeaser && businessPlan && businessTier ? (
				<PlanCard
					name={getBillingPlanCopy(businessPlan.id, copy).name}
					tagline={getBillingPlanCopy(businessPlan.id, copy).tagline}
					tier={businessTier}
					tiers={businessPlan.tiers}
					basePer100Usd={businessPlan.basePer100Usd}
					interval={interval}
					perLabel={interval === "year" ? copy.perYear : copy.perMonth}
					selectId="billing-tier-business"
					selectLabel={copy.creditTier}
					onSelectTier={setBusinessTierCredits}
					features={getBillingPlanCopy(businessPlan.id, copy).features}
					featureColumns={2}
					action={
						<Button
							type="button"
							variant="outline"
							className="mt-4 w-full"
							onClick={onCreateTeam}
						>
							{copy.continueToCheckout}
						</Button>
					}
				/>
			) : null}

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
			</DialogFooter>
		</div>
	);
	const offlinePlanId =
		lastOfflineSelection?.planId ??
		lastSelectedPlanId ??
		initialPlan ??
		subscription?.plan;
	const offlinePanel = (
		<ManualPaymentRequestPanel
			plans={scopedPlans}
			subscription={subscription}
			defaultFullName={defaultFullName}
			initialInterval={
				lastOfflineSelection?.interval ?? selectedInterval ?? initialInterval
			}
			initialPlan={offlinePlanId}
			initialTierCredits={
				lastOfflineSelection?.tierCredits ??
				(offlinePlanId ? selectedPlanTiers[offlinePlanId] : undefined) ??
				initialTierCredits
			}
			onClose={onClose}
			onSelectionChange={(nextSelection) => {
				setLastOfflineSelection(nextSelection);
				setLastSelectedPlanId(nextSelection.planId);
				setSelectedInterval(nextSelection.interval);
				setSelectedPlanTiers((current) => ({
					...current,
					[nextSelection.planId]: nextSelection.tierCredits,
				}));
			}}
			surface={surface}
		/>
	);
	const showPaymentTabs = cardAvailable && offlineAvailable;

	return (
		<>
			<DialogHeader className="text-start">
				<div className="flex flex-wrap items-center gap-2">
					<DialogTitle className="font-display tracking-tight">
						{paymentMethod === "offline"
							? copy.offline.title
							: subscription
								? copy.changeTitle
								: copy.chooseTitle}
					</DialogTitle>
					{subscription ? (
						<Badge variant="outline">
							{copy.currentPlan}: {getBillingPlanName(subscription.plan, copy)}{" "}
							·{" "}
							{t("credits.creditUnit", {
								count: subscription.tierCredits,
							})}
						</Badge>
					) : null}
					{pendingChange ? (
						<Badge variant="warning">
							{copy.changesAtRenewal}:{" "}
							{getBillingPlanName(pendingChange.plan, copy)}
							{" · "}
							{t("credits.creditUnit", { count: pendingChange.tierCredits })}
							{" · "}
							{pendingChange.interval === "year" ? copy.yearly : copy.monthly}
						</Badge>
					) : null}
				</div>
				<DialogDescription>
					{paymentMethod === "offline"
						? copy.offline.description
						: subscription
							? copy.changeDescription
							: copy.chooseDescription}
				</DialogDescription>
			</DialogHeader>

			{requiredCredits !== undefined ? (
				<div className="grid grid-cols-2 gap-3 rounded-xl border border-primary/25 bg-primary/[0.045] p-3">
					<RequirementMetric
						label={copy.requiredCredits}
						value={formatCreditAmount(requiredCredits, locale)}
					/>
					<RequirementMetric
						label={copy.availableCredits}
						value={formatCreditBalance(
							clampDisplayedCredits(visibleAvailableCredits),
							locale,
						)}
					/>
					{heldCredits !== undefined && heldCredits > 0 ? (
						<RequirementMetric
							className="col-span-2"
							label={copy.heldCredits}
							value={formatCreditAmount(heldCredits, locale)}
						/>
					) : null}
				</div>
			) : null}

			{showPaymentTabs ? (
				<Tabs
					value={paymentMethod}
					onValueChange={(value) => {
						if (value === "card" || value === "offline") {
							setSelectedPaymentMethod(value);
						}
					}}
				>
					<TabsList className="w-full" aria-label={copy.offline.tabs.ariaLabel}>
						<TabsTrigger value="card" className="flex-1">
							<CreditCard aria-hidden />
							{copy.offline.tabs.card}
						</TabsTrigger>
						<TabsTrigger value="offline" className="flex-1">
							<HandCoins aria-hidden />
							{copy.offline.tabs.offline}
						</TabsTrigger>
					</TabsList>
					<TabsContent value="card">{cardPanel}</TabsContent>
					<TabsContent
						value="offline"
						forceMount
						className="data-[state=inactive]:hidden"
					>
						{offlinePanel}
					</TabsContent>
				</Tabs>
			) : paymentMethod === "offline" ? (
				<>
					{offlinePanel}
					{/* Manual subscribers can still buy Stripe top-up packs (the
					    top-up switch is independent of subscription checkout), and
					    only the card panel used to render them (review finding). */}
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
				</>
			) : (
				cardPanel
			)}
		</>
	);
}

function ChangePreview({
	preview,
	target,
	changeKind,
	isPending,
	errorMessage,
	onBack,
	onConfirm,
}: {
	preview: BillingSubscriptionChangePreviewResponse;
	target: ChangeTarget;
	changeKind: ChangeKind;
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
							{getBillingPlanName(target.plan, copy)} ·{" "}
							{t("credits.creditUnit", { count: target.tierCredits })} ·{" "}
							{target.interval === "year" ? copy.yearly : copy.monthly}
						</p>
					</div>
					<CreditCard className="size-5 text-ember-text" aria-hidden />
				</div>
				<div className="mt-5 border-t pt-4">
					{changeKind === "keep" ? (
						<p className="text-muted-foreground text-sm">
							{copy.keepCurrentPlanExplanation}
						</p>
					) : changeKind === "downgrade" ? (
						<>
							<Badge variant="warning">{copy.changesAtRenewal}</Badge>
							<p className="mt-2 text-muted-foreground text-sm">
								{copy.downgradeExplanation}
							</p>
						</>
					) : (
						<>
							<p className="font-medium text-base">
								{t("billing.planPicker.payNowCredits", {
									amount,
									credits: signedNumber(preview.creditsDelta, locale),
								})}
							</p>
							<p className="mt-2 text-muted-foreground text-sm">
								{copy.upgradeExplanation}
							</p>
						</>
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
	changeKind,
	onClose,
	onTryAgain,
}: {
	outcome: BillingSubscriptionChangeOutcomeResponse;
	changeKind: ChangeKind;
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

	return (
		<PickerNotice
			tone="success"
			title={copy.changeAppliedTitle}
			body={
				changeKind === "keep"
					? copy.keepCurrentPlanAppliedBody
					: changeKind === "downgrade"
						? copy.downgradeAppliedBody
						: copy.changeAppliedBody
			}
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
	heldCredits,
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
	heldCredits?: number;
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
						value={formatCreditAmount(requiredCredits, locale)}
					/>
					<RequirementMetric
						label={copy.availableCredits}
						value={formatCreditBalance(
							clampDisplayedCredits(availableCredits),
							locale,
						)}
					/>
					{heldCredits !== undefined && heldCredits > 0 ? (
						<RequirementMetric
							className="col-span-2"
							label={copy.heldCredits}
							value={formatCreditAmount(heldCredits, locale)}
						/>
					) : null}
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
	heldCredits,
}: {
	requiredCredits?: number;
	availableCredits?: number;
	heldCredits?: number;
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
						value={formatCreditAmount(requiredCredits, locale)}
					/>
					<RequirementMetric
						label={copy.availableCredits}
						value={formatCreditBalance(
							clampDisplayedCredits(availableCredits),
							locale,
						)}
					/>
					{heldCredits !== undefined && heldCredits > 0 ? (
						<RequirementMetric
							className="col-span-2"
							label={copy.heldCredits}
							value={formatCreditAmount(heldCredits, locale)}
						/>
					) : null}
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

function RequirementMetric({
	label,
	value,
	className,
}: {
	label: string;
	value: string;
	className?: string;
}) {
	return (
		<div className={className}>
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

// availableCredits is the settled balance under the current 402 contract, but
// an old server or a cached error can still deliver the raw hold-dipped value.
// The paywall never prints a negative the user's header has never shown.
function clampDisplayedCredits(value: number): number {
	return Math.max(0, value);
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
	// creditsDelta is decimal under pricing v4 — exact trimmed rendering.
	const formatted = formatCreditAmount(Math.abs(value), locale);
	return value >= 0 ? `+${formatted}` : `−${formatted}`;
}

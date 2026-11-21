/**
 * The top-up dialog: one amount in whole USD, its receipt, then a payment tab (card, CIB / Edahabia, or cash / transfer).
 * While the wallet says `starterPassRequired`, it sells only the Starter pass: a fixed price, card and CIB / Edahabia only.
 * BillingModalProvider mounts it once for the whole app. It names the wallet that gets the credits.
 * Reads the wallet, the public settings, and the DZD rate. The card tab calls useCreateBillingTopupCheckout.
 * The credits on screen come from topupQuoteForUsd only. The server grants the same quote.
 */
import {
	type CreateBillingTopupBody,
	type ProductEventSurface,
	STARTER_PASS_USD,
	smallestTopupCovering,
	topupQuoteForUsd,
} from "@wandit/contracts";
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
import { CreditCard, HandCoins } from "lucide-react";
import { useState } from "react";

import { useSession } from "@/features/auth";
import { useCreateBillingTopupCheckout } from "@/features/billing/api/billing.mutations";
import {
	useBillingWalletQuery,
	useDzdPerUsdRate,
} from "@/features/billing/api/billing.queries";
import { completeCardCheckoutStart } from "@/features/billing/lib/checkout-product-events";
import {
	formatLocalPrice,
	formatUsd,
} from "@/features/billing/lib/price-format";
import { usePurchasesEnabled } from "@/features/billing/lib/purchases";
import { TOPUP_DEFAULT_AMOUNT_USD } from "@/features/billing/lib/topup-amount";
import {
	CreditsElsewhereNotice,
	formatCreditAmount,
	formatCreditBalance,
} from "@/features/credits";
import { KeycapButton } from "@/features/landing";
import { usePublicSettingsQuery } from "@/features/settings";
import { useWorkspace } from "@/features/workspaces";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatNumber, useDictionary, useTranslation } from "@/lib/i18n";
import { ManualPaymentRequestPanel } from "./manual-payment-request-panel";
import { SlickpayCheckoutPanel } from "./slickpay-checkout-panel";
import { StarterPassSummary } from "./starter-pass-card";
import { TopupAmountPicker } from "./topup-amount-picker";
import { TopupReceipt } from "./topup-receipt";

/** Payment tabs. The `upgrade_clicked` product event uses the same values as its `method`. */
type TopupPaymentMethod = "card" | "slickpay" | "offline";

// Card comes first: Stripe checkout works for every visitor.
const PAYMENT_METHOD_ORDER = ["card", "slickpay", "offline"] as const;

type TopupDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Screen that opened the dialog. It goes to the `upgrade_clicked` product event. */
	surface: ProductEventSurface;
	/** Whole USD to select at open. Undefined selects the amount that covers the 402 shortfall, else 20 USD. */
	initialAmountUsd?: number;
	/** Decimal credits that the refused action needs, from a 402 answer. Undefined when a button opened the dialog. */
	requiredCredits?: number;
	/** Decimal settled credits of the wallet, from the same 402 answer. */
	availableCredits?: number;
	/** Decimal credits that running generations hold, from the same 402 answer. */
	heldCredits?: number;
	/**
	 * True when a 402 said `starter_pass_required` for a pool that the viewer cannot pay for (canBuyForPayer is false).
	 * The dialog then only tells the viewer to ask the owner.
	 */
	askOwnerForStarterPass?: boolean;
};

/** Mounted once by BillingModalProvider. The body remounts on each open, so the amount and the forms start empty. */
export function TopupDialog({
	open,
	onOpenChange,
	...bodyProps
}: TopupDialogProps) {
	const { t } = useTranslation();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{open ? (
				<DialogContent
					className="max-h-[min(860px,calc(100dvh-2rem))] overflow-y-auto sm:max-w-[560px]"
					overlayClassName="bg-night/50"
					closeLabel={t("common.close")}
				>
					<CreditsElsewhereNotice onSwitched={() => onOpenChange(false)} />
					<TopupDialogBody {...bodyProps} onClose={() => onOpenChange(false)} />
				</DialogContent>
			) : null}
		</Dialog>
	);
}

function TopupDialogBody({
	surface,
	initialAmountUsd,
	requiredCredits,
	availableCredits,
	heldCredits,
	askOwnerForStarterPass = false,
	onClose,
}: Omit<TopupDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
	const { locale, t } = useTranslation();
	const dictionary = useDictionary();
	const copy = dictionary.billing.topup;
	const starterCopy = dictionary.billing.starterPass;
	const { activeWorkspace, actorCanManageBilling, isPersonal } = useWorkspace();
	const { data: session } = useSession();
	const walletQuery = useBillingWalletQuery();
	const settingsQuery = usePublicSettingsQuery();
	const dzdPerUsdRate = useDzdPerUsdRate();
	const purchasesEnabled = usePurchasesEnabled();
	const topup = useCreateBillingTopupCheckout();
	// Decimal credits that the refused action misses: running generations hold part of the settled balance.
	// A negative balance (accepted overage) adds to the shortfall. The default amount covers it.
	const shortfallCredits =
		requiredCredits !== undefined && availableCredits !== undefined
			? requiredCredits - (availableCredits - (heldCredits ?? 0))
			: null;
	// Null while the typed text is not a valid amount. The picker then shows the error.
	const [amountUsd, setAmountUsd] = useState<number | null>(
		initialAmountUsd ??
			(shortfallCredits === null
				? TOPUP_DEFAULT_AMOUNT_USD
				: smallestTopupCovering(shortfallCredits)),
	);
	const [selectedMethod, setSelectedMethod] =
		useState<TopupPaymentMethod | null>(null);
	const [cardError, setCardError] = useState<string | null>(null);

	// A purchase credits the active workspace, so the dialog names it. A member cannot fund a team wallet.
	const walletText = isPersonal
		? copy.personalWallet
		: t("billing.topup.teamWallet", { name: activeWorkspace?.name ?? "" });

	// The pool must buy the Starter pass first. A wallet from an older API has no flag: the normal top-up shows.
	const starterMode = walletQuery.data?.starterPassRequired === true;

	const header = (
		<DialogHeader>
			<DialogTitle className="font-bold font-grotesk text-xl tracking-[-0.03em]">
				{starterMode ? starterCopy.dialogTitle : copy.title}
			</DialogTitle>
			<DialogDescription>{walletText}</DialogDescription>
		</DialogHeader>
	);

	// Only the owner of the pool can buy its pass. The viewer must ask the owner.
	if (askOwnerForStarterPass || (!actorCanManageBilling && starterMode)) {
		return (
			<DialogHeader>
				<DialogTitle className="font-bold font-grotesk text-xl tracking-[-0.03em]">
					{starterCopy.dialogTitle}
				</DialogTitle>
				<DialogDescription>{starterCopy.askOwner}</DialogDescription>
			</DialogHeader>
		);
	}

	if (!actorCanManageBilling) {
		return (
			<>
				{header}
				<p className="text-muted-foreground text-sm">
					{t("workspaces.billing.ownerOnlyBody")}
				</p>
			</>
		);
	}

	const loading = (
		<>
			{header}
			<div className="grid gap-3" aria-hidden>
				<Skeleton className="h-24 w-full rounded-2xl" />
				<Skeleton className="h-48 w-full rounded-2xl" />
			</div>
		</>
	);

	if (walletQuery.isPending || settingsQuery.isPending) {
		return loading;
	}

	if (walletQuery.isError || settingsQuery.isError) {
		return (
			<>
				{header}
				<DialogNotice title={copy.loadErrorTitle} body={copy.loadErrorBody}>
					<Button type="button" variant="outline" onClick={onClose}>
						{copy.close}
					</Button>
				</DialogNotice>
			</>
		);
	}

	const limits = walletQuery.data.topup;
	const available: Record<TopupPaymentMethod, boolean> = {
		card: limits.enabled,
		// The API sends a DZD rate only when it has a SlickPay key, so the rate means "SlickPay is on".
		slickpay: dzdPerUsdRate !== null,
		// Cash on delivery never buys the Starter pass (founder rule). The API offline body also needs 10 USD or more.
		offline: !starterMode && settingsQuery.data.manualPaymentsEnabled,
	};
	const method =
		selectedMethod && available[selectedMethod]
			? selectedMethod
			: (PAYMENT_METHOD_ORDER.find((item) => available[item]) ?? null);

	const picker = (
		<TopupAmountPicker
			amountUsd={amountUsd}
			onAmountUsdChange={setAmountUsd}
			minAmountUsd={limits.minAmountUsd}
			maxAmountUsd={limits.maxAmountUsd}
			presetAmountsUsd={limits.presetAmountsUsd}
			tone="paper"
			layout="compact"
			disabled={method === null}
		/>
	);
	const receipt = (
		<TopupReceipt
			amountUsd={amountUsd}
			tone="paper"
			size="compact"
			localPriceLabel={
				amountUsd !== null && dzdPerUsdRate !== null
					? formatLocalPrice(amountUsd, locale, dzdPerUsdRate)
					: undefined
			}
			onAmountUsdChange={setAmountUsd}
		/>
	);

	// SlickPay can still turn on while the local pricing loads. Do not say "open soon" before it settles.
	if (method === null && purchasesEnabled === undefined) {
		return loading;
	}

	// No method sells the pass: the API refuses cash for it, so the dialog shows only the price.
	if (starterMode && method === null) {
		return (
			<>
				{header}
				<StarterPassSummary
					promoCredits={walletQuery.data.balance.settledPromo}
				/>
				<DialogNotice
					title={starterCopy.unavailableTitle}
					body={starterCopy.unavailableBody}
				>
					<Button type="button" variant="outline" onClick={onClose}>
						{copy.close}
					</Button>
				</DialogNotice>
			</>
		);
	}

	// No method is on: the user still sees the prices, but cannot pay yet.
	if (method === null) {
		return (
			<>
				{header}
				{picker}
				{receipt}
				<DialogNotice title={copy.openSoon} body={copy.pausedBody}>
					<Button type="button" variant="outline" onClick={onClose}>
						{copy.close}
					</Button>
				</DialogNotice>
			</>
		);
	}

	// The browser leaves for Stripe after a success, so the button stays locked until navigation.
	const isRedirecting = topup.isPending || topup.isSuccess;
	const defaultFullName = session?.user.name ?? "";

	// The Starter pass has a fixed price. The picker and the receipt do not show in that mode.
	const payAmountUsd = starterMode ? STARTER_PASS_USD : amountUsd;

	const payByCard = () => {
		if (payAmountUsd === null || isRedirecting) {
			return;
		}
		setCardError(null);
		// The Starter pass is below the top-up minimum, so it has its own body. The API charges STARTER_PASS_USD.
		const body: CreateBillingTopupBody = starterMode
			? { starterPass: true }
			: { amountUsd: payAmountUsd };
		void topup
			.mutateAsync(body)
			.then(({ url }) => completeCardCheckoutStart(url, surface))
			.catch((error) => setCardError(getApiErrorMessage(error)));
	};

	const creditsText = (credits: number) =>
		t("credits.creditUnit", {
			count: credits,
			countDisplay: formatNumber(credits, locale),
		});

	return (
		<>
			{header}

			{/* In the Starter pass mode the pool can have credits. The shortfall numbers would not explain the refusal. */}
			{!starterMode &&
			requiredCredits !== undefined &&
			availableCredits !== undefined ? (
				<div className="grid grid-cols-2 gap-3 rounded-2xl bg-ember/[0.06] p-3.5 ring-1 ring-ember/25">
					{/* An old server or a cached 402 can give no shortfall. The metrics below then stand alone. */}
					{shortfallCredits !== null && shortfallCredits > 0 ? (
						<p className="col-span-2 font-grotesk font-semibold text-sm">
							{t("billing.topup.shortfall", {
								credits: t("credits.creditUnit", {
									count: shortfallCredits,
									countDisplay: formatCreditAmount(shortfallCredits, locale),
								}),
								amount: formatUsd(
									smallestTopupCovering(shortfallCredits),
									locale,
								),
							})}
						</p>
					) : null}
					<RequirementMetric
						label={copy.requiredCredits}
						value={formatCreditAmount(requiredCredits, locale)}
					/>
					{/* An old server or a cached 402 can send a value below zero. The dialog never prints it. */}
					<RequirementMetric
						label={copy.availableCredits}
						value={formatCreditBalance(Math.max(0, availableCredits), locale)}
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

			{starterMode ? (
				<StarterPassSummary
					promoCredits={walletQuery.data.balance.settledPromo}
				/>
			) : (
				<>
					{picker}
					{receipt}
				</>
			)}

			<Tabs
				value={method}
				onValueChange={(value) => {
					if (value === "card" || value === "slickpay" || value === "offline") {
						setSelectedMethod(value);
					}
				}}
			>
				<TabsList className="w-full" aria-label={copy.methodsLabel}>
					{available.card ? (
						<TabsTrigger value="card" className="flex-1">
							<CreditCard aria-hidden />
							{copy.methods.card}
						</TabsTrigger>
					) : null}
					{available.slickpay ? (
						<TabsTrigger value="slickpay" className="flex-1">
							<CreditCard aria-hidden />
							{copy.methods.slickpay}
						</TabsTrigger>
					) : null}
					{available.offline ? (
						<TabsTrigger value="offline" className="flex-1">
							<HandCoins aria-hidden />
							{copy.methods.offline}
						</TabsTrigger>
					) : null}
				</TabsList>
				{available.card ? (
					<TabsContent value="card" className="flex flex-col gap-4 pt-2">
						<p className="text-muted-foreground text-sm">
							{copy.card.description}
						</p>
						{cardError ? (
							<p
								role="alert"
								className="rounded-lg border border-destructive/25 bg-destructive/[0.045] px-3 py-2 text-destructive text-sm"
							>
								{cardError}
							</p>
						) : null}
						<DialogFooter>
							{/* Stripe charges US dollars, so the card button names only the USD price. */}
							<KeycapButton
								type="button"
								size="md"
								className="focus-visible:outline-ember"
								disabled={payAmountUsd === null || isRedirecting}
								onClick={payByCard}
							>
								<CreditCard aria-hidden className="size-4" />
								{isRedirecting
									? copy.card.redirecting
									: payAmountUsd === null
										? t("billing.page.topup")
										: t("billing.topup.payAction", {
												amount: formatUsd(payAmountUsd, locale),
												credits: creditsText(
													topupQuoteForUsd(payAmountUsd).credits,
												),
											})}
							</KeycapButton>
						</DialogFooter>
						{/* The DZD price is an estimate at the live rate. The line says that Stripe charges USD. */}
						{payAmountUsd !== null && dzdPerUsdRate !== null ? (
							<p className="text-end text-muted-foreground text-xs">
								<bdi>
									{t("billing.topup.card.dzdEstimate", {
										amount: formatLocalPrice(
											payAmountUsd,
											locale,
											dzdPerUsdRate,
										),
									})}
								</bdi>
							</p>
						) : null}
					</TabsContent>
				) : null}
				{/* forceMount keeps the typed SlickPay and offline forms when the user switches tabs. */}
				{dzdPerUsdRate !== null ? (
					<TabsContent
						value="slickpay"
						forceMount
						className="pt-2 data-[state=inactive]:hidden"
					>
						<SlickpayCheckoutPanel
							amountUsd={payAmountUsd}
							starterPass={starterMode}
							dzdPerUsdRate={dzdPerUsdRate}
							defaultFullName={defaultFullName}
							surface={surface}
						/>
					</TabsContent>
				) : null}
				{available.offline ? (
					<TabsContent
						value="offline"
						forceMount
						className="pt-2 data-[state=inactive]:hidden"
					>
						<ManualPaymentRequestPanel
							amountUsd={amountUsd}
							defaultFullName={defaultFullName}
							dzdPerUsdRate={dzdPerUsdRate}
							onClose={onClose}
							surface={surface}
						/>
					</TabsContent>
				) : null}
			</Tabs>
		</>
	);
}

function DialogNotice({
	title,
	body,
	children,
}: {
	title: string;
	body: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-4 rounded-2xl border bg-card/70 p-5">
			<div>
				<h3 className="font-bold font-grotesk text-lg tracking-[-0.02em]">
					{title}
				</h3>
				<p className="mt-2 text-muted-foreground text-sm">{body}</p>
			</div>
			<DialogFooter>{children}</DialogFooter>
		</div>
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

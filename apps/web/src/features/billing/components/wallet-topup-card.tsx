/**
 * Top-up card of the wallet page: the Spark Meter, a compact receipt, and the keycap that opens the top-up dialog.
 * pages/billing-page.tsx renders it for a billing manager. It reads the wallet limits and the payment history.
 * The dialog opens with the chosen amount through useBillingModal().openTopup.
 */
import { CoinsIcon } from "@phosphor-icons/react/Coins";
import {
	type BillingWalletResponse,
	topupQuoteForUsd,
} from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";
import { useState } from "react";

import { useBillingPaymentsQuery } from "@/features/billing/api/billing.queries";
import { useBillingModal } from "@/features/billing/components/billing-modal-provider";
import { formatUsd } from "@/features/billing/lib/price-format";
import { usePurchasesEnabled } from "@/features/billing/lib/purchases";
import { TOPUP_DEFAULT_AMOUNT_USD } from "@/features/billing/lib/topup-amount";
import { KeycapButton } from "@/features/landing";
import { formatNumber, useDictionary, useTranslation } from "@/lib/i18n";
import { TopupAmountPicker } from "./topup-amount-picker";
import { TopupReceipt } from "./topup-receipt";

type WalletTopupCardProps = {
	/** Wallet of the active workspace, from useBillingWalletQuery. The card reads the `topup` limits. */
	wallet: BillingWalletResponse;
	/** The white card frame of the wallet page (ring, radius, shadow). */
	className?: string;
};

/** The amount starts at the last payment the user made, so a repeat top-up is one click. */
export function WalletTopupCard({ wallet, className }: WalletTopupCardProps) {
	const { locale, t } = useTranslation();
	const copy = useDictionary().billing.page;
	const { openTopup } = useBillingModal();
	const purchasesEnabled = usePurchasesEnabled();
	const paymentsQuery = useBillingPaymentsQuery();
	const limits = wallet.topup;
	// Null until the user picks or types. Inside, `amountUsd` is null while the typed text is not valid.
	const [picked, setPicked] = useState<{ amountUsd: number | null } | null>(
		null,
	);

	// The newest payment with a whole USD value inside the limits. A receipt from before pricing v8 has no value.
	const lastPaymentUsd = paymentsQuery.data?.items
		.map((payment) =>
			payment.amountUsdCents === null ? null : payment.amountUsdCents / 100,
		)
		.find(
			(usd) =>
				usd !== null &&
				Number.isInteger(usd) &&
				usd >= limits.minAmountUsd &&
				usd <= limits.maxAmountUsd,
		);
	const amountUsd = picked
		? picked.amountUsd
		: (lastPaymentUsd ?? TOPUP_DEFAULT_AMOUNT_USD);
	const quote = amountUsd === null ? null : topupQuoteForUsd(amountUsd);
	const changeAmount = (nextAmountUsd: number | null) =>
		setPicked({ amountUsd: nextAmountUsd });
	// Only an explicit false locks the card: a slow settings fetch never strips the action.
	const isLocked = purchasesEnabled === false;

	return (
		<section className={cn("flex flex-col p-5 sm:p-6", className)}>
			<div className="flex items-start gap-3">
				<span
					aria-hidden
					className="grid size-10 shrink-0 place-items-center rounded-xl bg-spark/25 text-night dark:bg-spark/20 dark:text-spark"
				>
					<CoinsIcon weight="duotone" className="size-5" />
				</span>
				<div className="min-w-0">
					<h3 className="font-grotesk font-semibold text-[15px] text-night tracking-[-0.01em] dark:text-foreground">
						{copy.topupCard.title}
					</h3>
					<p className="mt-0.5 text-night/60 text-sm dark:text-foreground/60">
						{copy.topupCard.description}
					</p>
				</div>
			</div>

			<div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-start">
				<TopupAmountPicker
					amountUsd={amountUsd}
					onAmountUsdChange={changeAmount}
					minAmountUsd={limits.minAmountUsd}
					maxAmountUsd={limits.maxAmountUsd}
					presetAmountsUsd={limits.presetAmountsUsd}
					tone="paper"
					layout="meter"
					disabled={isLocked}
				/>
				<TopupReceipt
					amountUsd={amountUsd}
					tone="paper"
					size="compact"
					onAmountUsdChange={changeAmount}
				/>
			</div>

			{/* mt-auto keeps the action at the card bottom when the balance card is taller. */}
			<div className="mt-auto pt-6">
				{isLocked ? (
					<p className="text-night/60 text-sm dark:text-foreground/60">
						{copy.purchasesPaused}
					</p>
				) : (
					<KeycapButton
						type="button"
						size="md"
						className="w-full focus-visible:outline-ember sm:w-auto"
						disabled={amountUsd === null}
						onClick={() => {
							if (amountUsd !== null) {
								openTopup("billing_page", amountUsd);
							}
						}}
					>
						{quote === null ? (
							copy.topup
						) : (
							<bdi>
								{t("billing.page.continue", {
									amount: formatUsd(quote.amountUsd, locale),
									credits: t("credits.creditUnit", {
										count: quote.credits,
										countDisplay: formatNumber(quote.credits, locale),
									}),
								})}
							</bdi>
						)}
					</KeycapButton>
				)}
			</div>
		</section>
	);
}

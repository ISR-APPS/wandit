/**
 * The Starter pass offer: one payment of STARTER_PASS_USD (card or CIB / Edahabia) unlocks the credits of a pool.
 * StarterPassSummary is the price and the why. The top-up dialog renders it in its Starter pass mode.
 * StarterPassCard is the /billing card. Its keycap calls `onGetPass`, which opens the dialog.
 * The card gets the action as a prop: billing-modal-provider.tsx imports this file through the dialog.
 */
import { CoinsIcon } from "@phosphor-icons/react/Coins";
import { STARTER_PASS_USD, topupQuoteForUsd } from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";

import { useDzdPerUsdRate } from "@/features/billing/api/billing.queries";
import { formatUsdAndDzd } from "@/features/billing/lib/price-format";
import { usePurchasesEnabled } from "@/features/billing/lib/purchases";
import { KeycapButton } from "@/features/landing";
import { formatNumber, useDictionary, useTranslation } from "@/lib/i18n";

type StarterPassSummaryProps = {
	/** Decimal settled promo credits of the pool, from the wallet balance. Above 0 adds "your welcome credits unlock too". */
	promoCredits: number;
};

/** The price in USD and DZD, why Wandit asks for it, and the credits it gives. */
export function StarterPassSummary({ promoCredits }: StarterPassSummaryProps) {
	const { locale, t } = useTranslation();
	const copy = useDictionary().billing.starterPass;
	const dzdPerUsdRate = useDzdPerUsdRate();
	const credits = topupQuoteForUsd(STARTER_PASS_USD).credits;

	return (
		<div className="flex flex-col gap-2">
			<p className="font-bold font-grotesk text-3xl tabular-nums tracking-[-0.03em]">
				<bdi>{formatUsdAndDzd(STARTER_PASS_USD, locale, dzdPerUsdRate)}</bdi>
			</p>
			<p className="text-muted-foreground text-sm">{copy.why}</p>
			<p className="font-grotesk font-semibold text-sm">
				{t("billing.starterPass.youGet", {
					credits: t("credits.creditUnit", {
						count: credits,
						countDisplay: formatNumber(credits, locale),
					}),
				})}
				{promoCredits > 0 ? ` ${copy.welcomeUnlock}` : null}
			</p>
			<p className="text-muted-foreground text-xs">{copy.methods}</p>
		</div>
	);
}

type StarterPassCardProps = {
	/** Decimal settled promo credits of the pool, from the wallet balance. */
	promoCredits: number;
	/** Opens the top-up dialog. The dialog is in its Starter pass mode while the wallet needs the pass. */
	onGetPass: () => void;
	/** The white card frame of the wallet page (ring, radius, shadow). */
	className?: string;
};

/** pages/billing-page.tsx shows it above the wallet while the wallet says `starterPassRequired`. */
export function StarterPassCard({
	promoCredits,
	onGetPass,
	className,
}: StarterPassCardProps) {
	const { locale, t } = useTranslation();
	const copy = useDictionary().billing.starterPass;
	const purchasesEnabled = usePurchasesEnabled();
	const dzdPerUsdRate = useDzdPerUsdRate();

	// The ember ring comes after `className`, so it replaces the grey ring of the page card.
	return (
		<section
			className={cn(
				"flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6",
				className,
				"ring-2 ring-ember/40",
			)}
		>
			<div className="flex items-start gap-3">
				<span
					aria-hidden
					className="grid size-10 shrink-0 place-items-center rounded-xl bg-spark/25 text-night dark:bg-spark/20 dark:text-spark"
				>
					<CoinsIcon weight="duotone" className="size-5" />
				</span>
				<div className="min-w-0">
					<h3 className="font-grotesk font-semibold text-[15px] text-night tracking-[-0.01em] dark:text-foreground">
						{copy.title}
					</h3>
					<div className="mt-2">
						<StarterPassSummary promoCredits={promoCredits} />
					</div>
				</div>
			</div>
			{/* Only an explicit false hides the action: a slow settings fetch never strips it. */}
			{purchasesEnabled === false ? (
				<p className="text-muted-foreground text-sm">{copy.unavailableBody}</p>
			) : (
				<KeycapButton
					type="button"
					size="md"
					className="w-full shrink-0 focus-visible:outline-ember sm:w-auto"
					onClick={onGetPass}
				>
					<bdi>
						{t("billing.starterPass.cta", {
							price: formatUsdAndDzd(STARTER_PASS_USD, locale, dzdPerUsdRate),
						})}
					</bdi>
				</KeycapButton>
			)}
		</section>
	);
}

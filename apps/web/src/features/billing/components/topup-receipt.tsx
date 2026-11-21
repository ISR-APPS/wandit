/**
 * Receipt of the top-up kit: a paper ticket with the price, the base credits, the bonus, and the total.
 * The wallet card, the top-up dialog, and /pricing render it. The SlickPay and offline tabs render TopupCreditsLine.
 * Every number comes from topupQuoteForUsd in the contracts. The server grants the same quote.
 */
import { topupQuoteForUsd } from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";
import {
	motion,
	useReducedMotion,
	useSpring,
	useTransform,
} from "motion/react";
import { type CSSProperties, type ReactNode, useEffect } from "react";

import { Spark } from "@/components/logo";
import { formatUsd } from "@/features/billing/lib/price-format";
import {
	formatNumber,
	type Locale,
	useDictionary,
	useTranslation,
} from "@/lib/i18n";
import type { TopupTone } from "./topup-amount-picker";

type TopupReceiptProps = {
	/** Whole USD from the picker. Null while the typed text is not valid: the ticket then shows dashes. */
	amountUsd: number | null;
	/** Ground around the ticket. The ticket itself is always paper. */
	tone: TopupTone;
	/** "full" on /pricing. "compact" in the dialog and on the wallet card. */
	size: "full" | "compact";
	/** Price of the amount in DZD, from formatLocalPrice with the rate of useDzdPerUsdRate. Undefined when the rate is not known. */
	localPriceLabel?: string;
	/** Called by the nudge button with the first amount of the next bonus tier, in whole USD. */
	onAmountUsdChange: (amountUsd: number) => void;
};

// Half circles cut out of the top edge, 14 px apart, so the ticket looks torn from a roll.
const PERFORATED_EDGE_STYLE = {
	maskImage: "radial-gradient(circle at 7px 0, transparent 4.5px, #000 5px)",
	maskSize: "14px 100%",
	maskRepeat: "repeat-x",
} satisfies CSSProperties;

// The mask also cuts a box shadow, so the edge of the ticket is a drop-shadow filter on its wrapper.
const TICKET_EDGE_CLASS = {
	night: "[filter:drop-shadow(0_14px_24px_rgb(0_0_0/0.35))]",
	paper:
		"[filter:drop-shadow(0_0_1px_rgb(11_16_51/0.28))_drop-shadow(0_2px_0_rgb(11_16_51/0.06))]",
} as const satisfies Record<TopupTone, string>;

// A short spring: the total settles in about 0.4 s, so a fast drag on the meter never lags behind.
const TOTAL_SPRING = { stiffness: 260, damping: 32, mass: 0.6 };

/** The ticket and, under it, the nudge to the next bonus tier. */
export function TopupReceipt({
	amountUsd,
	tone,
	size,
	localPriceLabel,
	onAmountUsdChange,
}: TopupReceiptProps) {
	const { locale, t } = useTranslation();
	const copy = useDictionary().billing.topup;
	const quote = amountUsd === null ? null : topupQuoteForUsd(amountUsd);
	const nextTier = quote?.nextTier ?? null;
	const isFull = size === "full";
	const bonusText = (percent: number) =>
		t("billing.topup.bonusLabel", { percent: formatNumber(percent, locale) });

	return (
		<div className="flex flex-col gap-3">
			<div className={TICKET_EDGE_CLASS[tone]}>
				<section
					aria-label={copy.receipt.label}
					style={PERFORATED_EDGE_STYLE}
					className={cn(
						"rounded-b-2xl bg-paper font-grotesk text-night tabular-nums",
						isFull ? "px-6 pt-7 pb-5" : "px-4 pt-5 pb-4",
					)}
				>
					<dl className={cn("grid gap-2", isFull ? "text-[15px]" : "text-sm")}>
						<ReceiptLine label={copy.receipt.youPay}>
							{/* A receipt prints the cents: "$40.00". */}
							<bdi>
								{amountUsd === null
									? "—"
									: new Intl.NumberFormat(locale, {
											style: "currency",
											currency: "USD",
										}).format(amountUsd)}
							</bdi>
							{localPriceLabel && amountUsd !== null ? (
								<span className="block text-end font-normal text-night/55 text-xs">
									{t("billing.topup.receipt.localPrice", {
										price: localPriceLabel,
									})}
								</span>
							) : null}
						</ReceiptLine>
						<ReceiptLine label={copy.receipt.credits}>
							{quote === null ? "—" : formatNumber(quote.baseCredits, locale)}
						</ReceiptLine>
						{quote !== null && quote.bonusCredits > 0 ? (
							<ReceiptLine
								label={t("billing.topup.receipt.bonus", {
									percent: bonusText(quote.bonusPercent),
								})}
								className="text-ember-deep"
							>
								<bdi>+{formatNumber(quote.bonusCredits, locale)}</bdi>
							</ReceiptLine>
						) : null}
					</dl>
					<div
						aria-hidden
						className="my-3.5 border-night/20 border-t border-dashed"
					/>
					<div
						aria-live="polite"
						className="flex items-baseline justify-between gap-3"
					>
						<span className="font-semibold text-night/70 text-sm">
							{copy.receipt.youGet}
						</span>
						<span className="flex items-baseline gap-1.5">
							<span
								className={cn(
									"font-bold leading-none tracking-[-0.04em]",
									isFull ? "text-[2.5rem]" : "text-[1.75rem]",
								)}
							>
								{quote === null ? (
									"—"
								) : (
									<RollingCredits credits={quote.credits} locale={locale} />
								)}
							</span>
							{quote === null ? null : (
								<span className="font-semibold text-night/70 text-sm">
									{t("billing.topup.receipt.totalUnit", {
										count: quote.credits,
									})}
								</span>
							)}
						</span>
					</div>
					<p className="mt-3 text-night/55 text-xs">{copy.receipt.footer}</p>
				</section>
			</div>

			{/* The nudge names the next tier each time one exists. A click moves the amount to it. */}
			{nextTier && amountUsd !== null ? (
				<button
					type="button"
					onClick={() => onAmountUsdChange(nextTier.minAmountUsd)}
					className={cn(
						"group/nudge inline-flex items-center gap-1.5 self-start rounded-full px-1 font-grotesk font-semibold text-sm outline-offset-2 transition-colors focus-visible:outline-2 motion-reduce:transition-none",
						tone === "night"
							? "text-spark hover:text-paper focus-visible:outline-spark"
							: "text-ember-text hover:text-night focus-visible:outline-ember dark:hover:text-foreground",
					)}
				>
					<Spark className="size-3.5 transition-transform group-hover/nudge:rotate-45 motion-reduce:transition-none" />
					<bdi>
						{t("billing.topup.nudge", {
							amount: formatUsd(nextTier.minAmountUsd - amountUsd, locale),
							bonus: bonusText(nextTier.bonusPercent),
						})}
					</bdi>
				</button>
			) : null}
		</div>
	);
}

/** One line of the receipt: the label at the start, the value at the end. */
function ReceiptLine({
	label,
	className,
	children,
}: {
	label: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<div className={cn("flex items-baseline justify-between gap-3", className)}>
			<dt className="text-night/70">{label}</dt>
			<dd className="text-end font-semibold">{children}</dd>
		</div>
	);
}

/**
 * The total credits. A new value rolls in with a spring. With reduced motion the number changes at once.
 * The aria-live row above reads the final value from the hidden copy, not each frame.
 */
function RollingCredits({
	credits,
	locale,
}: {
	/** Whole credits of the quote. */
	credits: number;
	locale: Locale;
}) {
	const reduceMotion = useReducedMotion();
	const spring = useSpring(credits, TOTAL_SPRING);
	const rollingText = useTransform(spring, (latest) =>
		formatNumber(Math.round(latest), locale),
	);

	useEffect(() => {
		spring.set(credits);
	}, [spring, credits]);

	if (reduceMotion) {
		return <bdi>{formatNumber(credits, locale)}</bdi>;
	}
	return (
		<bdi>
			<span className="sr-only">{formatNumber(credits, locale)}</span>
			<motion.span aria-hidden>{rollingText}</motion.span>
		</bdi>
	);
}

/**
 * One line for the SlickPay and offline tabs: "You get 420 credits, with 20 bonus".
 * Renders nothing while the amount is not valid. The numbers come from topupQuoteForUsd.
 */
export function TopupCreditsLine({ amountUsd }: { amountUsd: number | null }) {
	const { locale, t } = useTranslation();

	if (amountUsd === null) {
		return null;
	}
	const quote = topupQuoteForUsd(amountUsd);
	const credits = t("credits.creditUnit", {
		count: quote.credits,
		countDisplay: formatNumber(quote.credits, locale),
	});

	return (
		<p className="font-grotesk font-semibold text-sm tabular-nums">
			{quote.bonusCredits > 0
				? t("billing.topup.youGetWithBonus", {
						credits,
						bonus: formatNumber(quote.bonusCredits, locale),
					})
				: t("billing.topup.creditsYouGet", { credits })}
		</p>
	);
}

/**
 * The body of the public pricing page. pages/pricing-page.tsx renders it.
 * An ember hero holds the title and the rate. The night meter card overlaps its bottom edge.
 * It holds the amount picker and the receipt of the billing feature. Its keycap opens the top-up dialog.
 * Below come the free strip (or the Starter pass strip), the credit uses, the trophy teaser, and the pricing FAQ.
 * Prices show USD, then DZD when the billing feature knows the rate.
 */
import { useNavigate } from "@tanstack/react-router";
import {
	STARTER_PASS_USD,
	TOPUP_BONUS_TIERS,
	TOPUP_CREDITS_PER_USD,
	TOPUP_MAX_AMOUNT_USD,
	TOPUP_MIN_AMOUNT_USD,
	TOPUP_PRESET_AMOUNTS_USD,
	topupQuoteForUsd,
} from "@wandit/contracts";
import { useId, useState } from "react";

import { Spark } from "@/components/logo";
import { useAuthModal, useSession } from "@/features/auth";
import {
	formatLocalPrice,
	formatUsdAndDzd,
	TopupAmountPicker,
	TopupReceipt,
	useBillingModal,
	useDzdPerUsdRate,
	usePurchasesEnabled,
} from "@/features/billing";
import { formatCreditAmount } from "@/features/credits";
import { usePublicSettingsQuery } from "@/features/settings";
import { formatNumber, useDictionary, useTranslation } from "@/lib/i18n";

import { HERO_PANEL_ID } from "../lib/scroll";
import { KeycapButton } from "./keycap-button";
import { PricingCreditUses } from "./pricing-credit-uses";
import { PricingFaq } from "./pricing-faq";
import { PricingTrophyTeaser } from "./pricing-trophy-teaser";
import { Reveal } from "./reveal";

// The first tier with a bonus. Null when the contracts set a flat rate.
// The hero then drops the bonus sentence.
const FIRST_BONUS_TIER =
	TOPUP_BONUS_TIERS.find((tier) => tier.bonusPercent > 0) ?? null;

// The meter starts at the first bonus tier, so the receipt shows a bonus line at once.
const START_AMOUNT_USD = FIRST_BONUS_TIER?.minAmountUsd ?? TOPUP_MIN_AMOUNT_USD;

// The outline button of the white free strip. The night card uses the spark keycap.
const OUTLINE_BUTTON_CLASS =
	"inline-flex h-12 w-full shrink-0 items-center justify-center rounded-xl px-6 font-semibold text-base ring-1 ring-night/15 outline-offset-2 transition-[background-color,box-shadow] hover:bg-night/[0.04] hover:ring-night/30 focus-visible:outline-2 focus-visible:outline-ember sm:w-auto";

/**
 * The full pricing page body. Every price in this body comes from the contracts.
 * Only landing.pricing.meta.description and the credits answer in landing.faq.items hold the 10 and 40 USD numbers as text.
 */
export function Pricing() {
	const { locale, t } = useTranslation();
	const pricing = useDictionary().landing.pricing;
	const titleId = useId();
	const dzdPerUsdRate = useDzdPerUsdRate();
	// The hero states the USD rate, then the DZD price when the rate is known.
	const formatUsdPrice = (usd: number) =>
		formatUsdAndDzd(usd, locale, dzdPerUsdRate);

	return (
		<section aria-labelledby={titleId}>
			{/* The nav measures this panel by its id, so the nav is clear over it, as over the home hero. */}
			<div
				id={HERO_PANEL_ID}
				className="relative m-2 overflow-hidden rounded-[2rem] bg-ember text-white md:m-3 md:rounded-[2.75rem]"
			>
				{/* Two large sparks frame the title. They are decoration only. */}
				<Spark className="pointer-events-none absolute -start-20 -top-16 size-72 rotate-12 text-white/[0.07] md:size-96" />
				<Spark className="pointer-events-none absolute end-[6%] bottom-40 hidden size-24 -rotate-12 text-spark/60 md:block" />
				<div className="relative mx-auto flex max-w-7xl flex-col items-center px-4 pt-32 pb-44 text-center md:px-8 md:pt-40 md:pb-56">
					{/* Small text on ember is night: white is only 3.9:1 there. */}
					<p className="font-semibold text-night text-sm uppercase tracking-[0.16em] rtl:tracking-normal">
						{pricing.kicker}
					</p>
					<h1
						id={titleId}
						className="mt-5 max-w-[14ch] text-balance font-extrabold text-[clamp(2.75rem,7vw,6.5rem)] leading-[0.95] tracking-[-0.05em] rtl:leading-[1.3] rtl:tracking-normal"
					>
						{pricing.title}
					</h1>
					<p className="mt-7 max-w-[40ch] text-balance font-medium text-lg text-white/90 leading-snug md:text-xl">
						<bdi>
							{t("landing.pricing.sub.rate", {
								price: formatUsdPrice(1),
								credits: t("credits.creditUnit", {
									count: TOPUP_CREDITS_PER_USD,
									countDisplay: formatNumber(TOPUP_CREDITS_PER_USD, locale),
								}),
							})}
						</bdi>{" "}
						{FIRST_BONUS_TIER ? (
							<>
								<bdi>
									{t("landing.pricing.sub.bonus", {
										price: formatUsdPrice(FIRST_BONUS_TIER.minAmountUsd),
									})}
								</bdi>{" "}
							</>
						) : null}
						{pricing.sub.terms}
					</p>
				</div>
			</div>

			<MeterCard />
			<StartStrip />
			<PricingCreditUses />
			<PricingTrophyTeaser />
			<PricingFaq />
		</section>
	);
}

/**
 * The night card that overlaps the hero. The Spark Meter is at the start.
 * The receipt and the keycap are at the end.
 * The amount stays in this card. The keycap opens the top-up dialog with it, or the auth modal when signed out.
 */
function MeterCard() {
	const { locale, t } = useTranslation();
	const pricing = useDictionary().landing.pricing;
	const { openTopup } = useBillingModal();
	const purchasesEnabled = usePurchasesEnabled();
	// Null while the typed text is not a valid amount. The keycap is then disabled.
	const [amountUsd, setAmountUsd] = useState<number | null>(START_AMOUNT_USD);
	// Decimal DZD per 1 USD for every visitor. A failed request falls back to USD only.
	const dzdPerUsdRate = useDzdPerUsdRate();
	const localPriceLabel =
		dzdPerUsdRate !== null && amountUsd !== null
			? formatLocalPrice(amountUsd, locale, dzdPerUsdRate)
			: undefined;
	// Only an explicit false locks the card: a slow settings fetch never strips the action.
	const isLocked = purchasesEnabled === false;

	return (
		<div className="relative mx-auto -mt-36 max-w-5xl px-4 md:-mt-44 md:px-8">
			<Reveal>
				<div className="relative overflow-hidden rounded-[1.75rem] bg-night p-5 text-paper shadow-[0_48px_80px_-40px_rgb(11_16_51/0.8)] sm:p-7 md:rounded-[2.25rem] md:p-10">
					{/* A soft ember glow in the top corner, so the card reads as lit by the hero above it. */}
					<div
						aria-hidden
						className="pointer-events-none absolute -end-32 -top-40 size-[28rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-ember)_38%,transparent),transparent)]"
					/>
					<div className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-3">
								<h2 className="font-bold text-2xl tracking-[-0.03em] rtl:tracking-normal">
									{pricing.meter.title}
								</h2>
								<span className="rounded-full bg-spark px-3 py-1 font-semibold text-night text-xs shadow-[0_2px_0_var(--color-spark-deep)]">
									{isLocked ? pricing.beta.badge : pricing.payg.badge}
								</span>
							</div>
							<p className="mt-2 max-w-[44ch] text-[15px] text-paper/65 leading-snug">
								{pricing.payg.tagline}
							</p>
							<div className="mt-8">
								<TopupAmountPicker
									amountUsd={amountUsd}
									onAmountUsdChange={setAmountUsd}
									minAmountUsd={TOPUP_MIN_AMOUNT_USD}
									maxAmountUsd={TOPUP_MAX_AMOUNT_USD}
									presetAmountsUsd={TOPUP_PRESET_AMOUNTS_USD}
									tone="night"
									layout="meter"
									disabled={isLocked}
								/>
							</div>
						</div>

						<div className="flex min-w-0 flex-col gap-5">
							<TopupReceipt
								amountUsd={amountUsd}
								tone="night"
								size="full"
								localPriceLabel={localPriceLabel}
								onAmountUsdChange={setAmountUsd}
							/>
							{isLocked ? (
								<p className="text-paper/65 text-sm">
									{t("billing.topup.openSoon")}
								</p>
							) : (
								// The dialog resolves card, SlickPay, or cash / transfer. A signed-out visitor gets the auth modal.
								<KeycapButton
									type="button"
									size="lg"
									className="w-full"
									disabled={amountUsd === null}
									onClick={() => {
										if (amountUsd !== null) {
											openTopup("marketing_pricing", amountUsd);
										}
									}}
								>
									{amountUsd === null ? (
										pricing.meter.ctaEmpty
									) : (
										// The keycap names the USD price first, like the picker and the first receipt line.
										<bdi>
											{t("landing.pricing.payg.cta", {
												price: formatUsdAndDzd(
													amountUsd,
													locale,
													dzdPerUsdRate,
												),
											})}
										</bdi>
									)}
								</KeycapButton>
							)}
						</div>
					</div>
				</div>
			</Reveal>
			<p className="mt-5 text-center text-night/60 text-sm">
				{pricing.meter.footnote}
			</p>
		</div>
	);
}

/** The Starter pass strip while the admin switch is on. Else the free strip. */
function StartStrip() {
	const settingsQuery = usePublicSettingsQuery();

	// An API from before the Starter pass has no flag. The free strip shows, as before.
	return settingsQuery.data?.starterPassRequired ? (
		<StarterPassStrip
			grantCredits={
				settingsQuery.data.signupGrantEnabled
					? settingsQuery.data.signupGrantCredits
					: 0
			}
		/>
	) : (
		<FreeStrip />
	);
}

/**
 * The Starter pass, as one white strip: its price in USD and DZD, why Wandit asks for it, and its credits.
 * The button opens the top-up dialog in its Starter pass mode, or the auth modal when signed out.
 */
function StarterPassStrip({
	grantCredits,
}: {
	/** Decimal signup credits from the public settings, 0 when the grant is off. Above 0 adds "welcome credits unlock too". */
	grantCredits: number;
}) {
	const { data: session } = useSession();
	const { open: openAuth } = useAuthModal();
	const { openTopup } = useBillingModal();
	const { locale, t } = useTranslation();
	const copy = useDictionary().landing.pricing.starterPass;
	const dzdPerUsdRate = useDzdPerUsdRate();
	const credits = topupQuoteForUsd(STARTER_PASS_USD).credits;

	const getPass = () => {
		if (session) {
			openTopup("marketing_pricing");
			return;
		}
		// After sign-in the wallet page opens the dialog, so the new user lands on the pass.
		openAuth({ next: "/billing?starterPass=1" });
	};

	return (
		<div className="mx-auto mt-16 max-w-5xl px-4 md:mt-20 md:px-8">
			<Reveal>
				<div className="flex flex-col gap-6 rounded-[1.75rem] bg-white p-6 shadow-[0_1px_0_rgb(11_16_51/0.06),0_24px_48px_-28px_rgb(11_16_51/0.35)] sm:flex-row sm:items-center sm:justify-between md:rounded-[2rem] md:p-8">
					<div className="flex items-start gap-4">
						<span
							aria-hidden
							className="grid size-12 shrink-0 place-items-center rounded-2xl bg-spark/20 text-ember shadow-[0_3px_0_color-mix(in_oklab,var(--color-spark-deep)_35%,transparent)]"
						>
							<Spark className="size-6" />
						</span>
						<div className="min-w-0">
							<p className="font-semibold text-ember-deep text-xs uppercase tracking-[0.14em] rtl:tracking-normal">
								{copy.name}
							</p>
							<h2 className="mt-1 font-bold text-2xl tracking-[-0.03em] rtl:tracking-normal">
								<bdi>
									{t("landing.pricing.starterPass.title", {
										price: formatUsdAndDzd(
											STARTER_PASS_USD,
											locale,
											dzdPerUsdRate,
										),
									})}
								</bdi>
							</h2>
							<p className="mt-1 text-[15px] text-night/65 leading-snug">
								{t("landing.pricing.starterPass.tagline", {
									credits: t("credits.creditUnit", {
										count: credits,
										countDisplay: formatNumber(credits, locale),
									}),
								})}
								{grantCredits > 0 ? ` ${copy.welcomeUnlock}` : null}
							</p>
						</div>
					</div>
					<button
						type="button"
						className={OUTLINE_BUTTON_CLASS}
						onClick={getPass}
					>
						{copy.cta}
					</button>
				</div>
			</Reveal>
		</div>
	);
}

/**
 * The free signup credits, as one white strip. It shows only while the signup grant is on and above 0.
 * The button opens the auth modal, or the dashboard for a signed-in user.
 */
function FreeStrip() {
	const { data: session } = useSession();
	const { open: openAuth } = useAuthModal();
	const navigate = useNavigate();
	const { locale, t } = useTranslation();
	const free = useDictionary().landing.pricing.free;
	const settingsQuery = usePublicSettingsQuery();

	if (
		!settingsQuery.isSuccess ||
		!settingsQuery.data.signupGrantEnabled ||
		settingsQuery.data.signupGrantCredits <= 0
	) {
		return null;
	}
	const grantCredits = settingsQuery.data.signupGrantCredits;

	const startBuilding = () => {
		if (session) {
			// A signed-in user already has the grant. The dashboard has the prompt box.
			void navigate({ to: "/dashboard" });
			return;
		}
		openAuth();
	};

	return (
		<div className="mx-auto mt-16 max-w-5xl px-4 md:mt-20 md:px-8">
			<Reveal>
				<div className="flex flex-col gap-6 rounded-[1.75rem] bg-white p-6 shadow-[0_1px_0_rgb(11_16_51/0.06),0_24px_48px_-28px_rgb(11_16_51/0.35)] sm:flex-row sm:items-center sm:justify-between md:rounded-[2rem] md:p-8">
					<div className="flex items-start gap-4">
						<span
							aria-hidden
							className="grid size-12 shrink-0 place-items-center rounded-2xl bg-spark/20 text-ember shadow-[0_3px_0_color-mix(in_oklab,var(--color-spark-deep)_35%,transparent)]"
						>
							<Spark className="size-6" />
						</span>
						<div className="min-w-0">
							<p className="font-semibold text-ember-deep text-xs uppercase tracking-[0.14em] rtl:tracking-normal">
								{free.name}
							</p>
							<h2 className="mt-1 font-bold text-2xl tracking-[-0.03em] rtl:tracking-normal">
								<bdi>
									{t("landing.pricing.free.creditsLine", {
										count: grantCredits,
										countDisplay: formatCreditAmount(grantCredits, locale),
									})}
								</bdi>
							</h2>
							<p className="mt-1 text-[15px] text-night/65 leading-snug">
								{free.tagline}
							</p>
						</div>
					</div>
					<button
						type="button"
						className={OUTLINE_BUTTON_CLASS}
						onClick={startBuilding}
					>
						{free.cta}
					</button>
				</div>
			</Reveal>
		</div>
	);
}

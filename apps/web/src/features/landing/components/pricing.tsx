/**
 * The body of the public pricing page. pages/pricing-page.tsx renders it.
 * An ember header holds the title and the monthly or yearly switch. The Free,
 * Pro, and Business cards overlap its bottom edge. The cards open the plan
 * picker, the auth modal, or the create-team dialog.
 * Visitors in Algeria see every price in DZD (GET local-pricing).
 */
import { useNavigate } from "@tanstack/react-router";
import type {
	BillingInterval,
	BillingTierPrice,
	CreditTier,
} from "@wandit/contracts";
import { formatNumber, type Locale } from "@wandit/internationalization";
import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { Skeleton } from "@wandit/ui/components/skeleton";
import { cn } from "@wandit/ui/lib/utils";
import { Check } from "lucide-react";
import { motion } from "motion/react";
import type * as React from "react";
import { useId, useState } from "react";

import { useAuthModal, useSession } from "@/features/auth";
import {
	formatPlanPrice,
	tierPriceUsd,
	tierSavingsPercent,
	useBillingModal,
	useLocalPricingQuery,
} from "@/features/billing";
import { useBillingPlansQuery } from "@/features/billing/api/billing.queries";
import { formatCreditAmount } from "@/features/credits/lib/format-credits";
import { usePublicSettingsQuery } from "@/features/settings/api/settings.queries";
import { CreateWorkspaceDialog } from "@/features/workspaces/components/create-workspace-dialog";

import { HERO_PANEL_ID } from "../lib/scroll";
import { KeycapButton } from "./keycap-button";
import { Reveal } from "./reveal";

// The secondary button of the white cards. The night card uses the spark keycap.
const OUTLINE_BUTTON_CLASS =
	"mt-8 inline-flex h-12 w-full items-center justify-center rounded-xl px-5 font-semibold text-base ring-1 ring-night/15 outline-offset-2 transition-[background-color,box-shadow] hover:bg-night/[0.04] hover:ring-night/30 focus-visible:outline-2 focus-visible:outline-ember";

/** Shows live catalog prices and keeps unavailable purchase actions hidden. */
export function Pricing() {
	const { data: session } = useSession();
	const { open: openAuth } = useAuthModal();
	const { openPlanPicker } = useBillingModal();
	const navigate = useNavigate();
	const { locale, t } = useTranslation();
	const pricing = useDictionary().landing.pricing;
	const plansQuery = useBillingPlansQuery();
	const settingsQuery = usePublicSettingsQuery();
	const localPricingQuery = useLocalPricingQuery();
	const titleId = useId();
	const [interval, setBillingInterval] = useState<BillingInterval>("month");
	const [selectedCredits, setSelectedCredits] = useState<CreditTier>();
	const [createTeamOpen, setCreateTeamOpen] = useState(false);
	const proPlan = plansQuery.data?.plans.find((plan) => plan.id === "pro");
	const selectedTier =
		proPlan?.tiers.find((tier) => tier.tierCredits === selectedCredits) ??
		proPlan?.tiers[0];
	// Visitors in Algeria must never see USD, so the prices wait for the local-pricing answer.
	// Not null only for them. A failed request falls back to USD.
	const pricesReady = !localPricingQuery.isPending;
	const dzdPerUsdRate = localPricingQuery.data?.slickpay?.dzdPerUsdRate ?? null;
	// SlickPay does not depend on the Stripe or offline switches: a visitor in Algeria can always pay with it.
	const slickpayAvailable = dzdPerUsdRate !== null;
	const paidSubscriptionsEnabled =
		settingsQuery.data?.paidSubscriptionsEnabled === true;
	const subscriptionPlansAvailable =
		paidSubscriptionsEnabled ||
		settingsQuery.data?.manualPaymentsEnabled === true ||
		slickpayAvailable;
	const showBetaPosture =
		settingsQuery.isSuccess && !subscriptionPlansAvailable;
	const proCatalogUnavailable =
		plansQuery.isError || (plansQuery.isSuccess && (!proPlan || !selectedTier));
	const freeCreditsLine =
		settingsQuery.isSuccess &&
		settingsQuery.data.signupGrantEnabled &&
		settingsQuery.data.signupGrantCredits > 0
			? t("landing.pricing.free.creditsLine", {
					count: settingsQuery.data.signupGrantCredits,
					countDisplay: formatCreditAmount(
						settingsQuery.data.signupGrantCredits,
						locale,
					),
				})
			: pricing.free.creditsFallback;
	// The Business card is a showcase: it renders whenever the catalog carries
	// the plan, so the page can market teams before they open. Only the
	// create-team CTA ships dark behind both kill switches — a team goes
	// straight into a Business checkout the server would reject.
	const businessPlan = plansQuery.data?.plans.find(
		(plan) => plan.id === "business",
	);
	const showBusiness =
		businessPlan !== undefined && businessPlan.tiers.length > 0;
	const canCreateTeam =
		settingsQuery.data?.organizationsEnabled === true &&
		(paidSubscriptionsEnabled || slickpayAvailable);
	const businessFromUsd = businessPlan?.tiers.length
		? Math.min(...businessPlan.tiers.map((tier) => tierPriceUsd(tier, "month")))
		: null;

	const startBuilding = () => {
		if (session) {
			// Signed-in users are redirected off "/" anyway; go straight to the
			// dashboard, which has its own prompt box.
			void navigate({ to: "/dashboard" });
			return;
		}

		openAuth();
	};

	return (
		<section aria-labelledby={titleId}>
			{/* The nav measures this panel by its id, so the nav is clear over it, as over the home hero. */}
			<div
				id={HERO_PANEL_ID}
				className="relative m-2 overflow-hidden rounded-[2rem] bg-ember text-white md:m-3 md:rounded-[2.75rem]"
			>
				<div className="mx-auto flex max-w-7xl flex-col items-center px-4 pt-32 pb-44 text-center md:px-8 md:pt-40 md:pb-56">
					{/* Small text on ember is night: white is only 3.9:1 there. */}
					<p className="font-semibold text-night text-sm uppercase tracking-[0.16em] rtl:tracking-normal">
						{pricing.kicker}
					</p>
					<h1
						id={titleId}
						className="mt-5 max-w-[15ch] text-balance font-extrabold text-[clamp(2.75rem,7vw,6.5rem)] leading-[0.95] tracking-[-0.05em] rtl:leading-[1.3] rtl:tracking-normal"
					>
						{pricing.title}
					</h1>
					<IntervalSwitch
						interval={interval}
						onIntervalChange={setBillingInterval}
					/>
				</div>
			</div>

			<div
				className={cn(
					"relative mx-auto -mt-36 grid max-w-xl gap-5 px-4 md:-mt-44 md:px-8 lg:gap-6",
					showBusiness
						? "lg:max-w-7xl lg:grid-cols-3"
						: "lg:max-w-5xl lg:grid-cols-2",
				)}
			>
				<Reveal>
					<PlanCard>
						<h2 className="font-bold text-2xl tracking-[-0.03em] rtl:tracking-normal">
							{pricing.free.name}
						</h2>
						<p className="mt-2 text-[15px] text-night/65 leading-snug">
							{pricing.free.tagline}
						</p>
						<div className="mt-8">
							<PriceLine amount={pricing.free.price} />
							<p className="mt-2 text-night/65 text-sm">{freeCreditsLine}</p>
						</div>
						<FeatureList features={pricing.free.features} />
						{settingsQuery.isSuccess &&
						settingsQuery.data.signupGrantEnabled ? (
							<button
								type="button"
								className={OUTLINE_BUTTON_CLASS}
								onClick={startBuilding}
							>
								{pricing.free.cta}
							</button>
						) : null}
					</PlanCard>
				</Reveal>

				<Reveal delay={0.07}>
					<PlanCard isFeatured>
						<div className="flex items-center justify-between gap-3">
							<h2 className="font-bold text-2xl tracking-[-0.03em] rtl:tracking-normal">
								{pricing.pro.name}
							</h2>
							<span className="rounded-full bg-spark px-3 py-1 font-semibold text-night text-xs shadow-[0_2px_0_var(--color-spark-deep)]">
								{showBetaPosture ? pricing.beta.badge : pricing.pro.badge}
							</span>
						</div>
						<p className="mt-2 text-[15px] text-white/70 leading-snug">
							{pricing.pro.tagline}
						</p>

						<div className="mt-8 min-h-11">
							{selectedTier && pricesReady ? (
								<PriceLine
									amount={formatPlanPrice(
										tierPriceUsd(selectedTier, interval),
										locale,
										dzdPerUsdRate,
									)}
									period={
										interval === "month"
											? pricing.pro.perMonth
											: pricing.pro.perYear
									}
									isFeatured
								/>
							) : proCatalogUnavailable ? (
								<p className="text-sm text-spark" role="alert">
									{pricing.pro.catalogUnavailable}
								</p>
							) : (
								<>
									<Skeleton className="h-11 w-44 bg-white/10" />
									<span className="sr-only">{pricing.pro.loading}</span>
								</>
							)}
						</div>

						<div className="mt-6 flex flex-col gap-2">
							<label
								htmlFor="landing-pricing-tier"
								className="font-medium text-sm text-white/80"
							>
								{pricing.pro.tierLabel}
							</label>
							{proPlan && selectedTier && pricesReady ? (
								<Select
									value={String(selectedTier.tierCredits)}
									onValueChange={(value) => {
										const tier = proPlan.tiers.find(
											(item) => String(item.tierCredits) === value,
										);

										if (tier) setSelectedCredits(tier.tierCredits);
									}}
								>
									{/* The trigger sits on the night card, so it is light glass, not the input look.
									    The value fills the row, so the price aligns at the end as in the list. */}
									<SelectTrigger
										id="landing-pricing-tier"
										className="w-full rounded-xl border-white/15 bg-white/10 px-4 text-base text-white shadow-none hover:bg-white/15 focus-visible:border-spark focus-visible:ring-spark/40 data-[size=default]:h-12 *:data-[slot=select-value]:flex-1 dark:bg-white/10 dark:hover:bg-white/15 [&_svg:not([class*='text-'])]:text-white/70"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="max-h-80">
										<SelectGroup>
											{proPlan.tiers.map((tier) => (
												<SelectItem
													key={tier.tierCredits}
													value={String(tier.tierCredits)}
												>
													<TierOption
														basePer100Usd={proPlan.basePer100Usd}
														dzdPerUsdRate={dzdPerUsdRate}
														interval={interval}
														locale={locale}
														savingsLabel={pricing.pro.savings}
														tier={tier}
														unitLabel={pricing.pro.creditsUnit}
													/>
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							) : proCatalogUnavailable ? null : (
								<Skeleton className="h-12 w-full rounded-xl bg-white/10" />
							)}
						</div>

						<FeatureList features={pricing.pro.features} isFeatured />
						{/* The picker resolves Card versus Cash / transfer and handles
						   the signed-out case through the auth modal. */}
						{subscriptionPlansAvailable && selectedTier ? (
							<KeycapButton
								type="button"
								size="md"
								className="mt-8 h-12 w-full"
								onClick={() =>
									openPlanPicker("marketing_pricing", {
										plan: "pro",
										interval,
										tierCredits: selectedTier.tierCredits,
									})
								}
							>
								{pricing.pro.cta}
							</KeycapButton>
						) : null}
					</PlanCard>
				</Reveal>

				{showBusiness && businessFromUsd !== null ? (
					<Reveal delay={0.12}>
						<PlanCard>
							<h2 className="font-bold text-2xl tracking-[-0.03em] rtl:tracking-normal">
								{pricing.business.name}
							</h2>
							<p className="mt-2 text-[15px] text-night/65 leading-snug">
								{pricing.business.tagline}
							</p>
							<div className="mt-8 min-h-11">
								{pricesReady ? (
									<PriceLine
										amount={pricing.business.fromPrice.replace(
											"{price}",
											formatPlanPrice(businessFromUsd, locale, dzdPerUsdRate),
										)}
										period={pricing.business.perMonth}
									/>
								) : (
									<Skeleton className="h-11 w-44" />
								)}
							</div>
							<FeatureList features={pricing.business.features} />
							{canCreateTeam ? (
								<button
									type="button"
									className={OUTLINE_BUTTON_CLASS}
									onClick={() => {
										if (!session) {
											openAuth();
											return;
										}

										setCreateTeamOpen(true);
									}}
								>
									{pricing.business.cta}
								</button>
							) : null}
						</PlanCard>
					</Reveal>
				) : null}
			</div>
			<p className="mx-auto mt-10 max-w-xl px-4 text-center text-night/65 text-sm md:mt-12">
				{pricing.note}
			</p>
			<CreateWorkspaceDialog
				open={createTeamOpen}
				onOpenChange={setCreateTeamOpen}
			/>
		</section>
	);
}

type IntervalSwitchProps = {
	interval: BillingInterval;
	onIntervalChange: (interval: BillingInterval) => void;
};

/**
 * Monthly or yearly, on the ember header. Native radios: the browser moves
 * the choice with the arrow keys. The same look as the languages switch.
 */
function IntervalSwitch({ interval, onIntervalChange }: IntervalSwitchProps) {
	const pro = useDictionary().landing.pricing.pro;
	const name = useId();
	const options: { value: BillingInterval; label: string }[] = [
		{ value: "month", label: pro.monthly },
		{ value: "year", label: pro.yearly },
	];

	return (
		// A white wash, not a night one: night text keeps 4.5:1 only on a lighter ember.
		<div
			role="radiogroup"
			aria-label={pro.intervalLabel}
			className="mt-10 inline-flex rounded-full bg-white/15 p-1.5 md:mt-12"
		>
			{options.map((option) => {
				const isChecked = option.value === interval;
				return (
					<label
						key={option.value}
						className="relative flex h-12 cursor-pointer items-center gap-2 rounded-full px-5 font-semibold text-base text-night outline-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 md:px-6"
					>
						<input
							type="radio"
							name={name}
							value={option.value}
							checked={isChecked}
							onChange={() => onIntervalChange(option.value)}
							// Invisible but as large as the segment, so a touch screen reader finds it there.
							className="absolute inset-0 z-10 cursor-pointer rounded-full opacity-0"
						/>
						{isChecked ? (
							<motion.span
								layoutId={`${name}-thumb`}
								transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
								className="absolute inset-0 rounded-full bg-white shadow-[0_10px_24px_-12px_rgb(11_16_51/0.55)]"
							/>
						) : null}
						<span className="relative">{option.label}</span>
						{option.value === "year" ? (
							<span className="relative rounded-full bg-night px-2 py-0.5 font-semibold text-[11px] text-cream">
								{pro.twoMonthsFree}
							</span>
						) : null}
					</label>
				);
			})}
		</div>
	);
}

type PlanCardProps = {
	/** True for the Pro card: a night panel, like the night panels of the home page. */
	isFeatured?: boolean;
	children: React.ReactNode;
};

/** One plan. The plain cards are white sheets with the lift of the open FAQ answer. */
function PlanCard({ isFeatured = false, children }: PlanCardProps) {
	return (
		<div
			className={cn(
				"relative flex h-full flex-col rounded-[1.75rem] p-6 md:rounded-[2rem] md:p-8",
				isFeatured
					? "bg-night text-white shadow-[0_32px_64px_-32px_rgb(11_16_51/0.7)]"
					: "bg-white text-night shadow-[0_1px_0_rgb(11_16_51/0.06),0_24px_48px_-28px_rgb(11_16_51/0.35)]",
			)}
		>
			{children}
		</div>
	);
}

type PriceLineProps = {
	/** The formatted price, for example "$25", "6 750 DZD", "From $50", or "Free". */
	amount: string;
	/** The text after the price, for example "/ month". The Free plan has none. */
	period?: string;
	/** True on the night card, where the period text is light. */
	isFeatured?: boolean;
};

function PriceLine({ amount, period, isFeatured = false }: PriceLineProps) {
	return (
		<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
			{/* Arabic letters reach below the line, so Arabic gets more line height. */}
			<bdi className="font-extrabold text-[2.75rem] tabular-nums leading-none tracking-[-0.04em] rtl:leading-[1.3] rtl:tracking-normal">
				{amount}
			</bdi>
			{period ? (
				<span
					className={cn(
						"font-medium text-sm",
						isFeatured ? "text-white/65" : "text-night/65",
					)}
				>
					{period}
				</span>
			) : null}
		</div>
	);
}

type FeatureListProps = {
	/** Feature lines of the plan, from landing.pricing.<plan>.features. */
	features: readonly string[];
	/** True on the night card: the check is spark, the accent of the night panels of the home page. */
	isFeatured?: boolean;
};

/** The feature lines fill the free height, so the buttons of all cards align at the bottom. */
function FeatureList({ features, isFeatured = false }: FeatureListProps) {
	return (
		<ul
			className={cn(
				"mt-8 flex flex-1 flex-col gap-3 text-[15px] leading-snug",
				isFeatured ? "text-white/85" : "text-night/80",
			)}
		>
			{features.map((feature) => (
				<li key={feature} className="flex items-start gap-3">
					<Check
						aria-hidden
						strokeWidth={2.5}
						className={cn(
							"mt-0.5 size-4 shrink-0",
							isFeatured ? "text-spark" : "text-ember",
						)}
					/>
					<span>{feature}</span>
				</li>
			))}
		</ul>
	);
}

function TierOption({
	tier,
	basePer100Usd,
	dzdPerUsdRate,
	interval,
	locale,
	savingsLabel,
	unitLabel,
}: {
	tier: BillingTierPrice;
	basePer100Usd: number;
	/** Decimal DZD per 1 USD for visitors in Algeria, else null. */
	dzdPerUsdRate: number | null;
	interval: BillingInterval;
	locale: Locale;
	savingsLabel: string;
	unitLabel: string;
}) {
	const savings = tierSavingsPercent(tier, basePer100Usd);

	return (
		<span className="flex w-full min-w-0 items-center justify-between gap-3">
			<span className="min-w-0 truncate">
				{formatNumber(tier.tierCredits, locale)} {unitLabel}
			</span>
			<span className="flex shrink-0 items-center gap-2">
				{/* Night on spark reads on the white list and on the night trigger. */}
				{savings > 0 ? (
					<span className="rounded-full bg-spark px-1.5 py-0.5 font-semibold text-[10px] text-night">
						{savingsLabel.replace("{percent}", String(savings))}
					</span>
				) : null}
				<bdi className="font-semibold text-sm tabular-nums">
					{formatPlanPrice(tierPriceUsd(tier, interval), locale, dzdPerUsdRate)}
				</bdi>
			</span>
		</span>
	);
}

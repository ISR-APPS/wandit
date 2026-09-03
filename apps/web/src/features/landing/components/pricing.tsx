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
import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@wandit/ui/components/toggle-group";
import { cn } from "@wandit/ui/lib/utils";
import { Check } from "lucide-react";
import type * as React from "react";
import { useState } from "react";

import { useAuthModal, useSession } from "@/features/auth";
import { useBillingPlansQuery } from "@/features/billing/api/billing.queries";
import { useBillingModal } from "@/features/billing/components/billing-modal-provider";
import {
	formatUsd,
	tierPriceUsd,
	tierSavingsPercent,
} from "@/features/billing/lib/plan-pricing";
import { formatCreditAmount } from "@/features/credits/lib/format-credits";
import { usePublicSettingsQuery } from "@/features/settings/api/settings.queries";
import { CreateWorkspaceDialog } from "@/features/workspaces/components/create-workspace-dialog";

import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";

function FeatureRow({ label }: { label: string }) {
	return (
		<li className="flex items-start gap-2.5 text-sm">
			<Check className="mt-0.5 size-4 shrink-0 text-success" />
			<span>{label}</span>
		</li>
	);
}

function PlanCard({
	featured,
	className,
	children,
}: {
	featured?: boolean;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"relative flex h-full flex-col rounded-2xl border border-border bg-card/60 p-6",
				featured &&
					"border-primary/40 bg-card shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-primary)_18%,transparent)] ring-1 ring-primary/20",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function Pricing() {
	const { data: session } = useSession();
	const { open: openAuth } = useAuthModal();
	const { openPlanPicker } = useBillingModal();
	const navigate = useNavigate();
	const { locale, t } = useTranslation();
	const pricing = useDictionary().landing.pricing;
	const plansQuery = useBillingPlansQuery();
	const settingsQuery = usePublicSettingsQuery();
	const [interval, setBillingInterval] = useState<BillingInterval>("month");
	const [selectedCredits, setSelectedCredits] = useState<CreditTier>();
	const [createTeamOpen, setCreateTeamOpen] = useState(false);
	const starterPlan = plansQuery.data?.plans.find(
		(plan) => plan.id === "starter",
	);
	const starterTier = starterPlan?.tiers[0];
	const proPlan = plansQuery.data?.plans.find((plan) => plan.id === "pro");
	const selectedTier =
		proPlan?.tiers.find((tier) => tier.tierCredits === selectedCredits) ??
		proPlan?.tiers[0];
	const paidSubscriptionsEnabled =
		settingsQuery.data?.paidSubscriptionsEnabled === true;
	const subscriptionPlansAvailable =
		paidSubscriptionsEnabled ||
		settingsQuery.data?.manualPaymentsEnabled === true;
	const showBetaPosture =
		settingsQuery.isSuccess && !subscriptionPlansAvailable;
	const starterCatalogUnavailable =
		plansQuery.isError ||
		(plansQuery.isSuccess && (!starterPlan || !starterTier));
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
		paidSubscriptionsEnabled;
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
		<section id="pricing" className="scroll-mt-20 px-4 py-16 md:py-24">
			<div className="mx-auto max-w-7xl">
				<SectionHeader kicker={pricing.kicker} title={pricing.title} />
				<Reveal className="mx-auto mb-8 max-w-sm md:mb-10">
					<span className="mb-2 block text-center font-medium text-sm">
						{pricing.pro.intervalLabel}
					</span>
					<ToggleGroup
						type="single"
						value={interval}
						variant="outline"
						spacing={0}
						className="w-full"
						aria-label={pricing.pro.intervalLabel}
						onValueChange={(value) => {
							if (value === "month" || value === "year") {
								setBillingInterval(value);
							}
						}}
					>
						<ToggleGroupItem value="month" className="flex-1">
							{pricing.pro.monthly}
						</ToggleGroupItem>
						<ToggleGroupItem value="year" className="flex-1 gap-2">
							{pricing.pro.yearly}
							<Badge
								variant="secondary"
								className="px-1.5 font-mono text-[9px]"
							>
								{pricing.pro.twoMonthsFree}
							</Badge>
						</ToggleGroupItem>
					</ToggleGroup>
				</Reveal>
				<div
					className={cn(
						"grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5",
						showBusiness ? "lg:grid-cols-4" : "lg:grid-cols-3",
					)}
				>
					<Reveal>
						<PlanCard>
							<h3 className="font-display font-semibold text-lg">
								{pricing.free.name}
							</h3>
							<p className="mt-1 text-muted-foreground text-sm">
								{pricing.free.tagline}
							</p>
							<div className="mt-5 font-bold font-display text-3xl tracking-[-0.02em]">
								{pricing.free.price}
							</div>
							<p className="mt-1 font-mono text-muted-foreground text-xs">
								{freeCreditsLine}
							</p>
							<ul className="mt-6 flex flex-1 flex-col gap-2.5">
								{pricing.free.features.map((feature) => (
									<FeatureRow key={feature} label={feature} />
								))}
							</ul>
							{settingsQuery.isSuccess &&
							settingsQuery.data.signupGrantEnabled ? (
								<Button
									variant="outline"
									className="mt-8 active:translate-y-px"
									onClick={startBuilding}
								>
									{pricing.free.cta}
								</Button>
							) : null}
						</PlanCard>
					</Reveal>

					<Reveal delay={0.07}>
						<PlanCard>
							<h3 className="font-display font-semibold text-lg">
								{pricing.starter.name}
							</h3>
							<p className="mt-1 text-muted-foreground text-sm">
								{pricing.starter.tagline}
							</p>
							<div className="mt-5 min-h-11">
								{starterTier ? (
									<PriceSummary
										interval={interval}
										locale={locale}
										periodLabel={
											interval === "month"
												? pricing.starter.perMonth
												: pricing.starter.perYear
										}
										tier={starterTier}
									/>
								) : starterCatalogUnavailable ? (
									<p className="text-destructive text-sm" role="alert">
										{pricing.pro.catalogUnavailable}
									</p>
								) : (
									<>
										<Skeleton className="h-9 w-36" />
										<span className="sr-only">{pricing.pro.loading}</span>
									</>
								)}
							</div>
							<p className="mt-4 font-semibold text-base">
								{pricing.starter.creditsLine}
							</p>
							<ul className="mt-6 flex flex-1 flex-col gap-2.5">
								{pricing.starter.features.map((feature) => (
									<FeatureRow key={feature} label={feature} />
								))}
							</ul>
							{subscriptionPlansAvailable && starterTier ? (
								<Button
									variant="outline"
									className="mt-8 active:translate-y-px"
									onClick={() =>
										openPlanPicker("marketing_pricing", {
											plan: "starter",
											interval,
											tierCredits: starterTier.tierCredits,
										})
									}
								>
									{pricing.starter.cta}
								</Button>
							) : null}
						</PlanCard>
					</Reveal>

					<Reveal delay={0.12}>
						<PlanCard featured>
							<Badge className="absolute inset-x-0 -top-2.5 mx-auto w-fit border-none bg-gradient-ember font-medium font-mono text-[10px] text-[oklch(0.2_0.03_55)] uppercase tracking-[0.14em]">
								{showBetaPosture ? pricing.beta.badge : pricing.pro.badge}
							</Badge>
							<h3 className="font-display font-semibold text-lg">
								{pricing.pro.name}
							</h3>
							<p className="mt-1 text-muted-foreground text-sm">
								{pricing.pro.tagline}
							</p>

							<div className="mt-5 min-h-11">
								{selectedTier ? (
									<PriceSummary
										interval={interval}
										locale={locale}
										periodLabel={
											interval === "month"
												? pricing.pro.perMonth
												: pricing.pro.perYear
										}
										tier={selectedTier}
									/>
								) : proCatalogUnavailable ? (
									<p className="text-destructive text-sm" role="alert">
										{pricing.pro.catalogUnavailable}
									</p>
								) : (
									<>
										<Skeleton className="h-9 w-44" />
										<span className="sr-only">{pricing.pro.loading}</span>
									</>
								)}
							</div>

							<div className="mt-5 flex flex-col gap-4">
								<div className="flex flex-col gap-2">
									<label
										htmlFor="landing-pricing-tier"
										className="font-medium text-sm"
									>
										{pricing.pro.tierLabel}
									</label>
									{proPlan && selectedTier ? (
										<Select
											value={String(selectedTier.tierCredits)}
											onValueChange={(value) => {
												const tier = proPlan.tiers.find(
													(item) => String(item.tierCredits) === value,
												);

												if (tier) setSelectedCredits(tier.tierCredits);
											}}
										>
											<SelectTrigger
												id="landing-pricing-tier"
												className="h-11 w-full"
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
										<Skeleton className="h-11 w-full" />
									)}
								</div>
							</div>

							<ul className="mt-6 flex flex-1 flex-col gap-2.5">
								{pricing.pro.features.map((feature) => (
									<FeatureRow key={feature} label={feature} />
								))}
							</ul>
							{/* The picker resolves Card versus Cash / transfer and handles
							   the signed-out case through the auth modal. */}
							{subscriptionPlansAvailable && selectedTier ? (
								<Button
									className="mt-8 active:translate-y-px"
									onClick={() =>
										openPlanPicker("marketing_pricing", {
											plan: "pro",
											interval,
											tierCredits: selectedTier.tierCredits,
										})
									}
								>
									{pricing.pro.cta}
								</Button>
							) : null}
						</PlanCard>
					</Reveal>

					{showBusiness && businessFromUsd !== null ? (
						<Reveal delay={0.17}>
							<PlanCard>
								<h3 className="font-display font-semibold text-lg">
									{pricing.business.name}
								</h3>
								<p className="mt-1 text-muted-foreground text-sm">
									{pricing.business.tagline}
								</p>
								<div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
									<bdi className="font-bold font-mono text-3xl tabular-nums tracking-[-0.02em]">
										{pricing.business.fromPrice.replace(
											"{price}",
											formatUsd(businessFromUsd, locale),
										)}
									</bdi>
									<span className="font-mono text-muted-foreground text-xs">
										{pricing.business.perMonth}
									</span>
								</div>
								<ul className="mt-6 flex flex-1 flex-col gap-2.5">
									{pricing.business.features.map((feature) => (
										<FeatureRow key={feature} label={feature} />
									))}
								</ul>
								{canCreateTeam ? (
									<Button
										variant="outline"
										className="mt-8 active:translate-y-px"
										onClick={() => {
											if (!session) {
												openAuth();
												return;
											}

											setCreateTeamOpen(true);
										}}
									>
										{pricing.business.cta}
									</Button>
								) : null}
							</PlanCard>
						</Reveal>
					) : null}
				</div>
				<Reveal className="mt-8 text-center">
					<p className="font-mono text-muted-foreground text-xs">
						{pricing.note}
					</p>
				</Reveal>
			</div>
			<CreateWorkspaceDialog
				open={createTeamOpen}
				onOpenChange={setCreateTeamOpen}
			/>
		</section>
	);
}

function PriceSummary({
	tier,
	interval,
	locale,
	periodLabel,
}: {
	tier: BillingTierPrice;
	interval: BillingInterval;
	locale: Locale;
	periodLabel: string;
}) {
	return (
		<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
			<bdi className="font-bold font-mono text-3xl tabular-nums tracking-[-0.02em]">
				{formatUsd(tierPriceUsd(tier, interval), locale)}
			</bdi>
			<span className="font-mono text-muted-foreground text-xs">
				{periodLabel}
			</span>
		</div>
	);
}

function TierOption({
	tier,
	basePer100Usd,
	interval,
	locale,
	savingsLabel,
	unitLabel,
}: {
	tier: BillingTierPrice;
	basePer100Usd: number;
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
				{savings > 0 ? (
					<Badge variant="secondary" className="font-mono text-[9px]">
						{savingsLabel.replace("{percent}", String(savings))}
					</Badge>
				) : null}
				<bdi className="font-mono text-xs tabular-nums">
					{formatUsd(tierPriceUsd(tier, interval), locale)}
				</bdi>
			</span>
		</span>
	);
}

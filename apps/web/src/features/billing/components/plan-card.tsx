import type {
	BillingInterval,
	BillingTierPrice,
	CreditTier,
} from "@wandit/contracts";
import { creditTierSchema } from "@wandit/contracts";
import { Badge } from "@wandit/ui/components/badge";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@wandit/ui/components/select";
import { cn } from "@wandit/ui/lib/utils";
import { Check } from "lucide-react";

import {
	formatUsd,
	tierPriceUsd,
	tierSavingsPercent,
} from "@/features/billing/lib/plan-pricing";
import { useTranslation } from "@/lib/i18n";

export function PlanCard({
	name,
	badge,
	tagline,
	tier,
	tiers,
	basePer100Usd,
	interval,
	perLabel,
	selectId,
	selectLabel,
	onSelectTier,
	action,
	features,
	featureColumns = 1,
	highlighted = false,
}: {
	name: string;
	badge?: string;
	tagline: string;
	tier: BillingTierPrice;
	tiers: readonly BillingTierPrice[];
	basePer100Usd: number;
	interval: BillingInterval;
	perLabel: string;
	selectId: string;
	selectLabel: string;
	onSelectTier: (tierCredits: CreditTier) => void;
	action: React.ReactNode;
	features: readonly string[];
	featureColumns?: 1 | 2;
	highlighted?: boolean;
}) {
	const { locale, t } = useTranslation();
	const savings = tierSavingsPercent(tier, basePer100Usd);

	return (
		<section
			className={cn(
				"flex flex-col rounded-2xl border bg-card/70 p-4 sm:p-5",
				highlighted && "border-primary/35 ring-1 ring-primary/10",
			)}
		>
			<div className="flex items-center gap-2">
				<h3 className="font-display font-semibold text-lg tracking-tight">
					{name}
				</h3>
				{badge ? (
					<Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
						{badge}
					</Badge>
				) : null}
			</div>
			<p className="mt-1 text-muted-foreground text-xs">{tagline}</p>
			<div className="mt-4 flex flex-wrap items-center gap-2">
				<p className="font-mono font-semibold text-3xl tabular-nums">
					{formatUsd(tierPriceUsd(tier, interval), locale)}
					<span className="ms-1.5 font-normal font-sans text-muted-foreground text-xs">
						{perLabel}
					</span>
				</p>
				{savings > 0 ? (
					<Badge variant="success">
						{t("billing.planPicker.savePercent", { percent: savings })}
					</Badge>
				) : null}
			</div>
			<div className="mt-4 grid gap-2">
				<label htmlFor={selectId} className="font-medium text-sm">
					{selectLabel}
				</label>
				<Select
					value={String(tier.tierCredits)}
					onValueChange={(value) => {
						const parsed = creditTierSchema.safeParse(Number(value));
						if (parsed.success) onSelectTier(parsed.data);
					}}
				>
					<SelectTrigger id={selectId} className="h-11 w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							{tiers.map((option) => {
								const optionSavings = tierSavingsPercent(option, basePer100Usd);
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
			{action}
			<FeatureList items={features} columns={featureColumns} />
		</section>
	);
}

function FeatureList({
	items,
	columns = 1,
}: {
	items: readonly string[];
	columns?: 1 | 2;
}) {
	return (
		<ul
			className={cn(
				"mt-5 grid gap-2 border-t pt-4",
				columns === 2 && "sm:grid-cols-2 sm:gap-x-4",
			)}
		>
			{items.map((item) => (
				<li key={item} className="flex items-start gap-2 text-sm">
					<Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
					<span className="min-w-0">{item}</span>
				</li>
			))}
		</ul>
	);
}

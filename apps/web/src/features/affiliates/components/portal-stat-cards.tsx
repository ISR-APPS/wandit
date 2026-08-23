import type { AffiliatePortalAggregate } from "@wandit/contracts";
import { formatNumber } from "@wandit/internationalization";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@wandit/ui/components/card";

import { useTranslation } from "@/lib/i18n";
import { formatAffiliateMoney } from "../lib/affiliate-portal-format";

type PortalStatCardsProps = {
	aggregates: AffiliatePortalAggregate;
};

export function PortalStatCards({ aggregates }: PortalStatCardsProps) {
	const { locale, t } = useTranslation();

	return (
		<div className="flex flex-col gap-6">
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				<MetricCard
					label={t("affiliates.stats.clicks")}
					value={formatNumber(aggregates.clickCount, locale)}
					description={t("affiliates.stats.uniqueVisitors", {
						count: aggregates.uniqueVisitorCount,
						countDisplay: formatNumber(aggregates.uniqueVisitorCount, locale),
					})}
				/>
				<MetricCard
					label={t("affiliates.stats.signups")}
					value={formatNumber(aggregates.attributedUserCount, locale)}
				/>
				<MetricCard
					label={t("affiliates.stats.payingCustomers")}
					value={formatNumber(aggregates.paidCustomerCount, locale)}
					description={t("affiliates.stats.paidInvoices", {
						count: aggregates.paidInvoiceCount,
						countDisplay: formatNumber(aggregates.paidInvoiceCount, locale),
					})}
				/>
			</div>

			{aggregates.currencies.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					{t("affiliates.stats.noCommissions")}
				</p>
			) : (
				aggregates.currencies.map((currency) => (
					<section key={currency.currency} className="flex flex-col gap-3">
						<h3 className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
							{t("affiliates.stats.currencyLabel", {
								currency: currency.currency.toUpperCase(),
							})}
						</h3>
						<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
							<MetricCard
								label={t("affiliates.stats.referredRevenue")}
								value={formatAffiliateMoney(
									currency.attributedRevenueCents,
									currency.currency,
									locale,
								)}
							/>
							<MetricCard
								label={t("affiliates.stats.pendingCommission")}
								value={formatAffiliateMoney(
									currency.pendingCommissionCents,
									currency.currency,
									locale,
								)}
							/>
							<MetricCard
								label={t("affiliates.stats.approvedCommission")}
								value={formatAffiliateMoney(
									currency.approvedCommissionCents,
									currency.currency,
									locale,
								)}
							/>
							<MetricCard
								label={t("affiliates.stats.paidOut")}
								value={formatAffiliateMoney(
									currency.paidCommissionCents,
									currency.currency,
									locale,
								)}
							/>
							<MetricCard
								label={t("affiliates.stats.balance")}
								value={formatAffiliateMoney(
									currency.balanceCents,
									currency.currency,
									locale,
								)}
							/>
						</div>
					</section>
				))
			)}
		</div>
	);
}

function MetricCard({
	description,
	label,
	value,
}: {
	description?: string;
	label: string;
	value: string;
}) {
	return (
		<Card className="gap-3 py-4">
			<CardHeader className="px-4">
				<CardTitle className="font-medium text-muted-foreground text-xs">
					{label}
				</CardTitle>
			</CardHeader>
			<CardContent className="px-4">
				<p className="font-mono font-semibold text-2xl tabular-nums tracking-tight">
					<span dir="ltr">{value}</span>
				</p>
				{description ? (
					<p className="mt-1 text-muted-foreground text-xs">{description}</p>
				) : null}
			</CardContent>
		</Card>
	);
}

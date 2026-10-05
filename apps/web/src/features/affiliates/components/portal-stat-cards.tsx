/**
 * The metric cards at the top of the affiliate portal: clicks, signups, and
 * paying customers, then one row of money cards per currency. The portal
 * page renders it with the overview aggregates, and renders the skeleton
 * while the overview loads.
 */
import type { AffiliatePortalAggregate } from "@wandit/contracts";
import { formatNumber } from "@wandit/internationalization";
import { Skeleton } from "@wandit/ui/components/skeleton";

import { useTranslation } from "@/lib/i18n";
import { formatAffiliateMoney } from "../lib/affiliate-portal-format";

const METRIC_CARD_CLASS =
	"rounded-[1.5rem] bg-white p-5 shadow-[0_2px_0_rgb(11_16_51/0.06)] ring-1 ring-night/[0.08] dark:bg-card dark:shadow-[0_2px_0_rgb(0_0_0/0.35)] dark:ring-white/10";

const SKELETON_KEYS = ["clicks", "signups", "paying"];

type PortalStatCardsProps = {
	aggregates: AffiliatePortalAggregate;
};

/** The count cards and the per-currency money cards. Money comes in cents and shows in the currency of its row. */
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
				<p className="text-night/60 text-sm dark:text-foreground/60">
					{t("affiliates.stats.noCommissions")}
				</p>
			) : (
				aggregates.currencies.map((currency) => (
					<section key={currency.currency} className="flex flex-col gap-3">
						<h3 className="font-grotesk font-semibold text-[11px] text-night/60 uppercase tracking-[0.08em] rtl:tracking-normal dark:text-foreground/60">
							{t("affiliates.stats.currencyLabel", {
								currency: currency.currency.toUpperCase(),
							})}
						</h3>
						{/* Five money values do not fit in one row beside the sidebar
						    before 2xl, so the row wraps to three columns. */}
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
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

/** The loading shape of the three count cards: the same white card with three bars. */
export function PortalStatCardsSkeleton() {
	return (
		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
			{SKELETON_KEYS.map((key) => (
				<div key={key} className={METRIC_CARD_CLASS}>
					<Skeleton className="h-3 w-24 rounded-full" />
					<Skeleton className="mt-3 h-8 w-32 rounded-xl" />
					<Skeleton className="mt-2 h-3 w-28 rounded-full" />
				</div>
			))}
		</div>
	);
}

function MetricCard({
	description,
	label,
	value,
}: {
	/** A hint under the value, for example "12 unique visitors". */
	description?: string;
	label: string;
	/** The value, already formatted for the locale. */
	value: string;
}) {
	return (
		<div className={METRIC_CARD_CLASS}>
			<p className="font-grotesk font-semibold text-[11px] text-night/60 uppercase tracking-[0.08em] rtl:tracking-normal dark:text-foreground/60">
				{label}
			</p>
			<p className="mt-2 font-bold font-grotesk text-[1.75rem] text-night tabular-nums leading-tight tracking-[-0.035em] dark:text-foreground">
				<span dir="ltr">{value}</span>
			</p>
			{description ? (
				<p className="mt-1 text-night/60 text-xs dark:text-foreground/60">
					{description}
				</p>
			) : null}
		</div>
	);
}

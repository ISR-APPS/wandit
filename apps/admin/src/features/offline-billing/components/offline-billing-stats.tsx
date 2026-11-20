/**
 * Shows totals on the offline billing page.
 * Reads the stats query and formats recorded payment amounts.
 */
import type { LucideIcon } from "lucide-react";
import { ClipboardListIcon, WalletCardsIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminManualBillingStats } from "@/features/offline-billing/api/offline-billing.dto";
import { useManualBillingStatsQuery } from "@/features/offline-billing/api/offline-billing.queries";
import { formatManualPaymentAmount } from "@/features/offline-billing/lib/offline-billing";

/**
 * Header aggregates for the Offline billing page: open requests and the money collected per currency.
 * Offline and SlickPay money stays out of the USD analytics, so this strip is where it shows.
 * The subscription counters of the API go to zero after the cutover, so the page does not show them.
 */
export function OfflineBillingStats() {
	const statsQuery = useManualBillingStatsQuery();

	if (statsQuery.isPending) {
		return (
			<div className="grid gap-3 sm:grid-cols-2" aria-hidden>
				{Array.from({ length: 2 }, (_, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton tiles
					<Skeleton key={index} className="h-24 rounded-xl" />
				))}
			</div>
		);
	}

	const stats = statsQuery.data;

	if (!stats) {
		// The tables below carry their own error states; a failed stats fetch
		// must not block working the queue.
		return null;
	}

	return (
		<div className="grid gap-3 sm:grid-cols-2">
			<StatTile
				icon={ClipboardListIcon}
				label="Open requests"
				value={stats.openRequests.toLocaleString("en-US")}
				description="Not yet approved, rejected, or canceled."
			/>
			<CollectedTile
				collectedThisMonth={stats.collectedThisMonth}
				collectedPreviousMonth={stats.collectedPreviousMonth}
			/>
		</div>
	);
}

function StatTile({
	icon: Icon,
	label,
	value,
	description,
}: {
	icon: LucideIcon;
	label: string;
	value: string;
	description: string;
}) {
	return (
		<Card className="shadow-none">
			<CardContent className="flex flex-col gap-1 py-4">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Icon className="size-4" aria-hidden="true" />
					<span className="text-xs uppercase tracking-[0.12em]">{label}</span>
				</div>
				<p className="font-mono font-semibold text-2xl tabular-nums">{value}</p>
				<p className="text-muted-foreground text-xs">{description}</p>
			</CardContent>
		</Card>
	);
}

function CollectedTile({
	collectedThisMonth,
	collectedPreviousMonth,
}: {
	collectedThisMonth: AdminManualBillingStats["collectedThisMonth"];
	collectedPreviousMonth: AdminManualBillingStats["collectedPreviousMonth"];
}) {
	const previousByCurrency = new Map(
		collectedPreviousMonth.map((line) => [line.currency, line]),
	);

	return (
		<Card className="shadow-none">
			<CardContent className="flex flex-col gap-1 py-4">
				<div className="flex items-center gap-2 text-muted-foreground">
					<WalletCardsIcon className="size-4" aria-hidden="true" />
					<span className="text-xs uppercase tracking-[0.12em]">
						Collected this month
					</span>
				</div>
				{collectedThisMonth.length === 0 ? (
					<p className="font-mono font-semibold text-2xl tabular-nums">—</p>
				) : (
					<div className="flex flex-col">
						{collectedThisMonth.map((line) => (
							<p
								key={line.currency}
								className="font-mono font-semibold text-xl tabular-nums"
								title={`${line.payments.toLocaleString("en-US")} payments`}
							>
								{formatManualPaymentAmount(line.amountMinor, line.currency)}
							</p>
						))}
					</div>
				)}
				<p className="text-muted-foreground text-xs">
					{previousMonthSummary(previousByCurrency, collectedThisMonth)}
				</p>
			</CardContent>
		</Card>
	);
}

function previousMonthSummary(
	previousByCurrency: Map<
		string,
		AdminManualBillingStats["collectedPreviousMonth"][number]
	>,
	collectedThisMonth: AdminManualBillingStats["collectedThisMonth"],
): string {
	const currencies = new Set([
		...previousByCurrency.keys(),
		...collectedThisMonth.map((line) => line.currency),
	]);

	if (currencies.size === 0) {
		return "Offline and SlickPay payments, UTC month.";
	}

	const parts = [...currencies]
		.sort()
		.map((currency) =>
			formatManualPaymentAmount(
				previousByCurrency.get(currency)?.amountMinor ?? 0,
				currency,
			),
		);

	return `Last month: ${parts.join(" · ")}`;
}

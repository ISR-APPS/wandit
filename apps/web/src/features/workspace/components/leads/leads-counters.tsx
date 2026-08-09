// Stat tiles over the full (unfiltered) lead book: today, this week, total,
// and confirmation rate with an ember meter.

import type { LeadTotals } from "@wandit/contracts";

import { useTranslation } from "@/lib/i18n";

export function LeadsCounters({ totals }: { totals: LeadTotals }) {
	const { t } = useTranslation();
	const denominator = totals.confirmed + totals.cancelled;
	const rate =
		denominator === 0
			? null
			: Math.round((totals.confirmed / denominator) * 100);

	return (
		<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<div className="rounded-xl border bg-card p-4">
				<div className="text-muted-foreground text-xs">
					{t("leads.counterToday")}
				</div>
				<div className="mt-1 font-medium font-mono text-2xl tabular-nums">
					{totals.today}
				</div>
			</div>
			<div className="rounded-xl border bg-card p-4">
				<div className="text-muted-foreground text-xs">
					{t("leads.counterWeek")}
				</div>
				<div className="mt-1 font-medium font-mono text-2xl tabular-nums">
					{totals.last7Days}
				</div>
			</div>
			<div className="rounded-xl border bg-card p-4">
				<div className="text-muted-foreground text-xs">
					{t("leads.counterTotal")}
				</div>
				<div className="mt-1 font-medium font-mono text-2xl tabular-nums">
					{totals.total}
				</div>
			</div>
			<div
				className="rounded-xl border bg-card p-4"
				title={t("leads.confirmationHint")}
			>
				<div className="text-muted-foreground text-xs">
					{t("leads.counterConfirmation")}
					<span className="sr-only"> ({t("leads.confirmationHint")})</span>
				</div>
				<div className="mt-1 font-medium font-mono text-2xl tabular-nums">
					{rate === null ? "—" : `${rate}%`}
				</div>
				<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
					<div
						className="h-full rounded-full bg-gradient-ember"
						style={{ width: `${rate ?? 0}%` }}
					/>
				</div>
			</div>
		</div>
	);
}

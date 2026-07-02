// Stat tiles over the full (unfiltered) lead book: today, this week, total,
// and confirmation rate with an ember meter.

import type { Lead } from "../../api/dto";
import { WORKSPACE_COPY } from "../../lib/constants";

const DAY_MS = 86_400_000;

export function LeadsCounters({ leads }: { leads: Lead[] }) {
	const now = new Date();
	const startOfToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	).getTime();
	const weekAgo = now.getTime() - 7 * DAY_MS;

	const today = leads.filter(
		(lead) => Date.parse(lead.createdAt) >= startOfToday,
	).length;
	const week = leads.filter(
		(lead) => Date.parse(lead.createdAt) >= weekAgo,
	).length;
	const confirmed = leads.filter((lead) => lead.status === "confirmed").length;
	const cancelled = leads.filter((lead) => lead.status === "cancelled").length;
	const denominator = confirmed + cancelled;
	const rate =
		denominator === 0 ? null : Math.round((confirmed / denominator) * 100);

	return (
		<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<div className="rounded-xl border bg-card p-4">
				<div className="text-muted-foreground text-xs">
					{WORKSPACE_COPY.leads.counterToday}
				</div>
				<div className="mt-1 font-medium font-mono text-2xl tabular-nums">
					{today}
				</div>
			</div>
			<div className="rounded-xl border bg-card p-4">
				<div className="text-muted-foreground text-xs">
					{WORKSPACE_COPY.leads.counterWeek}
				</div>
				<div className="mt-1 font-medium font-mono text-2xl tabular-nums">
					{week}
				</div>
			</div>
			<div className="rounded-xl border bg-card p-4">
				<div className="text-muted-foreground text-xs">
					{WORKSPACE_COPY.leads.counterTotal}
				</div>
				<div className="mt-1 font-medium font-mono text-2xl tabular-nums">
					{leads.length}
				</div>
			</div>
			<div
				className="rounded-xl border bg-card p-4"
				title={WORKSPACE_COPY.leads.confirmationHint}
			>
				<div className="text-muted-foreground text-xs">
					{WORKSPACE_COPY.leads.counterConfirmation}
					<span className="sr-only">
						{" "}
						({WORKSPACE_COPY.leads.confirmationHint})
					</span>
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

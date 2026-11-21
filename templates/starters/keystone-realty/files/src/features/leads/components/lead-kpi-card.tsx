// One count card of the leads page, in the "chip" KPI layout: the label, the value,
// the delta badge with what it compares, and a round icon chip at the end of the head.
// LeadsPage renders three of them after the answer target card.
import { ChangeBadge } from "~/features/agency";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";

type LeadKpiCardProps = {
	label: string;
	/** The formatted value, for example "126". */
	value: string;
	/** Ratio against the previous period of the same length: 0.12 is +12 %. null shows "No earlier data". */
	change: number | null;
	/** What the change compares, for example "against the previous 30 days". It shows after the badge. */
	comparison: string;
	icon: KitIcon;
};

/** A rise is good news for every count of this page, so the badge is green when the count goes up. */
export function LeadKpiCard({
	label,
	value,
	change,
	comparison,
	icon: Icon,
}: LeadKpiCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<div className="grid gap-2">
					<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
						{value}
					</p>
					<div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground text-sm">
						<ChangeBadge
							change={change}
							goodWhen="up"
							comparison={comparison}
						/>
						{change === null ? null : (
							<span aria-hidden="true">{comparison}</span>
						)}
					</div>
				</div>
				<CardAction>
					<span className="flex size-12 items-center justify-center rounded-full border bg-muted">
						<Icon className="size-5" />
					</span>
				</CardAction>
			</CardHeader>
		</Card>
	);
}

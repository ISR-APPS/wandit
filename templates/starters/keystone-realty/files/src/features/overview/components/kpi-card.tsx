// One KPI card of the home, in the "ruled" variant: the label as the card title
// with a round icon chip at the end, a rule under the head, then the value and its delta badge.
// OverviewPage renders four of them in the KPI row.
import { ChangeBadge } from "~/features/agency";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";

type KpiCardProps = {
	label: string;
	/** The formatted value, for example "86" or "$41.2M". */
	value: string;
	/** Ratio against the earlier value: 0.12 is +12 %. null shows "No earlier data". */
	change: number | null;
	/** What the change compares, read by screen readers, for example "against 30 days ago". */
	comparison: string;
	icon: KitIcon;
};

/** A rise is good news for every KPI of the home, so the badge is green when the figure goes up. */
export function KpiCard({
	label,
	value,
	change,
	comparison,
	icon: Icon,
}: KpiCardProps) {
	return (
		<Card>
			<CardHeader className="border-b pb-4">
				<CardTitle>{label}</CardTitle>
				<CardAction>
					<span className="flex size-8 items-center justify-center rounded-full border bg-muted text-muted-foreground">
						<Icon className="size-4" />
					</span>
				</CardAction>
			</CardHeader>
			<CardContent className="flex flex-wrap items-end gap-2">
				<p className="font-numeric font-semibold text-3xl tabular-nums leading-none">
					{value}
				</p>
				<ChangeBadge
					change={change}
					goodWhen="up"
					comparison={comparison}
					className="mb-0.5"
				/>
			</CardContent>
		</Card>
	);
}

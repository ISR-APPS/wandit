// One KPI card of the targets page: a label, a value, a delta line, and a round icon chip at the end of the head.
// TargetsPage renders three of them after the team progress card.
import { ChangeLine } from "~/features/sales";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";

type TargetKpiCardProps = {
	label: string;
	/** The formatted value, for example "$1,240,000". */
	value: string;
	/** Ratio against the quarter before, after the same count of days. null shows "No earlier data". */
	change: number | null;
	/** "down" for a figure where a fall is good news, for example the gap to the target. */
	goodWhen: "up" | "down";
	/** What the delta compares, for example "vs Q3 2026, same day". */
	context: string;
	icon: KitIcon;
};

/** The card holds only a CardHeader, so the 4 cards of the row keep one height. */
export function TargetKpiCard({
	label,
	value,
	change,
	goodWhen,
	context,
	icon: Icon,
}: TargetKpiCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<div className="grid gap-2">
					<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
						{value}
					</p>
					<ChangeLine
						change={change}
						kind="ratio"
						goodWhen={goodWhen}
						context={context}
						className="text-sm"
					/>
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

// One KPI card of the home: the label as the title, the change line under it, a muted icon at the end,
// and the value at the bottom. OverviewPage renders four of them. It follows the project variant of the kit KPI:
// no round chip, a faint primary tint that rises from the bottom edge.
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import { ChangeText } from "./change-text";

type KpiCardProps = {
	label: string;
	/** The formatted value, for example "168 h" or "12". */
	value: string;
	/** Ratio against the comparison window: 0.12 is +12 %. null shows "No earlier data". */
	change: number | null;
	/** "down" for a figure where a fall is good news. */
	goodWhen: "up" | "down";
	/** What the change compares with, for example "against the 30 days before". It shows only with a change. */
	context: string;
	icon: KitIcon;
};

/** The context differs per card, so no sentence repeats in the row. */
export function KpiCard({
	label,
	value,
	change,
	goodWhen,
	context,
	icon: Icon,
}: KpiCardProps) {
	return (
		<Card className="bg-linear-to-t from-primary/10 to-card">
			<CardHeader>
				<CardTitle>{label}</CardTitle>
				<CardDescription>
					<ChangeText change={change} goodWhen={goodWhen} />
					{change === null ? null : ` ${context}`}
				</CardDescription>
				<CardAction>
					<Icon className="@4xl/main:size-6 size-5 text-muted-foreground/60" />
				</CardAction>
			</CardHeader>
			<CardContent>
				<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
					{value}
				</p>
			</CardContent>
		</Card>
	);
}

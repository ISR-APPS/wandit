// One KPI card of the home: the label, the delta line under it, a round icon chip at the end, and the value below.
// OverviewPage renders four of them in the KPI row. The order of the parts follows the kit project dashboard.
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";
import type { KpiItem } from "../lib/series";
import { ChangeLine } from "./change-line";

type KpiCardProps = {
	/** The translated label, for example "Active projects". */
	label: string;
	/** The formatted value, for example "€48,200" or "71%". */
	value: string;
	item: Pick<KpiItem, "change" | "changeUnit" | "goodWhen">;
	/** A short text after the delta that says what the delta compares. It shows only when a delta exists. */
	context: string;
	icon: KitIcon;
};

/** The card ground fades from a primary tint at the bottom, as the kit project cards do. */
export function KpiCard({
	label,
	value,
	item,
	context,
	icon: Icon,
}: KpiCardProps) {
	return (
		<Card className="bg-linear-to-t from-primary/10 to-card">
			<CardHeader>
				<CardTitle>{label}</CardTitle>
				<CardDescription className="flex flex-wrap items-center gap-x-1.5">
					<ChangeLine item={item} />
					{item.change === null ? null : <span>{context}</span>}
				</CardDescription>
				<CardAction>
					<span className="flex size-12 items-center justify-center rounded-full border bg-muted">
						<Icon className="size-5" />
					</span>
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

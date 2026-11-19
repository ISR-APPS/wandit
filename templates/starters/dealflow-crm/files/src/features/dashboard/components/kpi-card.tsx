// One KPI card of the home: a label, a value, a delta line, and a round icon chip at the end of the head.
// DashboardPage renders four of them in the KPI row. It follows the "chip" KPI variant of the kit system.
import { ChangeLine } from "~/features/crm";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";

type KpiCardProps = {
	label: string;
	/** The formatted value, for example "$412,800" or "38%". */
	value: string;
	/** Ratio against the period before: 0.12 is +12 %. null shows "No earlier data". */
	change: number | null;
	/** A short text after the delta that says what the delta compares. It shows only when a delta exists. */
	context: string;
	icon: KitIcon;
};

/** The card holds only a CardHeader, as in the kit. The context differs per card, so no sentence repeats in the row. */
export function KpiCard({
	label,
	value,
	change,
	context,
	icon: Icon,
}: KpiCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<div className="grid gap-2">
					<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
						{value}
					</p>
					<div className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-sm">
						<ChangeLine change={change} goodWhen="up" />
						{change === null ? null : <span>{context}</span>}
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

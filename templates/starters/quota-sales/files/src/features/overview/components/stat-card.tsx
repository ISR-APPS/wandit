// One small stat card of the home: an icon tile and a label in one row, the value, and the delta line.
// OverviewPage renders four of them in a 2 x 2 grid beside the bookings chart .
import { ChangeLine } from "~/features/sales";
import { Card, CardDescription, CardHeader } from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";

type StatCardProps = {
	/** The translated label, for example "Bookings". */
	label: string;
	/** The formatted value, for example "$412,800" or "87%". */
	value: string;
	/** The change against the earlier period. null shows "No earlier data". */
	change: number | null;
	/** "points" for a figure that is itself a percent. */
	changeKind: "ratio" | "points";
	/** What the change compares, for example "against the 30 days before". */
	context: string;
	icon: KitIcon;
};

/** The card holds only a CardHeader, so the 4 cards of the grid keep one height. Every figure here rises as good news. */
export function StatCard({
	label,
	value,
	change,
	changeKind,
	context,
	icon: Icon,
}: StatCardProps) {
	return (
		<Card>
			<CardHeader className="gap-2">
				<div className="flex items-center gap-2">
					<span className="flex size-8 shrink-0 items-center justify-center rounded-md border">
						<Icon className="size-4 text-muted-foreground" />
					</span>
					<CardDescription>{label}</CardDescription>
				</div>
				<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
					{value}
				</p>
				<ChangeLine
					change={change}
					kind={changeKind}
					goodWhen="up"
					context={context}
				/>
			</CardHeader>
		</Card>
	);
}

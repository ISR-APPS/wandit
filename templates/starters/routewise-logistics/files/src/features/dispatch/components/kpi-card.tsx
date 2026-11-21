// One KPI card of the home: a label, a large value, and one line under it, with a round icon chip at the end.
// DispatchPage renders four of them in a 2 x 2 grid beside the volume card.
// The line is a delta with its comparison, or a short fact for a figure of now that has no earlier value.
import { ChangeLine } from "~/features/logistics";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";

/** The line under the value: a delta against the period before, or a plain fact. */
export type KpiNote =
	| {
			kind: "change";
			/** Ratio against the period before: 0.12 is +12 %. null shows "No earlier data". */
			change: number | null;
			/** "down" for a figure where a fall is good news, for example late deliveries. */
			goodWhen: "up" | "down";
			/** What the delta compares, for example "vs the 30 days before". Shown only with a delta. */
			context: string;
	  }
	| {
			kind: "fact";
			/** A short translated fact about the value now, for example "4 due today". */
			text: string;
	  };

type KpiCardProps = {
	label: string;
	/** The formatted value, for example "142" or "91.4%". */
	value: string;
	note: KpiNote;
	icon: KitIcon;
};

/** The card holds only a CardHeader. The note differs per card, so no sentence repeats in the grid. */
export function KpiCard({ label, value, note, icon: Icon }: KpiCardProps) {
	return (
		<Card>
			<CardHeader className="gap-1">
				<CardDescription>{label}</CardDescription>
				<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
					{value}
				</p>
				{note.kind === "change" ? (
					<div className="flex flex-wrap items-center gap-x-1 text-muted-foreground text-xs">
						<ChangeLine change={note.change} goodWhen={note.goodWhen} />
						{note.change === null ? null : <span>{note.context}</span>}
					</div>
				) : (
					<p className="text-muted-foreground text-xs">{note.text}</p>
				)}
				<CardAction className="row-span-3">
					<span className="flex size-12 items-center justify-center rounded-full border bg-muted">
						<Icon className="size-5" />
					</span>
				</CardAction>
			</CardHeader>
		</Card>
	);
}

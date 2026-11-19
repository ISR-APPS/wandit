// One KPI card of the home: a label, a value, a line under the value, and a round icon chip at the end of the head.
// DashboardPage renders four of them in the KPI row. It follows the "chip" KPI variant of the kit system.
// KpiDelta is the usual line: the signed change and a short context.
import type { ReactNode } from "react";
import { ChangeLine } from "~/features/helpdesk";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
} from "~/shared/ui/card";
import type { KitIcon } from "~/shared/ui/icons";

type KpiCardProps = {
	label: string;
	/** The formatted value, for example "28", "2.3 hr", or "92%". */
	value: string;
	icon: KitIcon;
	/** The line under the value: a KpiDelta, or a short colored note for a snapshot figure. */
	children: ReactNode;
};

/** The card holds only a CardHeader, as in the kit. */
export function KpiCard({ label, value, icon: Icon, children }: KpiCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<div className="grid gap-2">
					<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
						{value}
					</p>
					{children}
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

type KpiDeltaProps = {
	/** Ratio against the period before: 0.12 is +12 %. null shows "No earlier data". */
	change: number | null;
	/** "down" for a figure where a fall is good news, such as a reply time. */
	goodWhen: "up" | "down";
	/** A short text after the delta that says what it compares. It shows only when a delta exists. */
	context: string;
};

/** The context differs per card, so no sentence repeats in the row. */
export function KpiDelta({ change, goodWhen, context }: KpiDeltaProps) {
	return (
		<div className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground text-sm">
			<ChangeLine change={change} goodWhen={goodWhen} />
			{change === null ? null : <span>{context}</span>}
		</div>
	);
}

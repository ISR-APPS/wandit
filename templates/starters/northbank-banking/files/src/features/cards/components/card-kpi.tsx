// One KPI card of the cards page: the label, the value, and a small badge at the end of the head.
// CardsPage renders four of them above the table. It follows the KPI cards of the kit product list.
import type { ReactNode } from "react";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type CardKpiProps = {
	label: string;
	/** The formatted value, for example "$9,480". */
	value: string;
	/** An outline Badge: the change against last month, or a share. */
	badge: ReactNode;
};

/** The card holds only a CardHeader, as in the kit. */
export function CardKpi({ label, value, badge }: CardKpiProps) {
	return (
		<Card>
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<CardTitle className="font-numeric @4xl/main:text-3xl text-2xl tabular-nums">
					{value}
				</CardTitle>
				<CardAction>{badge}</CardAction>
			</CardHeader>
		</Card>
	);
}

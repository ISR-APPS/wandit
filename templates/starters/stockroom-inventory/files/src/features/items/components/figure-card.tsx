// One figure card of the item list: the label, the value, and its change in an outline badge at the end.
// ItemsPage renders four of them over the table, as the kit product list does.
import { Delta } from "~/features/stock";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { ItemsFigure } from "../api/items.queries";

type FigureCardProps = {
	/** The figure name, already translated. */
	label: string;
	/** The formatted value, for example "$148,200". */
	value: string;
	/** The figure of the summary. The badge reads its change against 30 days ago. */
	figure: ItemsFigure;
	/** "down" when a fall is good news. "neutral" shows the change with no color. */
	goodWhen: "up" | "down" | "neutral";
};

/** The card holds only a CardHeader. */
export function FigureCard({
	label,
	value,
	figure,
	goodWhen,
}: FigureCardProps) {
	return (
		<Card>
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<CardTitle className="font-numeric @4xl/main:text-3xl text-2xl tabular-nums">
					{value}
				</CardTitle>
				<CardAction>
					<Delta change={figure.change} goodWhen={goodWhen} variant="badge" />
				</CardAction>
			</CardHeader>
		</Card>
	);
}

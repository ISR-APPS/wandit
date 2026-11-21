// One figure card of the home, in the kit "footer" form: the label and the change in one row, the value under them,
// and a footer link to the list behind the figure. OverviewPage renders three of them beside the top item card.
import type { ReactNode } from "react";
import { Delta } from "~/features/stock";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardFooter } from "~/shared/ui/card";
import type { Figure } from "../api/overview.queries";

type StatCardProps = {
	/** The figure name, already translated. */
	label: string;
	/** The formatted value, for example "$148,200" or "12". */
	value: string;
	/** The figure of the summary. The card reads its change against the start of the period. */
	figure: Figure;
	/** "down" when a fall is good news. "neutral" shows the change with no color. */
	goodWhen: "up" | "down" | "neutral";
	/** A router Link with its text and an arrow. The card gives it the ghost button look. */
	footer: ReactNode;
};

/** The card has no padding of its own: the content and the footer each hold their padding, and a rule splits them. */
export function StatCard({
	label,
	value,
	figure,
	goodWhen,
	footer,
}: StatCardProps) {
	return (
		<Card className="gap-0 py-0">
			<CardContent className="grid flex-1 content-start gap-4 py-6">
				<div className="flex items-start justify-between gap-2">
					<span className="truncate text-muted-foreground text-sm">
						{label}
					</span>
					<Delta change={figure.change} goodWhen={goodWhen} />
				</div>
				<p className="font-numeric font-semibold @4xl/main:text-3xl text-2xl tabular-nums">
					{value}
				</p>
			</CardContent>
			<CardFooter className="justify-end border-t px-3 py-2">
				<Button asChild variant="ghost" size="sm">
					{footer}
				</Button>
			</CardFooter>
		</Card>
	);
}

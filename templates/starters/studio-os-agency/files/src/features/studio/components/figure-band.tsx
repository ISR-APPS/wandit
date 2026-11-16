// A band of four headline figures in one card, ruled into cells: two by two on a phone, one row from 3xl.
// The Clients, Projects, Team, and Invoices pages render it above their list.
import { cn } from "~/shared/lib/utils";
import { Card } from "~/shared/ui/card";

/** One cell of the band. */
export type Figure = {
	/** Stable key of the cell. */
	id: string;
	/** The label, already translated. */
	label: string;
	/** The value, already formatted. */
	value: string;
	/** True paints the value red: money that is late, for example. */
	isBad?: boolean;
};

type FigureBandProps = {
	/** Four figures. The border rules assume a two by two grid below 3xl. */
	figures: Figure[];
};

/** The values use the numeral face, so the four cells line up. */
export function FigureBand({ figures }: FigureBandProps) {
	return (
		<Card className="grid @3xl/main:grid-cols-4 grid-cols-2 gap-0 py-0">
			{figures.map((figure) => (
				<div
					key={figure.id}
					className="grid gap-1 border-e @max-3xl/main:nth-[-n+2]:border-b px-6 py-4 last:border-e-0 @max-3xl/main:even:border-e-0"
				>
					<p className="label-text text-muted-foreground text-xs">
						{figure.label}
					</p>
					<p
						className={cn(
							"font-numeric font-semibold text-2xl tabular-nums",
							figure.isBad && "text-destructive",
						)}
					>
						{figure.value}
					</p>
				</div>
			))}
		</Card>
	);
}

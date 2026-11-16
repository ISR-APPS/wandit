// One small figure of the home: a label, a signed amount, and its change as a percent.
// PortfolioPage renders two of them beside the trend tile. It follows the small size of the KPI forms.
import { ChangeLine, signedMoneyFormat } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";

type SmallFigureProps = {
	/** The name of the figure, already translated. */
	label: string;
	/** A gain or a loss in the app currency. The tile shows it with a sign and no cents. */
	amount: number;
	/** The same gain as a ratio: 0.12 is +12 %. null when the base is 0. */
	change: number | null;
	/** What the percent compares with, already translated. Screen readers read it. */
	comparison: string;
	/** The grid span of the tile in the mosaic. */
	className?: string;
};

/** The tile is 2 of 12 columns wide, so the amount has no cents. The Holdings page shows the exact amount. */
export function SmallFigure({
	label,
	amount,
	change,
	comparison,
	className,
}: SmallFigureProps) {
	const { locale } = useT();
	return (
		<Card className={cn("py-4", className)}>
			<CardContent className="grid gap-1.5 px-4">
				<p className="label-text text-muted-foreground text-sm">{label}</p>
				{/* dir="ltr" keeps the sign in front of the amount in an Arabic page. */}
				<bdi
					dir="ltr"
					className="font-numeric font-semibold @4xl/main:text-xl @5xl/main:text-2xl text-2xl tabular-nums"
				>
					{signedMoneyFormat(locale, 0).format(amount)}
				</bdi>
				<ChangeLine change={change} comparison={comparison} />
			</CardContent>
		</Card>
	);
}

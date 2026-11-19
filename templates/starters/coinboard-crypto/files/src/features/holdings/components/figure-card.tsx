// One KPI card of the Holdings page: the label, the amount, and the change in an outline badge at the end.
// HoldingsPage renders 4 of them in the KPI row. The badge text is green for good news and red for bad news.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type FigureCardProps = {
	/** The translated label, for example "Holdings value". */
	label: string;
	/** The amount, already formatted. */
	value: string;
	/** The change as a ratio: 0.201 shows "+20.1%". null shows "No earlier data". */
	change: number | null;
	/** "down" for a cost such as fees: a fall is good news. */
	goodWhen?: "up" | "down";
};

/** A change that rounds to 0.0 % shows muted, with no sign. */
export function FigureCard({
	label,
	value,
	change,
	goodWhen = "up",
}: FigureCardProps) {
	const { t, locale } = useT();
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
	// One decimal shows 0.05 % and more. A smaller change prints as 0.0 %.
	const isFlat = change === null || Math.abs(change) < 0.0005;
	const isGood =
		change !== null && (goodWhen === "up" ? change > 0 : change < 0);

	return (
		<Card>
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<CardTitle className="font-normal font-numeric @4xl/main:text-3xl text-2xl tabular-nums">
					{value}
				</CardTitle>
				<CardAction>
					<Badge variant="outline">
						{change === null ? (
							<span className="text-muted-foreground">
								{t("kpi.noComparison")}
							</span>
						) : (
							<bdi
								dir="ltr"
								className={cn(
									isFlat
										? "text-muted-foreground"
										: isGood
											? "text-success"
											: "text-destructive",
								)}
							>
								{percent.format(isFlat ? 0 : change)}
							</bdi>
						)}
					</Badge>
				</CardAction>
			</CardHeader>
		</Card>
	);
}

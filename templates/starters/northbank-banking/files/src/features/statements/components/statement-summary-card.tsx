// The sum of one statement as a short equation: opening, plus money in, minus money out, gives the closing.
// Under the sum, the lowest and the highest end-of-day balance of the month, when the balance moved.
// StatementDetailPage renders it in its rail. It reads the statement and the daily points of the page query.
import {
	countLabel,
	type DailyPoint,
	dayFormat,
	dayToDate,
	MoneyText,
} from "~/features/bank";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import type { Statement } from "../lib/statements";

type StatementSummaryCardProps = {
	statement: Statement;
	/** The end-of-day balance of each day of the statement, in cents, oldest first. */
	points: DailyPoint[];
};

/** The sign column makes the sum readable: + money in, − money out, = closing. */
export function StatementSummaryCard({
	statement,
	points,
}: StatementSummaryCardProps) {
	const { t, locale } = useT();
	const shortDay = dayFormat(locale);
	const lines = [
		{
			id: "opening",
			sign: "",
			label: t("statements.opening"),
			cents: statement.openingCents,
		},
		{
			id: "in",
			sign: "+",
			label: t("statements.moneyIn"),
			cents: statement.moneyInCents,
		},
		{
			id: "out",
			sign: "−",
			label: t("statements.moneyOut"),
			cents: statement.moneyOutCents,
		},
	];
	// The first day wins a tie, so the day shown is the first day at that balance.
	const lowest = points.reduce<DailyPoint | undefined>(
		(found, point) => (found && found.current <= point.current ? found : point),
		undefined,
	);
	const highest = points.reduce<DailyPoint | undefined>(
		(found, point) => (found && found.current >= point.current ? found : point),
		undefined,
	);
	const extremes = [
		{ id: "lowest", label: t("statements.lowest"), point: lowest },
		{ id: "highest", label: t("statements.highest"), point: highest },
	];
	// A month with a flat balance has no lowest or highest day, so the block would repeat one figure.
	const hasRange =
		lowest !== undefined &&
		highest !== undefined &&
		lowest.current !== highest.current;
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("statements.summaryTitle")}</CardTitle>
				<CardDescription>
					{countLabel(
						statement.lineCount,
						t("statements.lineOne"),
						t("statements.lineOther"),
						locale,
					)}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-5">
				<dl className="grid gap-3 text-sm">
					{lines.map((line) => (
						<div key={line.id} className="flex items-baseline gap-2">
							<span aria-hidden="true" className="w-3 text-muted-foreground">
								{line.sign}
							</span>
							<dt className="flex-1 text-muted-foreground">{line.label}</dt>
							<dd>
								<MoneyText amountCents={line.cents} />
							</dd>
						</div>
					))}
					<div className="flex items-baseline gap-2 border-t pt-3">
						<span aria-hidden="true" className="w-3 text-muted-foreground">
							=
						</span>
						<dt className="flex-1 font-medium">{t("statements.closing")}</dt>
						<dd>
							<MoneyText
								amountCents={statement.closingCents}
								className="font-semibold text-lg"
							/>
						</dd>
					</div>
				</dl>
				{hasRange ? (
					<dl className="grid gap-3 border-t pt-4 text-sm">
						{extremes.map(({ id, label, point }) =>
							point ? (
								<div key={id} className="flex items-baseline gap-2">
									<dt className="flex-1 text-muted-foreground">{label}</dt>
									<dd className="grid justify-items-end">
										<MoneyText amountCents={point.current} />
										<span className="text-muted-foreground text-xs tabular-nums">
											{shortDay.format(dayToDate(point.day))}
										</span>
									</dd>
								</div>
							) : null,
						)}
					</dl>
				) : null}
			</CardContent>
		</Card>
	);
}

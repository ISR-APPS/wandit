// The rows of an entry list: the day, the other party with its status, the signed amount, and an open button.
// The transactions card of the home and the transactions page render it inside a Card with no padding.
// It follows the transaction list of the kit payment pages. Each row button opens the entry page.
import { Link } from "@tanstack/react-router";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { CaretRightIcon } from "~/shared/ui/icons";
import { Table, TableBody, TableCell, TableRow } from "~/shared/ui/table";
import { dayToDate } from "../lib/bank-day";
import { dayFormat } from "../lib/format";
import { directionOf, type Transaction } from "../lib/sample-transactions";
import { MoneyText } from "./money-text";

type EntryRowsProps = {
	/** The entries of the page or the card, already cut to the rows that show. */
	rows: Transaction[];
	/** One muted sentence when `rows` is empty. */
	emptyText: string;
};

/** Money in is green with a plus, money out is red. A transfer shows its sign in a neutral color: it stays inside the business. */
export function EntryRows({ rows, emptyText }: EntryRowsProps) {
	const { t, locale } = useT();
	const longDay = dayFormat(locale, "long");
	if (rows.length === 0) {
		return (
			<p className="px-6 py-10 text-center text-muted-foreground text-sm">
				{emptyText}
			</p>
		);
	}
	return (
		<div className="overflow-x-auto">
			<Table>
				<TableBody>
					{rows.map((row) => {
						const direction = directionOf(row);
						return (
							<TableRow key={row.id}>
								{/* A narrow card has no room for the date column, so the date moves into the muted line. */}
								<TableCell className="@xl/main:table-cell hidden w-36 ps-6 tabular-nums">
									{longDay.format(dayToDate(row.day))}
								</TableCell>
								{/* w-full with max-w-0 gives the party the free width and truncates it, so the amount stays in view. */}
								<TableCell className="w-full max-w-0 @xl/main:ps-2 ps-6">
									<p className="truncate font-medium" dir="auto">
										{row.counterparty}
									</p>
									<p className="truncate text-muted-foreground text-sm">
										<span className="@xl/main:hidden">
											{`${longDay.format(dayToDate(row.day))} · `}
										</span>
										{`${t(`statuses.${row.status}`)} · ${t(`categories.${row.category}`)}`}
									</p>
								</TableCell>
								<TableCell className="pe-6">
									<div className="flex items-center justify-end gap-4">
										<MoneyText
											amountCents={row.amountCents}
											isSigned
											className={cn(
												direction === "out" && "text-destructive",
												direction === "transfer" && "text-foreground",
												// A returned entry never moved money, so its amount reads as struck out.
												row.status === "returned" &&
													"text-muted-foreground line-through",
											)}
										/>
										<Button
											variant="outline"
											size="icon"
											className="size-8"
											asChild
										>
											<Link
												to="/app/transactions/$transactionId"
												params={{ transactionId: row.id }}
												aria-label={`${t("entries.open")}: ${row.counterparty}`}
											>
												<CaretRightIcon className="rtl:rotate-180" />
											</Link>
										</Button>
									</div>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}

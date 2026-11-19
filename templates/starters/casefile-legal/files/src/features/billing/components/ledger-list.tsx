// One list of the billing tabs, as the kit transaction list: a card of rows with a date, a two-line text,
// an amount at the end, and a button that opens the invoice dialog. BillingPage renders one per tab.
// The list shows ten rows first. "Show more" adds ten more.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { fillMessage } from "~/features/practice";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Button } from "~/shared/ui/button";
import { Card } from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";

// Ten rows fill the first screen under the KPI row on a laptop.
const ROWS_PER_STEP = 10;

/** One row of the list, already formatted by the page. */
export type LedgerRow = {
	/** Stable id, also the React key. */
	id: string;
	/** The formatted date at the start of the row, for example "12 Nov 2026". */
	date: string;
	/** The first line, for example "Payment from Harbor & Pine LLC". */
	title: string;
	/** The muted second line, for example the matter and the status. */
	detail: string;
	/** The formatted amount at the end, with its sign when the money comes in. */
	amount: string;
	/** "in" colors the amount green, "late" red, "plain" keeps the text color. */
	tone: "in" | "late" | "plain";
	/** The invoice that the row button opens in the dialog. */
	invoiceId: string;
};

type LedgerListProps = {
	rows: LedgerRow[];
	/** The sentence when the list has no row. */
	empty: string;
};

/** Each button names its invoice for screen readers, so a list of icon buttons stays clear. */
export function LedgerList({ rows, empty }: LedgerListProps) {
	const { t, locale } = useT();
	const [shownCount, setShownCount] = useState(ROWS_PER_STEP);
	if (rows.length === 0) {
		return (
			<Card className="p-10 text-center text-muted-foreground text-sm">
				{empty}
			</Card>
		);
	}
	return (
		<div className="grid gap-4">
			<Card className="gap-0 py-0">
				<ul className="divide-y">
					{rows.slice(0, shownCount).map((row) => (
						<li key={row.id} className="flex items-center gap-4 px-6 py-3">
							<span className="@2xl/main:block hidden w-28 shrink-0 text-sm tabular-nums">
								{row.date}
							</span>
							<span className="grid min-w-0 flex-1 gap-0.5">
								<span className="truncate text-sm" dir="auto">
									{row.title}
								</span>
								<span
									className="truncate text-muted-foreground text-sm"
									dir="auto"
								>
									{/* The date column is hidden on a narrow page, so the date joins this line. */}
									<span className="@2xl/main:hidden">{`${row.date} · `}</span>
									{row.detail}
								</span>
							</span>
							<span
								className={cn(
									"shrink-0 text-end text-sm tabular-nums",
									row.tone === "in" && "text-success",
									row.tone === "late" && "text-destructive",
								)}
							>
								{row.amount}
							</span>
							<Button
								asChild
								variant="outline"
								size="icon"
								className="size-8 shrink-0"
							>
								<Link
									to="/app/billing"
									search={{ invoice: row.invoiceId }}
									aria-label={fillMessage(t("billing.openInvoice"), {
										title: row.title,
									})}
								>
									<CaretRightIcon className="rtl:rotate-180" />
								</Link>
							</Button>
						</li>
					))}
				</ul>
			</Card>
			{rows.length > shownCount ? (
				<Button
					type="button"
					variant="outline"
					className="justify-self-center"
					onClick={() => setShownCount(shownCount + ROWS_PER_STEP)}
				>
					{fillMessage(t("billing.showMore"), {
						count: new Intl.NumberFormat(locale).format(
							rows.length - shownCount,
						),
					})}
				</Button>
			) : null}
		</div>
	);
}

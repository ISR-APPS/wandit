// A compact table card of account entries: a label, the status, the day, and the amount.
// The detail pages render it beside RelatedListCard, for example "Payments" of a payee or "Lines" of a statement.
// It follows the "transaction history" card of the kit detail anatomy. Each label links to its entry page.
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import { dayToDate } from "../lib/bank-day";
import { dayFormat } from "../lib/format";
import type { Transaction } from "../lib/sample-transactions";
import { MoneyText } from "./money-text";
import { TransactionStatusBadge } from "./transaction-status-badge";

type EntryHistoryCardProps = {
	title: string;
	description?: string;
	/** One control at the end of the head, for example an export button. */
	headerAction?: ReactNode;
	/** The entries to list, already cut to the rows that fit. */
	rows: Transaction[];
	/** The text of the first cell, for example the memo or the other party. */
	labelOf: (row: Transaction) => string;
	/** One muted sentence when `rows` is empty. */
	emptyText: string;
};

/** The table scrolls inside the card on a phone. A narrow card hides the status column. */
export function EntryHistoryCard({
	title,
	description,
	headerAction,
	rows,
	labelOf,
	emptyText,
}: EntryHistoryCardProps) {
	const { t, locale } = useT();
	const shortDay = dayFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{description ? <CardDescription>{description}</CardDescription> : null}
				{headerAction ? <CardAction>{headerAction}</CardAction> : null}
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-muted-foreground text-sm">{emptyText}</p>
				) : (
					// The status column reads the width of this card, not of the page.
					// A detail page puts the card in a narrow column, where a status cell cuts every label.
					<div className="@container/history overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("entries.description")}</TableHead>
									{/* A card under 28rem drops the status column, so the label and the amount stay readable. */}
									<TableHead className="@md/history:table-cell hidden">
										{t("entries.status")}
									</TableHead>
									<TableHead>{t("entries.date")}</TableHead>
									<TableHead className="text-end">
										{t("entries.amount")}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((row) => (
									<TableRow key={row.id}>
										{/* w-full with max-w-0 gives the label the free width and truncates it, so the amount stays in view. */}
										<TableCell className="w-full max-w-0">
											<Link
												to="/app/transactions/$transactionId"
												params={{ transactionId: row.id }}
												className="block truncate font-medium hover:underline"
												dir="auto"
											>
												{labelOf(row)}
											</Link>
										</TableCell>
										<TableCell className="@md/history:table-cell hidden">
											<TransactionStatusBadge status={row.status} />
										</TableCell>
										<TableCell className="text-muted-foreground tabular-nums">
											{shortDay.format(dayToDate(row.day))}
										</TableCell>
										<TableCell className="text-end">
											<MoneyText amountCents={row.amountCents} isSigned />
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

// The lines of one statement in a table: the day, the entry, the amount, and the balance after it.
// StatementDetailPage renders it under the balance chart. DataTable searches and pages the lines.
import { Link } from "@tanstack/react-router";
import { dayFormat, dayToDate, MoneyText } from "~/features/bank";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { DataTable, type DataTableColumn } from "~/shared/ui/data-table";
import { useSidebar } from "~/shared/ui/sidebar";
import type { StatementLine } from "../lib/statements";

type StatementLinesCardProps = {
	/** The lines of the month, oldest first, each with its running balance. */
	lines: StatementLine[];
};

/** The lines keep the order of a paper statement: oldest first. A header click sorts them another way. */
export function StatementLinesCard({ lines }: StatementLinesCardProps) {
	const { t, locale } = useT();
	const { isMobile: isPhone } = useSidebar();
	const day = dayFormat(locale);

	const columns: DataTableColumn<StatementLine>[] = [
		{
			id: "date",
			header: t("transactions.date"),
			sortValue: (row) => row.id,
			cell: (row) => (
				<span className="whitespace-nowrap text-muted-foreground tabular-nums">
					{day.format(dayToDate(row.day))}
				</span>
			),
		},
		{
			id: "description",
			header: t("transactions.description"),
			sortValue: (row) => row.counterparty,
			cell: (row) => (
				<div className="grid min-w-0 justify-items-start">
					<Link
						to="/app/transactions/$transactionId"
						params={{ transactionId: row.id }}
						className="max-w-full truncate font-medium hover:underline"
					>
						{row.counterparty}
					</Link>
					<span className="max-w-full truncate text-muted-foreground text-xs">
						{isPhone
							? `${day.format(dayToDate(row.day))} · ${t(`categories.${row.category}`)}`
							: `${t(`categories.${row.category}`)} · ${row.memo}`}
					</span>
				</div>
			),
		},
		{
			id: "amount",
			header: t("transactions.amount"),
			align: "end",
			sortValue: (row) => row.amountCents,
			// A phone has no balance column, so the balance after the line sits under the amount.
			cell: (row) =>
				isPhone ? (
					<div className="grid justify-items-end">
						<MoneyText amountCents={row.amountCents} isSigned />
						<MoneyText
							amountCents={row.balanceAfterCents}
							className="text-muted-foreground text-xs"
						/>
					</div>
				) : (
					<MoneyText amountCents={row.amountCents} isSigned />
				),
		},
	];
	if (!isPhone) {
		columns.push({
			id: "balance",
			header: t("statements.balance"),
			align: "end",
			sortValue: (row) => row.balanceAfterCents,
			cell: (row) => (
				<MoneyText
					amountCents={row.balanceAfterCents}
					className="text-muted-foreground"
				/>
			),
		});
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("statements.linesTitle")}</CardTitle>
				<CardDescription>{t("statements.linesDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="max-md:px-3">
				{lines.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("statements.noLines")}
					</p>
				) : (
					<DataTable
						rows={lines}
						columns={isPhone ? columns.slice(1) : columns}
						searchText={(row) => `${row.counterparty} ${row.memo}`}
						noResults={t("transactions.noResults")}
					/>
				)}
			</CardContent>
		</Card>
	);
}

// The card "More from this payee" of the transaction detail page: the other entries with the same payee.
// TransactionDetailPage renders it under the slip. Each row opens its own detail page.
import { Link } from "@tanstack/react-router";
import {
	countLabel,
	dayFormat,
	dayToDate,
	MoneyText,
	TransactionStatusBadge,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
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
import type { TransactionRow } from "../api/transactions.queries";

type PayeeHistoryCardProps = {
	/** The title of the card, already translated, for example "More from Juniper Café". */
	title: string;
	/** The other entries with this payee, newest first. It does not hold the entry of the page. */
	rows: TransactionRow[];
};

/** The description gives the count and the sum of the rows, so it always equals the table under it. */
export function PayeeHistoryCard({ title, rows }: PayeeHistoryCardProps) {
	const { t, locale } = useT();
	const day = dayFormat(locale, "long");
	const totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{rows.length > 0 ? (
					<CardDescription>
						{countLabel(
							rows.length,
							t("transactions.entriesOne"),
							t("transactions.entriesOther"),
							locale,
						)}
						{" · "}
						<MoneyText amountCents={totalCents} />
					</CardDescription>
				) : null}
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("transactions.payeeHistoryEmpty")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("transactions.date")}</TableHead>
								<TableHead>{t("transactions.memo")}</TableHead>
								{/* The status column shows from 28rem. A phone keeps the date, the note, and the amount. */}
								<TableHead className="@md/main:table-cell hidden">
									{t("transactions.status")}
								</TableHead>
								<TableHead className="text-end">
									{t("transactions.amount")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow key={row.id}>
									<TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
										{day.format(dayToDate(row.day))}
									</TableCell>
									{/* The note wraps, so a phone keeps the amount on the screen. */}
									<TableCell className="whitespace-normal">
										<Link
											to="/app/transactions/$transactionId"
											params={{ transactionId: row.id }}
											// The padding makes the touch area 44 px high. The negative margin keeps the row height.
											className="-my-3 inline-block py-3 font-medium hover:underline"
											dir="auto"
										>
											{row.memo}
										</Link>
									</TableCell>
									<TableCell className="@md/main:table-cell hidden">
										<TransactionStatusBadge status={row.status} />
									</TableCell>
									<TableCell className="text-end">
										<MoneyText
											amountCents={row.amountCents}
											sign="always"
											className={cn(row.type === "income" && "text-success")}
										/>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}

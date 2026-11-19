// The transactions card of the home: the newest entries in a plain table, and a link to the full list.
// OverviewPage renders it in the last band with the newest rows of transactionsQueryOptions.
// Each payee name opens the detail page of its entry.
import { Link } from "@tanstack/react-router";
import {
	dayFormat,
	dayToDate,
	MoneyText,
	PayeeAvatar,
} from "~/features/ledger";
import type { TransactionRow } from "~/features/transactions";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardContent,
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

type RecentTransactionsCardProps = {
	/** The newest entries, newest first. The card shows them all: the page slices the list. */
	rows: TransactionRow[];
};

/** Money in shows in the good news color, money out in the bad news color, a transfer in the text color. */
export function RecentTransactionsCard({ rows }: RecentTransactionsCardProps) {
	const { t, locale } = useT();
	const day = dayFormat(locale, "long");
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("transactions.title")}</CardTitle>
				<CardAction>
					<Button asChild variant="outline" size="sm">
						<Link to="/app/transactions">{t("overview.viewAll")}</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("overview.noTransactions")}
					</p>
				) : (
					<Table>
						<TableHeader className="bg-transparent">
							<TableRow>
								<TableHead>{t("transactions.transaction")}</TableHead>
								{/* On a phone the amount is the main value. The date and type columns hide so the amount stays in view. */}
								<TableHead className="@md/main:table-cell hidden">
									{t("transactions.date")}
								</TableHead>
								<TableHead className="@md/main:table-cell hidden">
									{t("transactions.type")}
								</TableHead>
								<TableHead className="text-end">
									{t("transactions.amount")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow key={row.id}>
									<TableCell className="font-medium">
										<Link
											to="/app/transactions/$transactionId"
											params={{ transactionId: row.id }}
											className="flex items-center gap-3 hover:underline"
										>
											<PayeeAvatar
												payee={row.payee}
												type={row.type}
												categoryId={row.categoryId}
												className="size-8"
											/>
											<span className="grid min-w-0">
												<span className="max-w-48 truncate" dir="auto">
													{row.payee}
												</span>
												{/* The date column hides on a phone, so the day moves under the payee. */}
												<span className="@md/main:hidden font-normal text-muted-foreground text-xs tabular-nums">
													{day.format(dayToDate(row.day))}
												</span>
											</span>
										</Link>
									</TableCell>
									<TableCell className="@md/main:table-cell hidden whitespace-nowrap tabular-nums">
										{day.format(dayToDate(row.day))}
									</TableCell>
									<TableCell className="@md/main:table-cell hidden">
										<Badge variant="outline">
											{t(`transactionTypes.${row.type}`)}
										</Badge>
									</TableCell>
									<TableCell className="text-end">
										<MoneyText
											amountCents={row.amountCents}
											sign="always"
											className={cn(
												row.type === "income" && "text-success",
												row.type === "expense" && "text-destructive",
											)}
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

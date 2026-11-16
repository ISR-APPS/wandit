// The "Servers" panel of the day report: checks, covers, sales, and card tips per server.
// ReportPage renders it in the last row. The footer row adds up to the gross sales and the tips.
// It reads the server rows of the day report. It writes nothing.
import { formatCents, moneyFormat } from "~/features/restaurant";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { ServerRow } from "../lib/day-report";

type ServersPanelProps = {
	/** The servers, the highest sales first. */
	rows: ServerRow[];
};

/** A Card with a table and a total row. On a phone, covers and tips hide, so the table fits. */
export function ServersPanel({ rows }: ServersPanelProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const number = new Intl.NumberFormat(locale);
	const sum = (pick: (row: ServerRow) => number) =>
		rows.reduce((total, row) => total + pick(row), 0);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("report.servers")}</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("report.server")}</TableHead>
							<TableHead className="text-end">{t("report.checks")}</TableHead>
							<TableHead className="@xl/main:table-cell hidden text-end">
								{t("report.covers")}
							</TableHead>
							<TableHead className="text-end">{t("report.revenue")}</TableHead>
							<TableHead className="@xl/main:table-cell hidden text-end">
								{t("report.tipsColumn")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow key={row.id}>
								<TableCell className="whitespace-nowrap font-medium">
									{row.name}
								</TableCell>
								<TableCell className="text-end tabular-nums">
									{number.format(row.checks)}
								</TableCell>
								<TableCell className="@xl/main:table-cell hidden text-end tabular-nums">
									{number.format(row.covers)}
								</TableCell>
								<TableCell className="text-end font-medium tabular-nums">
									{formatCents(money, row.salesCents)}
								</TableCell>
								<TableCell className="@xl/main:table-cell hidden text-end text-muted-foreground tabular-nums">
									{formatCents(money, row.tipsCents)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
					<TableFooter>
						<TableRow>
							<TableCell>{t("report.grossSales")}</TableCell>
							<TableCell className="text-end tabular-nums">
								{number.format(sum((row) => row.checks))}
							</TableCell>
							<TableCell className="@xl/main:table-cell hidden text-end tabular-nums">
								{number.format(sum((row) => row.covers))}
							</TableCell>
							<TableCell className="text-end tabular-nums">
								{formatCents(
									money,
									sum((row) => row.salesCents),
								)}
							</TableCell>
							<TableCell className="@xl/main:table-cell hidden text-end tabular-nums">
								{formatCents(
									money,
									sum((row) => row.tipsCents),
								)}
							</TableCell>
						</TableRow>
					</TableFooter>
				</Table>
			</CardContent>
		</Card>
	);
}

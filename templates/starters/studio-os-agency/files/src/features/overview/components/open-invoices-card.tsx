// The table of the Invoices tab: the first 8 invoices that wait for payment, with their due day and amount.
// The overview passes the open invoices, overdue first. "See all" opens the Invoices page.
import type { InvoiceRow } from "~/features/studio";
import { InvoiceBadge, useFormatters } from "~/features/studio";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
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
import { SeeAllLink } from "./see-all-link";

type OpenInvoicesCardProps = {
	/** Sent and overdue invoices, overdue first, then by due day. The card shows the first 8. */
	invoices: InvoiceRow[];
};

/** The second line of the number cell names the client. An overdue due day shows in red. */
export function OpenInvoicesCard({ invoices }: OpenInvoicesCardProps) {
	const { t } = useT();
	const format = useFormatters();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("overview.openInvoices")}</CardTitle>
				<CardAction>
					<SeeAllLink to="/app/invoices" />
				</CardAction>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("invoices.invoice")}</TableHead>
							{/* A phone-width card has room for three columns. The red due day still marks overdue money. */}
							<TableHead className="@max-md/main:hidden">
								{t("invoices.status")}
							</TableHead>
							<TableHead>{t("invoices.due")}</TableHead>
							<TableHead className="text-end">{t("invoices.amount")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{invoices.slice(0, 8).map((invoice) => (
							<TableRow key={invoice.id}>
								<TableCell>
									<div className="grid">
										<span
											className={cn(
												"font-medium tabular-nums",
												invoice.number === null && "text-muted-foreground",
											)}
										>
											{invoice.number ?? t("invoices.draftNumber")}
										</span>
										<span className="text-muted-foreground text-xs">
											{invoice.clientName}
										</span>
									</div>
								</TableCell>
								<TableCell className="@max-md/main:hidden">
									<InvoiceBadge status={invoice.status} />
								</TableCell>
								<TableCell
									className={cn(
										invoice.status === "overdue" &&
											"font-medium text-destructive",
									)}
								>
									{format.relativeDay(invoice.dueDay)}
								</TableCell>
								<TableCell className="text-end font-medium tabular-nums">
									{format.money(invoice.amount)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

// The invoices of one project: number, issue day, status, and amount, with the billed and paid totals on top.
// The project detail page renders it in its rail.
import {
	InvoiceBadge,
	type InvoiceRow,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";

type ProjectInvoicesCardProps = {
	/** Every invoice of the project: the sent ones newest first, then the drafts. The card lists all of them. */
	invoices: InvoiceRow[];
	/** Euros of sent and paid invoices. */
	invoiced: number;
	/** Euros of paid invoices. */
	paid: number;
};

/** A project with no invoice yet shows one muted line. */
export function ProjectInvoicesCard({
	invoices,
	invoiced,
	paid,
}: ProjectInvoicesCardProps) {
	const { t } = useT();
	const format = useFormatters();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("projectDetail.invoices")}</CardTitle>
				<CardDescription>
					{t("projectDetail.billedPaid")
						.replace("{billed}", format.money(invoiced))
						.replace("{paid}", format.money(paid))}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{invoices.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("projectDetail.noInvoices")}
					</p>
				) : (
					<ul className="grid">
						{invoices.map((invoice) => (
							<li
								key={invoice.id}
								className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b py-2.5 first:pt-0 last:border-b-0 last:pb-0"
							>
								<div className="grid">
									<span
										className={cn(
											"font-medium text-sm tabular-nums",
											invoice.number === null && "text-muted-foreground",
										)}
									>
										{invoice.number ?? t("invoices.draftNumber")}
									</span>
									<span className="text-muted-foreground text-xs">
										{format.shortDate(invoice.issueDay)}
									</span>
								</div>
								<div className="grid justify-items-end gap-1">
									<span className="font-medium text-sm tabular-nums">
										{format.money(invoice.amount)}
									</span>
									<InvoiceBadge status={invoice.status} />
								</div>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

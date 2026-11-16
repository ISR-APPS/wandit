// The invoices of one matter: number, issue date, amount, and status. Each row opens the invoice on the billing page.
// MatterDetailPage renders it last in the rail.
import { Link } from "@tanstack/react-router";
import {
	type InvoiceRow,
	InvoiceStatusBadge,
	moneyFormat,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";

type MatterInvoicesCardProps = {
	/** The invoices of the matter, newest first. */
	invoices: InvoiceRow[];
};

/** The newest invoice comes first. An empty list shows one muted sentence. */
export function MatterInvoicesCard({ invoices }: MatterInvoicesCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("matters.invoices")}</CardTitle>
			</CardHeader>
			<CardContent>
				{invoices.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("matters.noInvoices")}
					</p>
				) : (
					<ul className="-mx-2 grid">
						{invoices.map((invoice) => (
							<li key={invoice.id}>
								<Link
									to="/app/billing"
									search={{ invoice: invoice.id }}
									className="flex items-center justify-between gap-3 rounded-control px-2 py-2 outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
								>
									<span className="grid text-sm">
										<span className="font-medium tabular-nums">
											{invoice.number}
										</span>
										<span className="text-muted-foreground text-xs tabular-nums">
											{date.format(new Date(invoice.issuedAt))}
										</span>
									</span>
									<span className="grid justify-items-end gap-1">
										<span className="text-sm tabular-nums">
											{money.format(invoice.amount)}
										</span>
										<InvoiceStatusBadge status={invoice.status} />
									</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

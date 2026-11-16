// The customer of one ticket: the company, its plan, and three facts (revenue, seats, open tickets).
// TicketDetailPage renders it at the end of its rail. The company name opens the customer on the Customers page.
import { Link } from "@tanstack/react-router";
import { moneyFormat, PLAN_BADGE } from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { TicketDetail } from "../api/tickets.queries";

type TicketCustomerCardProps = {
	ticket: TicketDetail;
};

/** The company line with its plan badge, then three facts in a row. RelatedTicketsCard lists the other tickets. */
export function TicketCustomerCard({ ticket }: TicketCustomerCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const { customer } = ticket;
	const facts = [
		{
			key: "mrr",
			label: t("customers.mrr"),
			value: moneyFormat(locale).format(customer.mrr),
		},
		{
			key: "seats",
			label: t("customers.seats"),
			value: number.format(customer.seats),
		},
		{
			key: "open",
			label: t("customers.openTickets"),
			value: number.format(customer.openTickets),
		},
	];
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("tickets.customer")}</CardTitle>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="flex items-start justify-between gap-3">
					{/* The link covers the name and the city (after:inset-0), so the tap area is large on a phone. */}
					<div className="relative grid min-w-0 justify-items-start gap-0.5">
						<Link
							to="/app/customers"
							search={{ customer: customer.id }}
							className="font-medium after:absolute after:inset-0 hover:underline"
						>
							{customer.name}
						</Link>
						<span className="text-muted-foreground text-xs">
							{customer.city}
						</span>
					</div>
					<Badge variant={PLAN_BADGE[customer.plan]}>
						{t(`customers.plans.${customer.plan}`)}
					</Badge>
				</div>
				<dl className="grid grid-cols-3 gap-2 rounded-lg bg-muted/60 p-3">
					{facts.map((fact) => (
						<div key={fact.key} className="grid gap-0.5">
							<dt className="text-muted-foreground text-xs">{fact.label}</dt>
							<dd className="font-numeric text-sm tabular-nums">
								{fact.value}
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}

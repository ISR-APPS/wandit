// The content of the customer sheet: the company, its four figures, its people, and its newest tickets.
// CustomerSheet renders it for the customer of the `?customer=` param. Each ticket opens its page.
import { Link } from "@tanstack/react-router";
import {
	fillMessage,
	formatRelativeTime,
	moneyFormat,
	PersonAvatar,
	PLAN_BADGE,
	TicketStatusBadge,
} from "~/features/helpdesk";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { SheetDescription, SheetHeader, SheetTitle } from "~/shared/ui/sheet";
import {
	CUSTOMER_FIGURE_DAYS,
	type CustomerListItem,
} from "../api/customers.queries";

type CustomerPanelProps = {
	customer: CustomerListItem;
};

/** The sheet header, a 2 by 2 grid of figures, the people, and up to 5 tickets. */
export function CustomerPanel({ customer }: CustomerPanelProps) {
	const { t, locale } = useT();
	const now = Date.now();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const since = new Intl.DateTimeFormat(locale, {
		month: "long",
		year: "numeric",
	});
	const figures = [
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
		{
			key: "satisfaction",
			label: t("customers.satisfaction"),
			value:
				customer.satisfaction === null
					? "—"
					: percent.format(customer.satisfaction),
		},
	];
	return (
		<div className="grid gap-6 pb-6">
			<SheetHeader className="gap-2 border-b pe-12">
				<Badge variant={PLAN_BADGE[customer.plan]}>
					{t(`customers.plans.${customer.plan}`)}
				</Badge>
				<SheetTitle className="font-display text-xl">
					{customer.name}
				</SheetTitle>
				<SheetDescription>
					{fillMessage(t("customers.sinceLine"), {
						city: customer.city,
						date: since.format(new Date(customer.customerSince)),
					})}
				</SheetDescription>
			</SheetHeader>
			<dl className="mx-4 grid grid-cols-2 overflow-hidden rounded-lg border">
				{figures.map((figure, index) => (
					<div
						key={figure.key}
						className={cn(
							"grid gap-0.5 p-3",
							index % 2 === 1 && "border-s",
							index > 1 && "border-t",
						)}
					>
						<dt className="text-muted-foreground text-xs">{figure.label}</dt>
						<dd className="font-numeric text-lg tabular-nums">
							{figure.value}
						</dd>
					</div>
				))}
			</dl>
			<section className="grid gap-3 px-4">
				<h3 className="font-medium text-sm">{t("customers.people")}</h3>
				<ul className="grid gap-3">
					{customer.contacts.map((contact) => (
						<li key={contact.id} className="flex items-center gap-3">
							<PersonAvatar name={contact.name} className="size-8" />
							<div className="grid min-w-0 text-sm">
								<span className="font-medium">{contact.name}</span>
								<span className="truncate text-muted-foreground text-xs">
									{`${contact.title} · ${contact.email}`}
								</span>
							</div>
						</li>
					))}
				</ul>
			</section>
			<section className="grid gap-3 px-4">
				<h3 className="font-medium text-sm">
					{fillMessage(t("customers.recentTickets"), {
						count: number.format(customer.recentTicketCount),
						days: number.format(CUSTOMER_FIGURE_DAYS),
					})}
				</h3>
				{customer.recentTickets.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("customers.noTickets")}
					</p>
				) : (
					<ul className="grid">
						{/* The link covers its row (after:inset-0), so a tap anywhere in the row opens the ticket. */}
						{customer.recentTickets.map((ticket) => (
							<li
								key={ticket.id}
								className="relative grid gap-1 border-t py-2.5 first:border-t-0 first:pt-0"
							>
								<Link
									to="/app/tickets/$ticketId"
									params={{ ticketId: ticket.id }}
									className="line-clamp-1 text-sm after:absolute after:inset-0 hover:underline"
								>
									{ticket.subject}
								</Link>
								<span className="flex items-center gap-2 text-muted-foreground text-xs">
									<TicketStatusBadge status={ticket.status} />
									<span className="tabular-nums">{`#${ticket.id}`}</span>
									<span>
										{formatRelativeTime(ticket.createdAt, now, locale)}
									</span>
								</span>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
